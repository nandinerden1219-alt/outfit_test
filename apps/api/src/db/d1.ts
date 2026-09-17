/** Cloudflare D1 repositories. JSON columns are encoded/decoded here; services see plain objects. */

import { isActiveJob, newId, nowIso, type BodyProfile, type Outfit, type Profile, type TryOnJob, type User, type WardrobeItem, type WeatherSnapshot } from "../domain";
import type { BodyRepository, OutfitRepository, ProfilePatch, Repositories, TryOnJobRepository, UserRepository, WardrobeRepository, WeatherRepository } from "./repositories";

type Row = Record<string, unknown>;

const json = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};
const bool = (v: unknown) => v === 1 || v === true || v === "1";
const enc = (v: unknown) => JSON.stringify(v ?? null);

// ---------------------------------------------------------------- row mappers

const ITEM_JSON = ["secondary_colors", "season", "style", "occasions"] as const;
const ITEM_BOOL = ["background_removed", "layering", "rain_protection", "wind_protection", "favorite", "available", "needs_review"] as const;

function itemFromRow(r: Row): WardrobeItem {
  const out = { ...r } as Record<string, unknown>;
  for (const k of ITEM_JSON) out[k] = json(r[k], []);
  for (const k of ITEM_BOOL) out[k] = bool(r[k]);
  out.ai_raw = json(r.ai_raw, null);
  return out as unknown as WardrobeItem;
}

function itemToRow(data: Partial<WardrobeItem>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "id" || k === "user_id" || k === "created_at") continue;
    if ((ITEM_JSON as readonly string[]).includes(k)) out[k] = enc(v ?? []);
    else if ((ITEM_BOOL as readonly string[]).includes(k)) out[k] = v ? 1 : 0;
    else if (k === "ai_raw") out[k] = v == null ? null : enc(v);
    else out[k] = v ?? null;
  }
  return out;
}

const PROFILE_JSON = ["style_preferences", "favorite_colors", "avoid_colors"] as const;

function profileFromRow(r: Row): Profile {
  const out = { ...r } as Record<string, unknown>;
  for (const k of PROFILE_JSON) out[k] = json(r[k], []);
  return out as unknown as Profile;
}

function bodyFromRow(r: Row): BodyProfile {
  return r as unknown as BodyProfile;
}

function jobFromRow(r: Row): TryOnJob {
  return { ...r, item_ids: json(r.item_ids, []), applied: json(r.applied, []), skipped: json(r.skipped, []) } as unknown as TryOnJob;
}

// ---------------------------------------------------------------- helpers

function update(db: D1Database, table: string, id: string, data: Row): D1PreparedStatement | null {
  const keys = Object.keys(data);
  if (!keys.length) return null;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  return db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).bind(...keys.map((k) => data[k] ?? null), id);
}

function insert(db: D1Database, table: string, data: Row): D1PreparedStatement {
  const keys = Object.keys(data);
  return db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).bind(...keys.map((k) => data[k] ?? null));
}

// ---------------------------------------------------------------- repositories

class Users implements UserRepository {
  constructor(private db: D1Database) {}
  async ensureUser(u: { id: string; email: string; display_name?: string | null }) {
    const now = nowIso();
    await this.db
      .prepare("INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = COALESCE(users.display_name, excluded.display_name), updated_at = excluded.updated_at")
      .bind(u.id, u.email, u.display_name ?? null, now, now)
      .run();
    return (await this.getUser(u.id)) as User;
  }
  async getUser(id: string) {
    return (await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<Row>()) as User | null;
  }
  async updateUser(id: string, patch: { display_name?: string | null; avatar_url?: string | null }) {
    const stmt = update(this.db, "users", id, { ...patch, updated_at: nowIso() });
    if (stmt) await stmt.run();
    return this.getUser(id);
  }
  async getProfile(userId: string) {
    const row = await this.db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first<Row>();
    return row ? profileFromRow(row) : null;
  }
  async upsertProfile(userId: string, patch: ProfilePatch) {
    const now = nowIso();
    const existing = await this.getProfile(userId);
    const data: Row = {};
    for (const [k, v] of Object.entries(patch)) data[k] = (PROFILE_JSON as readonly string[]).includes(k) ? enc(v ?? []) : (v ?? null);
    if (existing) {
      const stmt = update(this.db, "profiles", existing.id, { ...data, updated_at: now });
      if (stmt) await stmt.run();
    } else {
      await insert(this.db, "profiles", { id: newId(), user_id: userId, style_preferences: "[]", favorite_colors: "[]", avoid_colors: "[]", ...data, created_at: now, updated_at: now }).run();
    }
    return (await this.getProfile(userId)) as Profile;
  }
}

