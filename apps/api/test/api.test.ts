/** End-to-end API tests in DEMO_MODE with fake providers (no network, no bindings). */

import { beforeEach, describe, expect, it } from "@jest/globals";

import type { ClothingAnalysis } from "@outfit/engine";

import { createApp } from "../src/index";
import { MemoryStore, memoryRepositories } from "../src/db/memory";
import { resetDemoState } from "../src/services/container";
import type { ClothingAnalyzer, ImageInput, TryOnRequest, TryOnResult, VirtualTryOnService, WeatherProvider } from "../src/services/providers";
import { planGarments } from "../src/services/providers";
import { MemoryStorage, UrlSigner } from "../src/storage/storage";

const DEMO_USER = "00000000-0000-4000-8000-00000000d3a0";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(100).fill(0x30)]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0x30)]);

const env = { DEMO_MODE: "true", CORS_ORIGINS: "http://localhost:3000", PUBLIC_BASE_URL: "http://localhost:8000" };

class StubWeather implements WeatherProvider {
  name = "stub";
  async fetch(latitude: number, longitude: number) {
    const now = new Date();
    return { id: null, location: null, latitude, longitude, temperature: 6, feels_like: 4, temp_min: null, temp_max: null, humidity: null, wind_speed: 18, precipitation: 0, precipitation_probability: 0, weather_code: 3, hourly: [], daily: [], provider: "stub", recorded_at: now.toISOString(), expires_at: new Date(now.getTime() + 3_600_000).toISOString() };
  }
}

class FakeAnalyzer implements ClothingAnalyzer {
  name = "fake-analyzer";
  static calls = 0;
  async analyze(): Promise<ClothingAnalysis> {
    FakeAnalyzer.calls++;
    return { name: "Blue denim jacket", category: "outerwear", subcategory: "jacket", color: "blue", secondary_colors: [], pattern: "plain", style: "casual", material: "denim", season: ["spring", "autumn"], formality: "casual", confidence: 0.9 };
  }
}

class FakeRemover {
  name = "fake";
  async remove(): Promise<ImageInput> {
    return { data: PNG.slice().buffer as ArrayBuffer, mimeType: "image/png" };
  }
}

class FakeTryOn implements VirtualTryOnService {
  name = "fake-tryon";
  static calls: string[][] = [];
  async generateTryOn(request: TryOnRequest): Promise<TryOnResult> {
    const plan = planGarments(request.garments);
    FakeTryOn.calls.push(plan.ordered.map((g) => g.label));
    return { provider: this.name, status: "ok", image: { data: PNG.slice().buffer as ArrayBuffer, mimeType: "image/png" }, applied: plan.ordered.map((g) => g.label), skipped: plan.skipped };
  }
}

type Client = ReturnType<typeof makeClient>;

function makeClient(ai: boolean) {
  resetDemoState();
  const store = new MemoryStore();
  const signer = new UrlSigner("http://localhost:8000", "test-secret");
  const app = createApp({
    repos: memoryRepositories(store),
    storage: new MemoryStorage(signer),
    weather: new StubWeather(),
    ...(ai ? { analyzer: new FakeAnalyzer(), remover: new FakeRemover(), tryon: new FakeTryOn() } : {}),
  });
  // Background work (waitUntil) is collected so tests can await it.
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const request = async (method: string, path: string, body?: unknown, form?: FormData) => {
    const init: RequestInit = { method };
    if (form) init.body = form;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { "content-type": "application/json" };
    }
    const res = await app.request(`http://localhost:8000${path}`, init, env, ctx);
    const json = (await res.json()) as { success: boolean; data: any; error: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    return { status: res.status, ...json };
  };
  const drain = async () => {
    while (pending.length) await pending.shift();
  };
  const file = (path: string, bytes: Uint8Array, type: string, name = "a.jpg", extra: Record<string, string> = {}) => {
    const form = new FormData();
    form.append("image", new Blob([bytes], { type }), name);
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
    return request("POST", path, undefined, form);
  };
  return { request, file, drain, app, ctx };
}

async function addPhoto(c: Client) {
  const up = await c.file("/uploads/body-photos", JPEG, "image/jpeg", "front.jpg");
  expect(up.success).toBe(true);
  const saved = await c.request("POST", "/body/photos", { front_image_path: up.data.path });
  expect(saved.success).toBe(true);
  return up.data.path as string;
}

async function ingest(c: Client, name = "a.jpg") {
  const r = await c.file("/wardrobe/ingest", JPEG, "image/jpeg", name);
  expect(r.status).toBe(201);
  return r.data;
}

