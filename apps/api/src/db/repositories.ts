/** Repository interfaces. Services depend on these, never on D1 directly. */

import type { BodyProfile, Outfit, Profile, TryOnJob, User, WardrobeItem, WeatherSnapshot } from "../domain";

export type ProfilePatch = Partial<Omit<Profile, "id" | "user_id" | "created_at" | "updated_at">>;

export interface UserRepository {
  ensureUser(user: { id: string; email: string; display_name?: string | null }): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  updateUser(userId: string, patch: { display_name?: string | null; avatar_url?: string | null }): Promise<User | null>;
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(userId: string, patch: ProfilePatch): Promise<Profile>;
}

export interface WardrobeRepository {
  listItems(userId: string): Promise<WardrobeItem[]>;
  getItem(userId: string, itemId: string): Promise<WardrobeItem | null>;
  createItem(userId: string, data: Partial<WardrobeItem> & { image_path: string; category: WardrobeItem["category"] }): Promise<WardrobeItem>;
  updateItem(userId: string, itemId: string, data: Partial<WardrobeItem>): Promise<WardrobeItem | null>;
  deleteItem(userId: string, itemId: string): Promise<boolean>;
}

export interface WeatherRepository {
  latestFresh(userId: string, latitude: number, longitude: number, now: Date): Promise<WeatherSnapshot | null>;
  save(userId: string, snapshot: WeatherSnapshot): Promise<WeatherSnapshot>;
}

export interface OutfitRepository {
  createOutfit(outfit: Outfit): Promise<Outfit>;
  getOutfit(userId: string, outfitId: string): Promise<Outfit | null>;
  setSaved(userId: string, outfitId: string, saved: boolean): Promise<Outfit | null>;
  listSaved(userId: string): Promise<Outfit[]>;
}

export interface BodyRepository {
  latest(userId: string): Promise<BodyProfile | null>;
  create(profile: BodyProfile): Promise<BodyProfile>;
  updatePhotos(userId: string, profileId: string, paths: Partial<Pick<BodyProfile, "front_image_path" | "side_image_path" | "back_image_path">>): Promise<BodyProfile | null>;
}

export interface TryOnJobRepository {
  create(job: TryOnJob): Promise<TryOnJob>;
  get(userId: string, jobId: string): Promise<TryOnJob | null>;
  update(jobId: string, data: Partial<TryOnJob>): Promise<TryOnJob | null>;
  /** A completed or in-flight job with this cache key. */
  findCached(userId: string, cacheKey: string): Promise<TryOnJob | null>;
  listRecent(userId: string, limit: number): Promise<TryOnJob[]>;
  latestCompletedForItems(userId: string, itemIds: string[]): Promise<TryOnJob | null>;
}

export type Repositories = {
  users: UserRepository;
  wardrobe: WardrobeRepository;
  weather: WeatherRepository;
  outfits: OutfitRepository;
  body: BodyRepository;
  tryOnJobs: TryOnJobRepository;
};