class Wardrobe implements WardrobeRepository {
  constructor(private db: D1Database) {}
  async listItems(userId: string) {
    const { results } = await this.db.prepare("SELECT * FROM wardrobe_items WHERE user_id = ? ORDER BY created_at DESC, id").bind(userId).all<Row>();
    return results.map(itemFromRow);
  }
  async getItem(userId: string, id: string) {
    const row = await this.db.prepare("SELECT * FROM wardrobe_items WHERE user_id = ? AND id = ?").bind(userId, id).first<Row>();
    return row ? itemFromRow(row) : null;
  }
  async createItem(userId: string, data: Partial<WardrobeItem> & { image_path: string; category: WardrobeItem["category"] }) {
    const id = newId();
    const now = nowIso();
    await insert(this.db, "wardrobe_items", { id, user_id: userId, secondary_colors: "[]", season: "[]", style: "[]", occasions: "[]", ...itemToRow(data), created_at: now, updated_at: now }).run();
    return (await this.getItem(userId, id)) as WardrobeItem;
  }
  async updateItem(userId: string, id: string, data: Partial<WardrobeItem>) {
    const existing = await this.getItem(userId, id);
    if (!existing) return null;
    const stmt = update(this.db, "wardrobe_items", id, { ...itemToRow(data), updated_at: nowIso() });
    if (stmt) await stmt.run();
    return this.getItem(userId, id);
  }
  async deleteItem(userId: string, id: string) {
    const res = await this.db.prepare("DELETE FROM wardrobe_items WHERE user_id = ? AND id = ?").bind(userId, id).run();
    return (res.meta.changes ?? 0) > 0;
  }
}

class Weather implements WeatherRepository {
  constructor(private db: D1Database) {}
  async latestFresh(userId: string, latitude: number, longitude: number, now: Date) {
    const row = await this.db
      .prepare("SELECT snapshot FROM weather_logs WHERE user_id = ? AND ABS(latitude - ?) < 0.01 AND ABS(longitude - ?) < 0.01 AND expires_at > ? ORDER BY recorded_at DESC LIMIT 1")
      .bind(userId, latitude, longitude, now.toISOString())
      .first<Row>();
    return row ? json<WeatherSnapshot | null>(row.snapshot, null) : null;
  }
  async save(userId: string, snapshot: WeatherSnapshot) {
    const saved = { ...snapshot, id: snapshot.id ?? newId() };
    await insert(this.db, "weather_logs", { id: saved.id, user_id: userId, latitude: saved.latitude, longitude: saved.longitude, snapshot: enc(saved), recorded_at: saved.recorded_at, expires_at: saved.expires_at }).run();
    return saved;
  }
}

class Outfits implements OutfitRepository {
  constructor(private db: D1Database) {}
  private async hydrate(rows: Row[], userId: string): Promise<Outfit[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id as string);
    const placeholders = ids.map(() => "?").join(", ");
    const { results: links } = await this.db
      .prepare(`SELECT oi.outfit_id, oi.slot, oi.position, wi.* FROM outfit_items oi JOIN wardrobe_items wi ON wi.id = oi.wardrobe_item_id WHERE oi.outfit_id IN (${placeholders}) AND wi.user_id = ? ORDER BY oi.position`)
      .bind(...ids, userId)
      .all<Row>();
    const byOutfit = new Map<string, Outfit["items"]>();
    for (const l of links) {
      const { outfit_id, slot, position: _position, ...item } = l;
      const list = byOutfit.get(outfit_id as string) ?? [];
      list.push({ slot: slot as Outfit["items"][number]["slot"], item: itemFromRow(item) });
      byOutfit.set(outfit_id as string, list);
    }
    return rows.map((r) => ({
      ...(r as unknown as Outfit),
      reasons: json(r.reasons, []),
      score_breakdown: json(r.score_breakdown, null),
      saved: bool(r.saved),
      items: byOutfit.get(r.id as string) ?? [],
    }));
  }
  async createOutfit(o: Outfit) {
    const stmts = [
      insert(this.db, "outfits", {
        id: o.id,
        user_id: o.user_id,
        name: o.name,
        occasion: o.occasion,
        style: o.style,
        weather: o.weather,
        temperature_c: o.temperature_c,
        reasons: enc(o.reasons),
        score: o.score,
        score_breakdown: o.score_breakdown ? enc(o.score_breakdown) : null,
        explanation: o.explanation,
        saved: o.saved ? 1 : 0,
        created_at: o.created_at,
      }),
      ...o.items.map((ref, i) => insert(this.db, "outfit_items", { id: newId(), outfit_id: o.id, wardrobe_item_id: ref.item.id, slot: ref.slot, position: i })),
    ];
    await this.db.batch(stmts);
    return o;
  }
  async getOutfit(userId: string, id: string) {
    const row = await this.db.prepare("SELECT * FROM outfits WHERE user_id = ? AND id = ?").bind(userId, id).first<Row>();
    return row ? ((await this.hydrate([row], userId))[0] ?? null) : null;
  }
  async setSaved(userId: string, id: string, saved: boolean) {
    await this.db.prepare("UPDATE outfits SET saved = ? WHERE user_id = ? AND id = ?").bind(saved ? 1 : 0, userId, id).run();
    return this.getOutfit(userId, id);
  }
  async listSaved(userId: string) {
    const { results } = await this.db.prepare("SELECT * FROM outfits WHERE user_id = ? AND saved = 1 ORDER BY created_at DESC").bind(userId).all<Row>();
    return this.hydrate(results, userId);
  }
}