describe("basics", () => {
  it("demo /me needs no token", async () => {
    const c = makeClient(false);
    const me = await c.request("GET", "/me");
    expect(me.success && me.data.role).toBe("demo");
    expect(me.data.profile.location_name).toBe("Ulaanbaatar, Mongolia");
  });

  it("lists the sample wardrobe without provider internals", async () => {
    const c = makeClient(false);
    const body = await c.request("GET", "/wardrobe");
    expect(body.data).toHaveLength(22);
    const first = body.data[0];
    expect(first.image_url).toBeNull();
    expect(first.slot).toBeTruthy();
    expect(first.label).toBeTruthy();
    expect("ai_raw" in first || "ai_model" in first).toBe(false);
  });

  it("weather uses the profile location", async () => {
    const c = makeClient(false);
    const w = await c.request("GET", "/weather");
    expect(w.data.feels_like).toBe(4);
    expect(w.data.band).toBe("cold");
  });

  it("legacy routes are gone", async () => {
    const c = makeClient(false);
    expect((await c.request("GET", "/recommendations/today")).status).toBe(404);
    expect((await c.request("POST", "/body/avatar")).status).toBe(404);
  });
});

describe("wardrobe", () => {
  it("crud in demo", async () => {
    const c = makeClient(false);
    const created = await c.request("POST", "/wardrobe", { image_path: `${DEMO_USER}/new.jpg`, category: "top", subcategory: "cardigan", name: "green cardigan", dominant_color: "green", season: ["autumn"], warmth: 3, formality: 2 });
    expect(created.status).toBe(201);
    expect(created.data.slot).toBe("layer");
    expect(created.data.original_image_path).toBe(`${DEMO_USER}/new.jpg`);
    const id = created.data.id;
    expect((await c.request("PATCH", `/wardrobe/${id}`, { favorite: true })).data.favorite).toBe(true);
    expect((await c.request("DELETE", `/wardrobe/${id}`)).data.deleted).toBe(id);
    expect((await c.request("GET", `/wardrobe/${id}`)).status).toBe(404);
  });

  it("rejects a foreign image path", async () => {
    const c = makeClient(false);
    expect((await c.request("POST", "/wardrobe", { image_path: "someone-else/pic.jpg", category: "top" })).status).toBe(403);
  });

  it("analyze without an analyzer is 503", async () => {
    const c = makeClient(false);
    const r = await c.file("/wardrobe/analyze", JPEG, "image/jpeg");
    expect(r.status).toBe(503);
    expect(r.error.code).toBe("ai_unavailable");
  });

  it("ingest without AI keeps the original and flags review", async () => {
    const c = makeClient(false);
    const d = await ingest(c);
    expect(d.analyzed).toBe(false);
    expect(d.background_removed).toBe(false);
    expect(d.needs_review).toBe(true);
    expect(d.item.image_url).toContain("/files/wardrobe/");
    expect(d.item.name).toBeNull();
  });

  it("rejects bad uploads", async () => {
    const c = makeClient(false);
    expect((await c.file("/wardrobe/ingest", new Uint8Array([1, 2, 3]), "image/gif", "a.gif")).status).toBe(415);
    expect((await c.file("/wardrobe/ingest", new Uint8Array([]), "image/jpeg")).status).toBe(400);
  });

  it("ingest pipeline with fake AI derives engine fields and analyses once", async () => {
    FakeAnalyzer.calls = 0;
    const c = makeClient(true);
    const d = await ingest(c);
    expect(d.analyzed && d.background_removed && !d.needs_review).toBe(true);
    expect(d.item.category).toBe("outerwear");
    expect(d.item.subcategory).toBe("jacket");
    expect(d.item.dominant_color).toBe("blue");
    expect(d.item.processed_image_path).toMatch(/-cutout\.png$/);
    expect(d.item.slot).toBe("outerwear");
    expect(d.item.warmth).toBeGreaterThan(0);
    expect(d.item.formality_label).toBe("casual");
    expect(FakeAnalyzer.calls).toBe(1);
    await c.request("GET", `/wardrobe/${d.item.id}`);
    expect(FakeAnalyzer.calls).toBe(1);
  });
});

