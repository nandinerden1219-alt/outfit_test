/**
 * Outfit API on Cloudflare Workers (Hono + D1 + R2 + Queues).
 * Same contract as before: every response is `{ success, data, error }`.
 */

import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { currentUserFromHeader, type CurrentUser } from "./auth";
import { type Env, type TryOnQueueMessage } from "./env";
import { AppError, assertOwnerPath, failure, notFound, success } from "./errors";
import { buildServices, ensureUser, type Overrides, type Services } from "./services/container";
import type { ImageInput } from "./services/providers";
import { assertBucket, EXTENSIONS, MemoryStorage } from "./storage/storage";

type Vars = { services: Services; user: CurrentUser };
type AppEnv = { Bindings: Env; Variables: Vars };

const OCCASIONS = ["work", "school", "casual", "date", "party", "exercise", "travel", "formal", "other"] as const;
const WEATHERS = ["sunny", "cloudy", "rainy", "snowy", "windy"] as const;
const CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"] as const;
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

// ---------------------------------------------------------------- app factory

export function createApp(overrides: Overrides = {}) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const services = buildServices(c.env, overrides);
    c.set("services", services);
    await cors({ origin: services.settings.corsOrigins, credentials: true })(c, next);
  });

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(failure(err.code, err.message, err.details), err.status as 400);
    if (err instanceof z.ZodError) return c.json(failure("validation_error", "Request validation failed.", err.issues), 422);
    console.error(err);
    return c.json(failure("internal_error", "Something went wrong."), 500);
  });
  app.notFound((c) => c.json(failure("not_found", "Not found."), 404));

  app.get("/health", (c) => c.json(success({ status: "ok", service: "outfit-api" })));

  // Signed image links (R2 is private; demo bytes live in memory).
  app.get("/files/:bucket/:path{.+}", async (c) => {
    const { services } = c.var;
    const bucket = c.req.param("bucket");
    assertBucket(bucket);
    const path = c.req.param("path").split("/").map(decodeURIComponent).join("/");
    if (!(await services.storage.verifyUrl(bucket, path, c.req.query("exp"), c.req.query("sig")))) throw notFound();
    const file = services.storage instanceof MemoryStorage ? services.storage.get(bucket, path) : await services.storage.download(bucket, path).catch(() => null);
    if (!file) throw notFound();
    return new Response(file.data, { headers: { "content-type": file.contentType, "cache-control": "private, max-age=3600" } });
  });

  // Everything below needs a user.
  const api = new Hono<AppEnv>();
  api.use("*", async (c, next) => {
    const user = await currentUserFromHeader(c.req.header("authorization"), c.var.services.settings);
    c.set("user", user);
    await ensureUser(c.var.services, user);
    await next();
  });

  registerMe(api);
  registerWardrobe(api);
  registerOutfits(api);
  registerTryOn(api);
  registerBody(api);
  registerUploads(api);
  registerWeather(api);
  app.route("/", api);
  return app;
}

// ---------------------------------------------------------------- helpers

async function readUpload(c: Context<AppEnv>, field = "image"): Promise<ImageInput> {
  const { settings } = c.var.services;
  const form = await c.req.formData().catch(() => null);
  const file = form?.get(field);
  if (!(file instanceof File)) throw new AppError("invalid_image", `${field}: upload a JPEG, PNG or WebP image.`, 415);
  const mimeType = (file.type || "").toLowerCase();
  if (!settings.allowedImageTypes.includes(mimeType)) throw new AppError("invalid_image", `${field}: upload a JPEG, PNG or WebP image.`, 415);
  if (file.size > settings.maxImageBytes) throw new AppError("image_too_large", `${field}: images must be 10 MB or smaller.`, 413);
  if (file.size === 0) throw new AppError("invalid_image", `${field}: the file is empty.`, 400);
  return { data: await file.arrayBuffer(), mimeType };
}

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => schema.parse(body);
const json = (c: Context<AppEnv>) => c.req.json().catch(() => ({}));

// ---------------------------------------------------------------- /me

