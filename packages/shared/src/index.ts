/**
 * API contract shared by the Worker (apps/api) and the web app (apps/web).
 * Every response is `{ success, data, error }`; shapes below are the `data`.
 */

export type WardrobeCategory = "top" | "bottom" | "dress" | "outerwear" | "shoes" | "bag" | "accessory";
export type SeasonType = "spring" | "summer" | "autumn" | "winter";
export type OccasionType = "work" | "school" | "casual" | "date" | "party" | "exercise" | "travel" | "formal" | "other";
export type OutfitSlot = "top" | "layer" | "outerwear" | "bottom" | "dress" | "shoes" | "accessory";
export type GenderType = "female" | "male" | "non_binary" | "prefer_not_to_say";
export type PreferredFit = "fitted" | "regular" | "relaxed" | "oversized";
export type TryOnStatus = "queued" | "processing" | "completed" | "failed";
export type WeatherChoice = "sunny" | "cloudy" | "rainy" | "snowy" | "windy";

export type ApiError = { code: string; message: string; details?: unknown };
export type ApiResponse<T> = { success: true; data: T; error: null } | { success: false; data: null; error: ApiError };

export type ApiProfile = {
  id: string;
  user_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  gender: GenderType | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  shoulder_cm: number | null;
  inseam_cm: number | null;
  style_preferences: string[];
  favorite_colors: string[];
  avoid_colors: string[];
  preferred_fit: PreferredFit | null;
  skin_tone: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiUser = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiMe = { id: string; email: string | null; role: string; user: ApiUser | null; profile: ApiProfile | null };

export type ProfileInput = Partial<
  Omit<ApiProfile, "id" | "user_id" | "created_at" | "updated_at" | "onboarding_completed_at">
> & { complete_onboarding?: boolean };

export type ApiWardrobeItem = {
  id: string;
  user_id: string;
  image_path: string;
  image_url: string | null;
  original_image_path: string | null;
  original_image_url: string | null;
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
  formality_label: string | null;
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
  needs_review: boolean;
  slot: OutfitSlot;
  label: string;
  last_worn_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WardrobeItemInput = {
  image_path: string;
  original_image_path?: string | null;
  processed_image_path?: string | null;
  background_removed?: boolean;
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
  brand: string | null;
  size: string | null;
  favorite: boolean;
  available: boolean;
  needs_review?: boolean;
};

export type ApiIngest = { item: ApiWardrobeItem; analyzed: boolean; background_removed: boolean; needs_review: boolean };

export type ApiHourly = { time: string; temperature: number; feels_like: number; precipitation_probability: number; wind_speed: number; weather_code: number };
export type ApiDaily = {
  date: string;
  temp_min: number;
  temp_max: number;
  feels_like_min: number;
  feels_like_max: number;
  precipitation_sum: number;
  precipitation_probability_max: number;
  wind_speed_max: number;
  weather_code: number;
};

export type ApiWeather = {
  id: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  temperature: number;
  feels_like: number;
  temp_min: number | null;
  temp_max: number | null;
  humidity: number | null;
  wind_speed: number | null;
  precipitation: number | null;
  precipitation_probability: number | null;
  weather_code: number | null;
  hourly: ApiHourly[];
  daily: ApiDaily[];
  provider: string;
  recorded_at: string;
  expires_at: string;
  band: string;
  band_label: string;
  advice: string;
  strong_wind: boolean;
  rain_expected: boolean;
  snow_expected: boolean;
  layering_recommended: boolean;
  morning_feels_like: number | null;
  afternoon_feels_like: number | null;
  evening_feels_like: number | null;
};

export type ApiScoreBreakdown = { weather: number; occasion: number; style: number; color: number; fit: number; user_preference: number };
export type ApiOutfitItem = { slot: OutfitSlot; item: ApiWardrobeItem };

export type ApiOutfit = {
  id: string;
  name: string | null;
  occasion: OccasionType;
  style: string | null;
  weather: string | null;
  temperature_c: number | null;
  reasons: string[];
  score: number;
  score_breakdown: ApiScoreBreakdown | null;
  saved: boolean;
  items: ApiOutfitItem[];
  created_at: string;
};

export type ApiEvaluation = { verdict: "match" | "almost" | "mismatch"; reasons: string[]; issues: string[] };

export type OutfitGenerationInput = {
  occasion: OccasionType;
  style?: string | null;
  weather?: WeatherChoice | null;
  temperature_c: number;
  count?: number;
  exclude?: string[][];
};

export type ApiBodyProfile = {
  id: string;
  model_type: string;
  front_image_path: string | null;
  side_image_path: string | null;
  back_image_path: string | null;
  front_image_url: string | null;
  side_image_url: string | null;
  back_image_url: string | null;
  created_at: string;
};

export type ApiUpload = { bucket: string; path: string; url: string | null };

export type ApiTryOnJob = {
  id: string;
  outfit_id: string | null;
  item_ids: string[];
  status: TryOnStatus;
  is_active: boolean;
  step: string | null;
  progress: number;
  result_image_url: string | null;
  person_image_url: string | null;
  applied: string[];
  skipped: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
};
