/** In-memory repositories: DEMO_MODE and tests. State lives for the isolate's lifetime. */

import demo from "../demo/demo-data.json";
import { isActiveJob, newId, nowIso, type BodyProfile, type Outfit, type Profile, type TryOnJob, type User, type WardrobeItem, type WeatherSnapshot } from "../domain";
import type { BodyRepository, OutfitRepository, ProfilePatch, Repositories, TryOnJobRepository, UserRepository, WardrobeRepository, WeatherRepository } from "./repositories";

export const DEMO_USER_ID = demo.user_id;

const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === new Set([...a, ...b]).size;

export class MemoryStore {
  users = new Map<string, User>();
  profiles = new Map<string, Profile>();
  items = new Map<string, WardrobeItem>();
  weather: Array<{ userId: string; snapshot: WeatherSnapshot }> = [];
  outfits = new Map<string, Outfit>();
  bodies = new Map<string, BodyProfile>();
  jobs = new Map<string, TryOnJob>();

  constructor(seedDemo = true) {
    if (!seedDemo) return;
    const p = demo.profile as unknown as Profile;
    this.users.set(DEMO_USER_ID, { id: DEMO_USER_ID, email: "demo@outfit.app", display_name: "Demo User", avatar_url: null, created_at: p.created_at, updated_at: p.updated_at });
    this.profiles.set(DEMO_USER_ID, p);
    for (const row of demo.wardrobe as unknown as WardrobeItem[]) this.items.set(row.id, { ...row });
  }
}

class Users implements UserRepository {
  constructor(private s: MemoryStore) {}
  async ensureUser(u: { id: string; email: string; display_name?: string | null }) {
    const existing = this.s.users.get(u.id);
    if (existing) return existing;
    const now = nowIso();
    const user: User = { id: u.id, email: u.email, display_name: u.display_name ?? null, avatar_url: null, created_at: now, updated_at: now };
    this.s.users.set(u.id, user);
    return user;
  }
  async getUser(id: string) {
    return this.s.users.get(id) ?? null;
  }
  async updateUser(id: string, patch: { display_name?: string | null; avatar_url?: string | null }) {
    const u = this.s.users.get(id);
    if (!u) return null;
    const next = { ...u, ...patch, updated_at: nowIso() };
    this.s.users.set(id, next);
    return next;
  }
  async getProfile(userId: string) {
    return this.s.profiles.get(userId) ?? null;
  }
  async upsertProfile(userId: string, patch: ProfilePatch) {
    const now = nowIso();
    const base: Profile = this.s.profiles.get(userId) ?? {
      id: newId(),
      user_id: userId,
      height_cm: null,
      weight_kg: null,
      gender: null,
      bust_cm: null,
      waist_cm: null,
      hip_cm: null,
      shoulder_cm: null,
      inseam_cm: null,
      style_preferences: [],
      favorite_colors: [],
      avoid_colors: [],
      preferred_fit: null,
      skin_tone: null,
      location_name: null,
      latitude: null,
      longitude: null,
      timezone: null,
      onboarding_completed_at: null,
      created_at: now,
      updated_at: now,
    };
    const next = { ...base, ...patch, updated_at: now };
    this.s.profiles.set(userId, next);
    return next;
  }
}