const profileInput = z.object({
  height_cm: z.number().min(100).max(250).nullable().optional(),
  weight_kg: z.number().min(30).max(300).nullable().optional(),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).nullable().optional(),
  bust_cm: z.number().nullable().optional(),
  waist_cm: z.number().nullable().optional(),
  hip_cm: z.number().nullable().optional(),
  shoulder_cm: z.number().nullable().optional(),
  inseam_cm: z.number().nullable().optional(),
  style_preferences: z.array(z.string().max(30)).max(12).optional(),
  favorite_colors: z.array(z.string().max(30)).max(12).optional(),
  avoid_colors: z.array(z.string().max(30)).max(12).optional(),
  preferred_fit: z.enum(["fitted", "regular", "relaxed", "oversized"]).nullable().optional(),
  skin_tone: z.string().max(30).nullable().optional(),
  location_name: z.string().max(120).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
  complete_onboarding: z.boolean().optional(),
});

function registerMe(api: Hono<AppEnv>) {
  api.get("/me", async (c) => {
    const { services, user } = c.var;
    const [row, profile] = await Promise.all([services.repos.users.getUser(user.id), services.repos.users.getProfile(user.id)]);
    return c.json(success({ id: user.id, email: user.email, role: user.role, user: row, profile }));
  });
  api.put("/me/profile", async (c) => {
    const { services, user } = c.var;
    const { complete_onboarding, ...patch } = parse(profileInput, await json(c));
    if (services.settings.demoMode) throw new AppError("demo_mode", "Demo mode — changes are not saved.", 403);
    const profile = await services.repos.users.upsertProfile(user.id, { ...patch, ...(complete_onboarding ? { onboarding_completed_at: new Date().toISOString() } : {}) });
    return c.json(success(profile));
  });
  api.patch("/me", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ display_name: z.string().min(1).max(60).nullable().optional(), avatar_url: z.string().url().nullable().optional() }), await json(c));
    if (services.settings.demoMode) throw new AppError("demo_mode", "Demo mode — changes are not saved.", 403);
    return c.json(success(await services.repos.users.updateUser(user.id, body)));
  });
}

// ---------------------------------------------------------------- /wardrobe

const itemFields = {
  name: z.string().max(80).nullable().optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.string().max(60).nullable().optional(),
  pattern: z.string().max(30).nullable().optional(),
  dominant_color: z.string().max(30).nullable().optional(),
  secondary_colors: z.array(z.string()).max(3).optional(),
  material: z.string().max(40).nullable().optional(),
  season: z.array(z.enum(SEASONS)).optional(),
  warmth: z.number().int().min(1).max(5).nullable().optional(),
  style: z.array(z.string()).max(4).optional(),
  fit: z.string().max(20).nullable().optional(),
  formality: z.number().int().min(1).max(5).nullable().optional(),
  occasions: z.array(z.enum(OCCASIONS)).optional(),
  layering: z.boolean().optional(),
  rain_protection: z.boolean().optional(),
  wind_protection: z.boolean().optional(),
  gender_suitability: z.string().max(20).nullable().optional(),
  brand: z.string().max(60).nullable().optional(),
  size: z.string().max(20).nullable().optional(),
  favorite: z.boolean().optional(),
  available: z.boolean().optional(),
  needs_review: z.boolean().optional(),
};
const itemCreate = z.object({
  ...itemFields,
  image_path: z.string().min(3).max(300),
  original_image_path: z.string().max(300).nullable().optional(),
  processed_image_path: z.string().max(300).nullable().optional(),
  background_removed: z.boolean().optional(),
  category: z.enum(CATEGORIES),
});
const itemUpdate = z.object(itemFields);

