import { describe, expect, it } from "@jest/globals";

import type { OccasionType, SeasonType } from "@outfit/shared";

import demo from "../../../apps/api/src/demo/demo-data.json";
import {
  WEIGHTS,
  buildContext,
  evaluateCombination,
  label,
  rankCandidates,
  scoreCandidate,
  type Candidate,
  type EngineItem,
  type EngineProfile,
  type ScoredCandidate,
  type WeatherSnapshot,
} from "../src";

const wardrobe = () => (demo.wardrobe as unknown as EngineItem[]).map((i) => ({ ...i }));
const profile = demo.profile as unknown as EngineProfile;

function snapshot(feelsLike: number, opts: { wind?: number; code?: number; rainProb?: number } = {}): WeatherSnapshot {
  const now = new Date().toISOString();
  return {
    id: null,
    location: null,
    latitude: 47.9,
    longitude: 106.9,
    temperature: feelsLike + 2,
    feels_like: feelsLike,
    temp_min: null,
    temp_max: null,
    humidity: null,
    wind_speed: opts.wind ?? 5,
    precipitation: 0,
    precipitation_probability: opts.rainProb ?? 0,
    weather_code: opts.code ?? 1,
    hourly: [],
    daily: [],
    provider: "test",
    recorded_at: now,
    expires_at: now,
  };
}

const labels = (s: ScoredCandidate) => new Set(Object.values(s.candidate.items).map((i) => label(i)));

function run(items: EngineItem[], feelsLike: number, occasion: OccasionType, season: SeasonType, opts: Parameters<typeof snapshot>[1] = {}) {
  const ctx = buildContext(snapshot(feelsLike, opts));
  const { scored, assessments } = rankCandidates(items, ctx, occasion, season, profile, null);
  return { scored, assessments, ctx };
}

describe("weather", () => {
  it("extreme cold requires a coat and a layer, never bare legs or sandals", () => {
    const { scored, ctx } = run(wardrobe(), -22, "casual", "winter");
    expect(ctx.band.name).toBe("extreme_cold");
    expect(scored.length).toBeGreaterThan(0);
    const best = scored[0]!.candidate.items;
    expect(best.outerwear && label(best.outerwear)).toBe("camel wool coat");
    expect(best.layer).toBeDefined();
    for (const s of scored) {
      expect(labels(s).has("beige linen shorts")).toBe(false);
      expect(labels(s).has("black sandals")).toBe(false);
      expect(labels(s).has("black slip dress")).toBe(false);
    }
  });

  it("excludes sandals in snow", () => {
    const { scored, assessments } = run(wardrobe(), 1, "casual", "winter", { code: 73 });
    const sandals = assessments.find((a) => label(a.item) === "black sandals")!;
    expect(sandals.excluded).not.toBeNull();
    expect(scored.every((s) => !labels(s).has("black sandals"))).toBe(true);
  });

  it("warm day has no outerwear or layer", () => {
    const { scored, ctx } = run(wardrobe(), 27, "casual", "summer");
    expect(ctx.band.name).toBe("warm");
    expect(scored.length).toBeGreaterThan(0);
    for (const s of scored) {
      expect(s.candidate.items.outerwear).toBeUndefined();
      expect(s.candidate.items.layer).toBeUndefined();
    }
  });

  it("strong wind rewards wind protection", () => {
    const calm = run(wardrobe(), 8, "casual", "autumn", { wind: 5 });
    const windy = run(wardrobe(), 8, "casual", "autumn", { wind: 40 });
    expect(windy.ctx.strongWind).toBe(true);
    const outer = windy.scored[0]!.candidate.items.outerwear;
    expect(outer?.wind_protection).toBe(true);
    expect(windy.scored[0]!.reasons.some((r) => r.includes("Wind-resistant"))).toBe(true);
    expect(calm.scored.length).toBeGreaterThan(0);
  });
});