class Body implements BodyRepository {
  constructor(private db: D1Database) {}
  async latest(userId: string) {
    const row = await this.db.prepare("SELECT * FROM body_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(userId).first<Row>();
    return row ? bodyFromRow(row) : null;
  }
  async create(p: BodyProfile) {
    await insert(this.db, "body_profiles", { ...p }).run();
    return p;
  }
  async updatePhotos(userId: string, id: string, paths: Partial<Pick<BodyProfile, "front_image_path" | "side_image_path" | "back_image_path">>) {
    const stmt = update(this.db, "body_profiles", id, { ...paths, updated_at: nowIso() });
    if (stmt) await stmt.run();
    const row = await this.db.prepare("SELECT * FROM body_profiles WHERE user_id = ? AND id = ?").bind(userId, id).first<Row>();
    return row ? bodyFromRow(row) : null;
  }
}

class Jobs implements TryOnJobRepository {
  constructor(private db: D1Database) {}
  async create(j: TryOnJob) {
    await insert(this.db, "try_on_jobs", { ...j, item_ids: enc(j.item_ids), applied: enc(j.applied), skipped: enc(j.skipped) }).run();
    return j;
  }
  async get(userId: string, id: string) {
    const row = await this.db.prepare("SELECT * FROM try_on_jobs WHERE user_id = ? AND id = ?").bind(userId, id).first<Row>();
    return row ? jobFromRow(row) : null;
  }
  async update(id: string, data: Partial<TryOnJob>) {
    const row: Row = {};
    for (const [k, v] of Object.entries(data)) row[k] = k === "item_ids" || k === "applied" || k === "skipped" ? enc(v ?? []) : (v ?? null);
    const stmt = update(this.db, "try_on_jobs", id, { ...row, updated_at: nowIso() });
    if (stmt) await stmt.run();
    const r = await this.db.prepare("SELECT * FROM try_on_jobs WHERE id = ?").bind(id).first<Row>();
    return r ? jobFromRow(r) : null;
  }
  async findCached(userId: string, cacheKey: string) {
    const row = await this.db
      .prepare("SELECT * FROM try_on_jobs WHERE user_id = ? AND cache_key = ? AND status IN ('completed','queued','processing') ORDER BY created_at DESC LIMIT 1")
      .bind(userId, cacheKey)
      .first<Row>();
    return row ? jobFromRow(row) : null;
  }
  async listRecent(userId: string, limit: number) {
    const { results } = await this.db.prepare("SELECT * FROM try_on_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").bind(userId, limit).all<Row>();
    return results.map(jobFromRow);
  }
  async latestCompletedForItems(userId: string, itemIds: string[]) {
    const { results } = await this.db.prepare("SELECT * FROM try_on_jobs WHERE user_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 50").bind(userId).all<Row>();
    const wanted = [...itemIds].sort().join("|");
    return results.map(jobFromRow).find((j) => [...j.item_ids].sort().join("|") === wanted && !isActiveJob(j)) ?? null;
  }
}

export function d1Repositories(db: D1Database): Repositories {
  return { users: new Users(db), wardrobe: new Wardrobe(db), weather: new Weather(db), outfits: new Outfits(db), body: new Body(db), tryOnJobs: new Jobs(db) };
}