function registerWardrobe(api: Hono<AppEnv>) {
  api.get("/wardrobe", async (c) => c.json(success(await c.var.services.wardrobe.toApiMany(await c.var.services.wardrobe.list(c.var.user.id)))));
  api.post("/wardrobe/ingest", async (c) => {
    const { services, user } = c.var;
    const image = await readUpload(c);
    const form = await c.req.formData();
    const analyze = String(form.get("analyze") ?? "true") !== "false";
    const r = await services.wardrobe.ingest(user.id, image, analyze);
    return c.json(success({ item: await services.wardrobe.toApi(r.item), analyzed: r.analyzed, background_removed: r.background_removed, needs_review: r.needs_review }), 201);
  });
  api.post("/wardrobe/analyze", async (c) => {
    const r = await c.var.services.wardrobe.analyze(await readUpload(c));
    return c.json(success({ analysis: r.analysis, needs_review: r.needs_review, model: "gemini" }));
  });
  api.post("/wardrobe", async (c) => {
    const { services, user } = c.var;
    const body = parse(itemCreate, await json(c));
    const item = await services.wardrobe.create(user.id, body);
    return c.json(success(await services.wardrobe.toApi(item)), 201);
  });
  api.get("/wardrobe/:id", async (c) => c.json(success(await c.var.services.wardrobe.toApi(await c.var.services.wardrobe.get(c.var.user.id, c.req.param("id"))))));
  api.patch("/wardrobe/:id", async (c) => {
    const { services, user } = c.var;
    const body = parse(itemUpdate, await json(c));
    return c.json(success(await services.wardrobe.toApi(await services.wardrobe.update(user.id, c.req.param("id"), body))));
  });
  api.delete("/wardrobe/:id", async (c) => {
    await c.var.services.wardrobe.delete(c.var.user.id, c.req.param("id"));
    return c.json(success({ deleted: c.req.param("id") }));
  });
}

// ---------------------------------------------------------------- /outfits

const generateInput = z.object({
  occasion: z.enum(OCCASIONS).default("casual"),
  style: z.string().max(30).nullable().optional(),
  weather: z.enum(WEATHERS).nullable().optional(),
  temperature_c: z.number().min(-50).max(60),
  count: z.number().int().min(3).max(12).default(5),
  exclude: z.array(z.array(z.string()).max(8)).max(40).default([]),
});

function registerOutfits(api: Hono<AppEnv>) {
  api.post("/outfits/generate", async (c) => {
    const { services, user } = c.var;
    const body = parse(generateInput, await json(c));
    const style = body.style ? body.style.trim().toLowerCase().replace(/[ -]/g, "_") : null;
    const outfits = await services.outfits.generate(user.id, { occasion: body.occasion, style, weather: body.weather ?? null, temperature_c: body.temperature_c, count: body.count, exclude: body.exclude });
    return c.json(success(await Promise.all(outfits.map((o) => services.outfits.toApi(o)))));
  });
  api.post("/outfits/evaluate", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ item_ids: z.array(z.string()).min(1).max(8), occasion: z.enum(OCCASIONS).default("casual"), weather: z.enum(WEATHERS).nullable().optional(), temperature_c: z.number().min(-50).max(60).default(18) }), await json(c));
    const ev = await services.outfits.evaluate(user.id, body.item_ids, { occasion: body.occasion, style: null, weather: body.weather ?? null, temperature_c: body.temperature_c });
    return c.json(success({ verdict: ev.verdict, reasons: ev.reasons, issues: ev.issues }));
  });
  api.post("/outfits", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ item_ids: z.array(z.string()).min(2).max(8), occasion: z.enum(OCCASIONS).default("casual"), name: z.string().max(60).nullable().optional() }), await json(c));
    return c.json(success(await services.outfits.toApi(await services.outfits.saveCombination(user.id, body.item_ids, body.occasion, body.name ?? null))), 201);
  });
  api.get("/outfits/saved", async (c) => {
    const { services, user } = c.var;
    return c.json(success(await Promise.all((await services.outfits.listSaved(user.id)).map((o) => services.outfits.toApi(o)))));
  });
  api.get("/outfits/:id", async (c) => c.json(success(await c.var.services.outfits.toApi(await c.var.services.outfits.get(c.var.user.id, c.req.param("id"))))));
  api.patch("/outfits/:id", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ saved: z.boolean() }), await json(c));
    return c.json(success(await services.outfits.toApi(await services.outfits.setSaved(user.id, c.req.param("id"), body.saved))));
  });
}

// ---------------------------------------------------------------- /try-on