describe("outfits", () => {
  it("generates only from the user's wardrobe with reasons and unique names", async () => {
    const c = makeClient(false);
    const ids = new Set((await c.request("GET", "/wardrobe")).data.map((i: { id: string }) => i.id));
    const body = await c.request("POST", "/outfits/generate", { occasion: "casual", temperature_c: 5, weather: "cloudy", style: "minimal" });
    expect(body.success).toBe(true);
    const outfits = body.data;
    expect(outfits.length).toBeGreaterThanOrEqual(3);
    expect(outfits.length).toBeLessThanOrEqual(5);
    expect(new Set(outfits.map((o: { name: string }) => o.name)).size).toBe(outfits.length);
    for (const o of outfits) {
      expect(o.reasons.length).toBeGreaterThan(0);
      expect(o.temperature_c).toBe(5);
      for (const i of o.items) expect(ids.has(i.item.id)).toBe(true);
      const slots = new Set(o.items.map((i: { slot: string }) => i.slot));
      expect(slots.has("shoes") && (slots.has("top") || slots.has("dress"))).toBe(true);
    }
    expect((await c.request("GET", `/outfits/${outfits[0].id}`)).data.id).toBe(outfits[0].id);
  });

  it("count + exclude give new looks", async () => {
    const c = makeClient(false);
    const first = await c.request("POST", "/outfits/generate", { occasion: "casual", temperature_c: 18, count: 8 });
    expect(first.success).toBe(true);
    const seen = first.data.map((o: { items: Array<{ item: { id: string } }> }) => o.items.map((i) => i.item.id));
    const more = await c.request("POST", "/outfits/generate", { occasion: "casual", temperature_c: 18, count: 8, exclude: seen });
    if (more.success) {
      const seenKeys = new Set(seen.map((s: string[]) => [...s].sort().join("|")));
      for (const o of more.data) expect(seenKeys.has(o.items.map((i: { item: { id: string } }) => i.item.id).sort().join("|"))).toBe(false);
    } else expect(more.error.code).toBe("empty_wardrobe");
  });

  it("evaluates match / mismatch", async () => {
    const c = makeClient(false);
    const items = Object.fromEntries((await c.request("GET", "/wardrobe")).data.map((i: { label: string; id: string }) => [i.label, i.id]));
    const good = await c.request("POST", "/outfits/evaluate", { item_ids: [items["white t-shirt"], items["black wide-leg trousers"], items["white sneakers"]], occasion: "casual", temperature_c: 18 });
    expect(["match", "almost"]).toContain(good.data.verdict);
    const bad = await c.request("POST", "/outfits/evaluate", { item_ids: [items["gray sports top"], items["black leggings"], items["black sandals"]], occasion: "formal" });
    expect(bad.data.verdict).toBe("mismatch");
    expect(bad.data.issues.length).toBeGreaterThan(0);
  });

  it("saves and lists combinations", async () => {
    const c = makeClient(false);
    const items = Object.fromEntries((await c.request("GET", "/wardrobe")).data.map((i: { label: string; id: string }) => [i.label, i.id]));
    const ids = [items["white t-shirt"], items["black wide-leg trousers"], items["white sneakers"]];
    const created = await c.request("POST", "/outfits", { item_ids: ids, occasion: "casual", name: "Monochrome" });
    expect(created.status).toBe(201);
    expect(created.data.saved && created.data.name).toBe("Monochrome");
    expect((await c.request("GET", "/outfits/saved")).data.map((o: { id: string }) => o.id)).toEqual([created.data.id]);
    expect((await c.request("PATCH", `/outfits/${created.data.id}`, { saved: false })).data.saved).toBe(false);
    expect((await c.request("GET", "/outfits/saved")).data).toEqual([]);
    expect((await c.request("POST", "/outfits", { item_ids: [ids[0]], occasion: "casual" })).status).toBe(422);
  });
});

