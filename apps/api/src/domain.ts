/** Rows as the services see them (already JSON-decoded). Mirrors migrations/0001_init.sql. */

import type { ApiProfile, ApiScoreBreakdown, ApiUser, OccasionType, OutfitSlot, SeasonType, TryOnStatus, WardrobeCategory } from "@outfit/shared";
import { slotForItem, type WeatherSnapshot } from "@outfit/engine";

export type User = ApiUser;
export type Profile = ApiProfile;

export type WardrobeItem = {
  id: string;
  user_id: string;
  image_path: string;
  original_image_path: string | null;
  processed_image_path: string | null;
  background_removed: boolean;
  name: string | null;
  category: WardrobeCategory;
  subcategory: string | null;
  pattern: string | null;
  dominant_color: string | null;
  secondary_colors: string[];
  material: string | null;
  season: SeasonType[];
  warmth: number | null;
  style: string[];
  fit: string | null;
  formality: number | null;
  occasions: OccasionType[];
  layering: boolean;
  rain_protection: boolean;
  wind_protection: boolean;
  gender_suitability: string | null;
  brand: string | null;
  size: string | null;
  favorite: boolean;
  available: boolean;
  ai_confidence: number | null;
  ai_model: string | null;
  ai_raw: Record<string, unknown> | null;
  needs_review: boolean;
  last_worn_at: string | null;
  created_at: string;
  updated_at: string;
};

export const itemLabel = (i: WardrobeItem): string => i.name || i.subcategory || i.category;
export const itemSlot = (i: WardrobeItem): OutfitSlot => slotForItem(i.category, i.subcategory);

export type OutfitItemRef = { slot: OutfitSlot; item: WardrobeItem };

export type Outfit = {
  id: string;
  user_id: string;
  name: string | null;
  occasion: OccasionType;
  style: string | null;
  weather: string | null;
  temperature_c: number | null;
  reasons: string[];
  score: number;
  score_breakdown: ApiScoreBreakdown | null;
  explanation: string | null;
  saved: boolean;
  items: OutfitItemRef[];
  created_at: string;
};

export type BodyProfile = {
  id: string;
  user_id: string;
  front_image_path: string | null;
  side_image_path: string | null;
  back_image_path: string | null;
  model_type: string;
  created_at: string;
  updated_at: string;
};

export type TryOnJob = {
  id: string;
  user_id: string;
  outfit_id: string | null;
  item_ids: string[];
  person_image_path: string;
  cache_key: string;
  status: TryOnStatus;
  step: string | null;
  progress: number;
  provider: string;
  result_image_path: string | null;
  applied: string[];
  skipped: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const TRY_ON_ACTIVE: ReadonlySet<TryOnStatus> = new Set(["queued", "processing"]);
export const isActiveJob = (j: TryOnJob) => TRY_ON_ACTIVE.has(j.status);

export type { WeatherSnapshot };

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
