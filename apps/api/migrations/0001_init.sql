-- Outfit API schema for Cloudflare D1 (SQLite).
-- Rows are always scoped by user_id; the Worker verifies the Supabase JWT and never
-- trusts a user id from a request body. JSON columns hold string arrays / objects.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  height_cm REAL,
  weight_kg REAL,
  gender TEXT,
  bust_cm REAL,
  waist_cm REAL,
  hip_cm REAL,
  shoulder_cm REAL,
  inseam_cm REAL,
  style_preferences TEXT NOT NULL DEFAULT '[]',
  favorite_colors TEXT NOT NULL DEFAULT '[]',
  avoid_colors TEXT NOT NULL DEFAULT '[]',
  preferred_fit TEXT,
  skin_tone TEXT,
  location_name TEXT,
  latitude REAL,
  longitude REAL,
  timezone TEXT,
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  original_image_path TEXT,
  processed_image_path TEXT,
  background_removed INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  category TEXT NOT NULL CHECK (category IN ('top','bottom','dress','outerwear','shoes','bag','accessory')),
  subcategory TEXT,
  pattern TEXT,
  dominant_color TEXT,
  secondary_colors TEXT NOT NULL DEFAULT '[]',
  material TEXT,
  season TEXT NOT NULL DEFAULT '[]',
  warmth INTEGER,
  style TEXT NOT NULL DEFAULT '[]',
  fit TEXT,
  formality INTEGER,
  occasions TEXT NOT NULL DEFAULT '[]',
  layering INTEGER NOT NULL DEFAULT 0,
  rain_protection INTEGER NOT NULL DEFAULT 0,
  wind_protection INTEGER NOT NULL DEFAULT 0,
  gender_suitability TEXT,
  brand TEXT,
  size TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  ai_confidence REAL,
  ai_model TEXT,
  ai_raw TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  last_worn_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_idx ON wardrobe_items(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS weather_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  snapshot TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS weather_logs_user_idx ON weather_logs(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS outfits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  occasion TEXT NOT NULL,
  style TEXT,
  weather TEXT,
  temperature_c REAL,
  reasons TEXT NOT NULL DEFAULT '[]',
  score REAL NOT NULL DEFAULT 0,
  score_breakdown TEXT,
  explanation TEXT,
  saved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outfits_user_idx ON outfits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outfit_items (
  id TEXT PRIMARY KEY,
  outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  wardrobe_item_id TEXT NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS outfit_items_outfit_idx ON outfit_items(outfit_id);

CREATE TABLE IF NOT EXISTS body_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  front_image_path TEXT,
  side_image_path TEXT,
  back_image_path TEXT,
  model_type TEXT NOT NULL DEFAULT 'photos-only',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS body_profiles_user_idx ON body_profiles(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS try_on_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outfit_id TEXT,
  item_ids TEXT NOT NULL DEFAULT '[]',
  person_image_path TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','processing','completed','failed')),
  step TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  result_image_path TEXT,
  applied TEXT NOT NULL DEFAULT '[]',
  skipped TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS try_on_jobs_user_idx ON try_on_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS try_on_jobs_cache_idx ON try_on_jobs(user_id, cache_key);