function registerTryOn(api: Hono<AppEnv>) {
  api.post("/try-on/jobs", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ item_ids: z.array(z.string()).min(1).max(8), outfit_id: z.string().nullable().optional() }), await json(c));
    const [job, created] = await services.tryOnJobs.start(user.id, body.item_ids, body.outfit_id ?? null);
    if (created) {
      const message: TryOnQueueMessage = { jobId: job.id, userId: user.id };
      if (c.env.TRYON_QUEUE) await c.env.TRYON_QUEUE.send(message);
      else c.executionCtx.waitUntil(services.tryOnJobs.run(job.id, user.id));
    }
    return c.json(success(await services.tryOnJobs.toApi(job)), 202);
  });
  api.get("/try-on/jobs", async (c) => {
    const { services, user } = c.var;
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20) || 20));
    return c.json(success(await Promise.all((await services.tryOnJobs.recent(user.id, limit)).map((j) => services.tryOnJobs.toApi(j)))));
  });
  api.get("/try-on/cached", async (c) => {
    const { services, user } = c.var;
    const ids = (c.req.query("item_ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const job = ids.length ? await services.tryOnJobs.cachedForItems(user.id, ids) : null;
    return c.json(success(job ? await services.tryOnJobs.toApi(job) : null));
  });
  api.post("/try-on/cached", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ outfits: z.array(z.object({ id: z.string(), item_ids: z.array(z.string()).min(1).max(8) })).max(40) }), await json(c));
    const out: Record<string, unknown> = {};
    for (const entry of body.outfits) {
      const job = await services.tryOnJobs.cachedForItems(user.id, entry.item_ids);
      out[entry.id] = job ? await services.tryOnJobs.toApi(job) : null;
    }
    return c.json(success(out));
  });
  api.get("/try-on/jobs/:id", async (c) => c.json(success(await c.var.services.tryOnJobs.toApi(await c.var.services.tryOnJobs.get(c.var.user.id, c.req.param("id"))))));
}

// ---------------------------------------------------------------- /body

function registerBody(api: Hono<AppEnv>) {
  api.post("/body/photos", async (c) => {
    const { services, user } = c.var;
    const body = parse(z.object({ front_image_path: z.string().nullable().optional(), side_image_path: z.string().nullable().optional(), back_image_path: z.string().nullable().optional() }), await json(c));
    for (const p of Object.values(body)) if (p) assertOwnerPath(user.id, p);
    if (!Object.values(body).some(Boolean)) throw new AppError("missing_photos", "Provide at least one photo path.");
    return c.json(success(await services.body.toApi(await services.body.savePhotos(user.id, body))));
  });
  api.get("/body/profile", async (c) => {
    const { services, user } = c.var;
    const p = await services.body.latest(user.id);
    return c.json(success(p ? await services.body.toApi(p) : null));
  });
}

// ---------------------------------------------------------------- /uploads

const UPLOAD_BUCKETS = ["wardrobe", "body-photos"] as const;

function registerUploads(api: Hono<AppEnv>) {
  api.post("/uploads/:bucket", async (c) => {
    const { services, user } = c.var;
    const bucket = c.req.param("bucket");
    assertBucket(bucket);
    if (!(UPLOAD_BUCKETS as readonly string[]).includes(bucket)) throw notFound("Uploads are not accepted for this bucket.");
    const image = await readUpload(c);
    const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[image.mimeType] ?? "jpg"}`;
    await services.storage.upload(bucket, path, image.data, image.mimeType);
    return c.json(success({ bucket, path, url: await services.storage.signedUrl(bucket, path) }));
  });
}

// ---------------------------------------------------------------- /weather

function registerWeather(api: Hono<AppEnv>) {
  api.get("/weather", async (c) => {
    const { services, user } = c.var;
    const lat = c.req.query("latitude");
    const lon = c.req.query("longitude");
    const refresh = c.req.query("refresh") === "true";
    const snapshot = lat && lon ? await services.weather.forLocation(user.id, Number(lat), Number(lon), null, null, refresh) : await services.weather.forUser(user.id, refresh);
    return c.json(success(services.weather.toApi(snapshot)));
  });
}

// ---------------------------------------------------------------- worker entry

const app = createApp();

export default {
  fetch: app.fetch,
  /** Queue consumer: one try-on job per message (up to 15 minutes each). */
  async queue(batch: MessageBatch<TryOnQueueMessage>, env: Env): Promise<void> {
    const services = buildServices(env);
    for (const message of batch.messages) {
      await services.tryOnJobs.run(message.body.jobId, message.body.userId);
      message.ack();
    }
  },
};