describe("occasion", () => {
  it("exercise only uses sporty pieces", () => {
    const { scored } = run(wardrobe(), 15, "exercise", "spring");
    expect(scored.length).toBeGreaterThan(0);
    for (const s of scored) {
      for (const [slot, item] of Object.entries(s.candidate.items)) {
        if (slot === "top" || slot === "bottom" || slot === "shoes") expect(item.style).toContain("sporty");
      }
    }
  });

  it("formal events exclude t-shirts, jeans and sneakers", () => {
    const { scored } = run(wardrobe(), 18, "formal", "spring");
    expect(scored.length).toBeGreaterThan(0);
    for (const s of scored) for (const bad of ["white t-shirt", "black t-shirt", "straight blue jeans", "white sneakers"]) expect(labels(s).has(bad)).toBe(false);
  });

  it("work never recommends shorts or a hoodie", () => {
    const { scored } = run(wardrobe(), 24, "work", "summer");
    expect(scored.length).toBeGreaterThan(0);
    for (const s of scored) {
      expect(labels(s).has("beige linen shorts")).toBe(false);
      expect(labels(s).has("gray hoodie")).toBe(false);
    }
  });
});

describe("availability & scoring", () => {
  it("skips unavailable items", () => {
    const items = wardrobe();
    for (const i of items) if (i.category === "shoes" && label(i) !== "brown leather boots") i.available = false;
    const { scored } = run(items, 3, "casual", "autumn");
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.every((s) => label(s.candidate.items.shoes!) === "brown leather boots")).toBe(true);
  });

  it("scores are bounded, sorted and equal the weighted breakdown", () => {
    const { scored } = run(wardrobe(), 10, "date", "autumn");
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.every((s) => s.score >= 0 && s.score <= 100)).toBe(true);
    const scores = scored.map((s) => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const b = scored[0]!.breakdown;
    const expected = b.weather * WEIGHTS.weather + b.occasion * WEIGHTS.occasion + b.style * WEIGHTS.style + b.color * WEIGHTS.color + b.fit * WEIGHTS.fit + b.user_preference * WEIGHTS.user_preference;
    expect(Math.abs(scored[0]!.score - expected)).toBeLessThan(0.2);
  });

  it("avoided colours lower the colour score", () => {
    const items = wardrobe();
    const ctx = buildContext(snapshot(10));
    const yellow = { ...items[0]!, id: "yellow-top", dominant_color: "yellow" };
    const base: Candidate = { items: { top: items[0]!, bottom: items[8]!, shoes: items[15]! } };
    const withYellow: Candidate = { items: { ...base.items, top: yellow } };
    const a = scoreCandidate(base, ctx, "casual", profile, null);
    const b = scoreCandidate(withYellow, ctx, "casual", profile, null);
    expect(b.breakdown.color).toBeLessThan(a.breakdown.color);
  });

  it("an empty wardrobe yields nothing", () => {
    const { scored, assessments } = rankCandidates([], buildContext(snapshot(10)), "casual", "autumn", profile, null);
    expect(scored).toEqual([]);
    expect(assessments).toEqual([]);
  });

  it("exclude drops combinations already shown", () => {
    const first = run(wardrobe(), 10, "casual", "autumn").scored;
    const seen = first.map((s) => Object.values(s.candidate.items).map((i) => i.id));
    const ctx = buildContext(snapshot(10));
    const { scored } = rankCandidates(wardrobe(), ctx, "casual", "autumn", profile, null, { exclude: seen, limit: 8 });
    const seenKeys = new Set(seen.map((ids) => [...ids].sort().join("|")));
    for (const s of scored) expect(seenKeys.has(Object.values(s.candidate.items).map((i) => i.id).sort().join("|"))).toBe(false);
  });
});

describe("closet evaluation", () => {
  const byLabel = () => Object.fromEntries(wardrobe().map((i) => [label(i), i]));

  it("flags missing shoes", () => {
    const items = wardrobe();
    const ev = evaluateCombination([items[0]!, items[8]!], buildContext(snapshot(12)), "casual", profile, null);
    expect(ev.verdict).toBe("mismatch");
    expect(ev.issues).toContain("Add shoes");
  });

  it("a good combination is a match", () => {
    const b = byLabel();
    const ev = evaluateCombination([b["white t-shirt"]!, b["black wide-leg trousers"]!, b["white sneakers"]!, b["black oversized jacket"]!], buildContext(snapshot(12)), "casual", profile, null);
    expect(ev.verdict).toBe("match");
  });

  it("sandals in snow are a mismatch", () => {
    const b = byLabel();
    const ev = evaluateCombination([b["beige knit sweater"]!, b["straight blue jeans"]!, b["black sandals"]!, b["camel wool coat"]!], buildContext(snapshot(-3, { code: 71 })), "casual", profile, null);
    expect(ev.verdict).toBe("mismatch");
    expect(ev.issues.some((i) => i.includes("sandals"))).toBe(true);
  });
});