class Wardrobe implements WardrobeRepository {
  constructor(private s: MemoryStore) {}
  async listItems(userId: string) {
    return [...this.s.items.values()].filter((i) => i.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  }
  async getItem(userId: string, id: string) {
    const i = this.s.items.get(id);
    return i && i.user_id === userId ? i : null;
  }
  async createItem(userId: string, data: Partial<WardrobeItem> & { image_path: string; category: WardrobeItem["category"] }) {
    const now = nowIso();
    const item: WardrobeItem = {
      id: newId(),
      user_id: userId,
      original_image_path: null,
      processed_image_path: null,
      background_removed: false,
      name: null,
      subcategory: null,
      pattern: null,
      dominant_color: null,
      secondary_colors: [],
      material: null,
      season: [],
      warmth: null,
      style: [],
      fit: null,
      formality: null,
      occasions: [],
      layering: false,
      rain_protection: false,
      wind_protection: false,
      gender_suitability: null,
      brand: null,
      size: null,
      favorite: false,
      available: true,
      ai_confidence: null,
      ai_model: null,
      ai_raw: null,
      needs_review: false,
      last_worn_at: null,
      created_at: now,
      updated_at: now,
      ...data,
    };
    this.s.items.set(item.id, item);
    return item;
  }
  async updateItem(userId: string, id: string, data: Partial<WardrobeItem>) {
    const i = await this.getItem(userId, id);
    if (!i) return null;
    const next = { ...i, ...data, id, user_id: userId, updated_at: nowIso() };
    this.s.items.set(id, next);
    for (const o of this.s.outfits.values()) for (const ref of o.items) if (ref.item.id === id) ref.item = next;
    return next;
  }
  async deleteItem(userId: string, id: string) {
    const i = await this.getItem(userId, id);
    if (!i) return false;
    this.s.items.delete(id);
    return true;
  }
}

class Weather implements WeatherRepository {
  constructor(private s: MemoryStore) {}
  async latestFresh(userId: string, latitude: number, longitude: number, now: Date) {
    const rows = this.s.weather.filter((w) => w.userId === userId && Math.abs(w.snapshot.latitude - latitude) < 0.01 && Math.abs(w.snapshot.longitude - longitude) < 0.01 && new Date(w.snapshot.expires_at) > now);
    return rows.length ? rows[rows.length - 1]!.snapshot : null;
  }
  async save(userId: string, snapshot: WeatherSnapshot) {
    const saved = { ...snapshot, id: snapshot.id ?? newId() };
    this.s.weather.push({ userId, snapshot: saved });
    return saved;
  }
}

class Outfits implements OutfitRepository {
  constructor(private s: MemoryStore) {}
  async createOutfit(o: Outfit) {
    this.s.outfits.set(o.id, o);
    return o;
  }
  async getOutfit(userId: string, id: string) {
    const o = this.s.outfits.get(id);
    return o && o.user_id === userId ? o : null;
  }
  async setSaved(userId: string, id: string, saved: boolean) {
    const o = await this.getOutfit(userId, id);
    if (!o) return null;
    const next = { ...o, saved };
    this.s.outfits.set(id, next);
    return next;
  }
  async listSaved(userId: string) {
    return [...this.s.outfits.values()].filter((o) => o.user_id === userId && o.saved).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

class Body implements BodyRepository {
  constructor(private s: MemoryStore) {}
  async latest(userId: string) {
    const rows = [...this.s.bodies.values()].filter((b) => b.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows[0] ?? null;
  }
  async create(p: BodyProfile) {
    this.s.bodies.set(p.id, p);
    return p;
  }
  async updatePhotos(userId: string, id: string, paths: Partial<Pick<BodyProfile, "front_image_path" | "side_image_path" | "back_image_path">>) {
    const b = this.s.bodies.get(id);
    if (!b || b.user_id !== userId) return null;
    const next = { ...b, ...paths, updated_at: nowIso() };
    this.s.bodies.set(id, next);
    return next;
  }
}

class Jobs implements TryOnJobRepository {
  constructor(private s: MemoryStore) {}
  async create(j: TryOnJob) {
    this.s.jobs.set(j.id, j);
    return j;
  }
  async get(userId: string, id: string) {
    const j = this.s.jobs.get(id);
    return j && j.user_id === userId ? j : null;
  }
  async update(id: string, data: Partial<TryOnJob>) {
    const j = this.s.jobs.get(id);
    if (!j) return null;
    const next = { ...j, ...data, updated_at: nowIso() };
    this.s.jobs.set(id, next);
    return next;
  }
  async findCached(userId: string, cacheKey: string) {
    const rows = [...this.s.jobs.values()].filter((j) => j.user_id === userId && j.cache_key === cacheKey && (j.status === "completed" || isActiveJob(j)));
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  }
  async listRecent(userId: string, limit: number) {
    return [...this.s.jobs.values()].filter((j) => j.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }
  async latestCompletedForItems(userId: string, itemIds: string[]) {
    const rows = [...this.s.jobs.values()].filter((j) => j.user_id === userId && j.status === "completed" && sameSet(j.item_ids, itemIds));
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  }
}

export function memoryRepositories(store = new MemoryStore()): Repositories {
  return { users: new Users(store), wardrobe: new Wardrobe(store), weather: new Weather(store), outfits: new Outfits(store), body: new Body(store), tryOnJobs: new Jobs(store) };
}
