import type { User } from "@supabase/supabase-js";

import type { AppUser, Profile } from "@/types/user";

/**
 * DEMO MODE — enabled with NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Lets the UI be explored without a Supabase project: auth is bypassed and the
 * profile comes from the sample below. Wardrobe, outfits and try-on jobs come
 * from the FastAPI backend running with DEMO_MODE=true (in-memory sample
 * wardrobe, in-memory uploads, real engine). Profile writes are refused with a
 * clear "demo mode" message.
 *
 * Never enable this in production.
 */
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_WRITE_ERROR = "Demo mode — changes are not saved.";

// Must match backend/app/repositories/demo_data.py DEMO_USER_ID.
const DEMO_USER_ID = "00000000-0000-4000-8000-00000000d3a0";
const DEMO_CREATED_AT = "2026-09-01T08:00:00.000Z";

export const DEMO_APP_USER: AppUser = {
  id: DEMO_USER_ID,
  email: "demo@outfit.app",
  display_name: "Demo User",
  avatar_url: null,
  created_at: DEMO_CREATED_AT,
  updated_at: DEMO_CREATED_AT,
};

/** Shape-compatible with Supabase's User so server code can stay unchanged. */
export const DEMO_AUTH_USER = {
  id: DEMO_USER_ID,
  email: DEMO_APP_USER.email,
  aud: "authenticated",
  role: "authenticated",
  created_at: DEMO_CREATED_AT,
  app_metadata: { provider: "demo" },
  user_metadata: { display_name: DEMO_APP_USER.display_name },
} as unknown as User;

export const DEMO_PROFILE: Profile = {
  id: "10000000-0000-4000-8000-00000000d3a0",
  user_id: DEMO_USER_ID,
  height_cm: 172,
  weight_kg: 64,
  gender: "female",
  bust_cm: 88,
  waist_cm: 70,
  hip_cm: 96,
  shoulder_cm: null,
  inseam_cm: 78,
  style_preferences: ["minimal", "smart_casual", "streetwear"],
  favorite_colors: ["black", "beige", "white", "olive"],
  avoid_colors: ["yellow", "orange"],
  preferred_fit: "relaxed",
  skin_tone: null,
  location_name: "Ulaanbaatar, Mongolia",
  latitude: 47.9077,
  longitude: 106.8832,
  timezone: "Asia/Ulaanbaatar",
  onboarding_completed_at: DEMO_CREATED_AT,
  created_at: DEMO_CREATED_AT,
  updated_at: DEMO_CREATED_AT,
};