describe("try-on jobs", () => {
  beforeEach(() => {
    FakeTryOn.calls = [];
    FakeAnalyzer.calls = 0;
  });

  it("requires a photo and a dressable garment", async () => {
    const c = makeClient(false);
    const items = (await c.request("GET", "/wardrobe")).data;
    const noPhoto = await c.request("POST", "/try-on/jobs", { item_ids: [items[0].id] });
    expect(noPhoto.status).toBe(400);
    expect(noPhoto.error.code).toBe("missing_photo");
    await addPhoto(c);
    const shoes = items.find((i: { category: string }) => i.category === "shoes");
    const r = await c.request("POST", "/try-on/jobs", { item_ids: [shoes.id] });
    expect(r.error.code).toBe("unsupported_garments");
  });

  it("mock provider fails the job gracefully", async () => {
    const c = makeClient(false);
    await addPhoto(c);
    const top = (await ingest(c)).item;
    const r = await c.request("POST", "/try-on/jobs", { item_ids: [top.id] });
    expect(r.status).toBe(202);
    expect("cache_key" in r.data || "provider" in r.data).toBe(false);
    await c.drain();
    const polled = await c.request("GET", `/try-on/jobs/${r.data.id}`);
    expect(polled.data.status).toBe("failed");
    expect(polled.data.error).toContain("not enabled");
  });

  it("completes, caches, swaps, and batch-looks-up", async () => {
    const c = makeClient(true);
    await addPhoto(c);
    const jacket = (await ingest(c, "jacket.jpg")).item;
    const other = (await ingest(c, "other.jpg")).item;
    const shoes = (await c.request("GET", "/wardrobe")).data.find((i: { category: string }) => i.category === "shoes");

    const r = await c.request("POST", "/try-on/jobs", { item_ids: [jacket.id, shoes.id] });
    expect(r.status).toBe(202);
    await c.drain();
    const done = await c.request("GET", `/try-on/jobs/${r.data.id}`);
    expect(done.data.status).toBe("completed");
    expect(done.data.progress).toBe(100);
    expect(done.data.result_image_url).toContain("/files/try-on/");
    expect(done.data.applied).toEqual([jacket.label]);
    expect(done.data.skipped).toContain(shoes.label);
    expect(FakeTryOn.calls).toHaveLength(1);

    // the signed URL serves the bytes
    const url = new URL(done.data.result_image_url);
    const served = await c.app.request(url.pathname + url.search, {}, env, c.ctx);
    expect(served.status).toBe(200);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
    const tampered = await c.app.request(url.pathname + "?exp=1&sig=bad", {}, env, c.ctx);
    expect(tampered.status).toBe(404);

    // same photo + items → cached, no second provider call
    const again = await c.request("POST", "/try-on/jobs", { item_ids: [shoes.id, jacket.id] });
    expect(again.data.id).toBe(r.data.id);
    expect(FakeTryOn.calls).toHaveLength(1);
    expect((await c.request("GET", `/try-on/cached?item_ids=${jacket.id},${shoes.id}`)).data.id).toBe(r.data.id);

    // swap → new job, analysis untouched
    const before = FakeAnalyzer.calls;
    const swapped = await c.request("POST", "/try-on/jobs", { item_ids: [other.id, shoes.id] });
    expect(swapped.data.id).not.toBe(r.data.id);
    await c.drain();
    expect((await c.request("GET", `/try-on/jobs/${swapped.data.id}`)).data.status).toBe("completed");
    expect(FakeTryOn.calls).toHaveLength(2);
    expect(FakeAnalyzer.calls).toBe(before);

    const batch = await c.request("POST", "/try-on/cached", { outfits: [{ id: "a", item_ids: [jacket.id, shoes.id] }, { id: "b", item_ids: [jacket.id] }] });
    expect(batch.data.a.status).toBe("completed");
    expect(batch.data.b).toBeNull();
    expect((await c.request("GET", "/try-on/jobs")).data.map((j: { id: string }) => j.id).slice(0, 2)).toEqual([swapped.data.id, r.data.id]);
  });

  it("404s an unknown job", async () => {
    const c = makeClient(false);
    expect((await c.request("GET", "/try-on/jobs/nope")).status).toBe(404);
  });
});

describe("photos + uploads", () => {
  it("uploads, serves and records body photos", async () => {
    const c = makeClient(false);
    const up = await c.file("/uploads/body-photos", PNG, "image/png", "front.png");
    expect(up.data.path.startsWith(`${DEMO_USER}/`)).toBe(true);
    const url = new URL(up.data.url);
    const served = await c.app.request(url.pathname + url.search, {}, env, c.ctx);
    expect(served.status).toBe(200);
    const saved = await c.request("POST", "/body/photos", { front_image_path: up.data.path });
    expect(saved.data.front_image_url).toBe(up.data.url);
    const again = await c.request("POST", "/body/photos", { back_image_path: up.data.path });
    expect(again.data.id).toBe(saved.data.id);
    expect(again.data.front_image_url).toBe(up.data.url);
    expect((await c.request("GET", "/body/profile")).data.id).toBe(saved.data.id);
  });

  it("rejects foreign paths and unknown buckets", async () => {
    const c = makeClient(false);
    expect((await c.request("POST", "/body/photos", { front_image_path: "someone-else/front.jpg" })).status).toBe(403);
    expect((await c.file("/uploads/try-on", JPEG, "image/jpeg")).status).toBe(404);
  });
});
