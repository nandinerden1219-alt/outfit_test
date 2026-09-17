import type { ApiMe, ProfileInput } from "@outfit/shared";

import { apiFetch } from "@/lib/api";
import { DEMO_APP_USER, DEMO_PROFILE, DEMO_WRITE_ERROR, isDemoMode } from "@/lib/demo";
import type { ProfileFormInput } from "@/lib/validation/profile";
import type { AppUser, Profile } from "@/types/user";

/**
 * Profile + user data live in D1 behind the Worker. Supabase Auth still owns
 * identity; the Worker creates the user row on the first authenticated request.
 */

async function me(): Promise<ApiMe> {
  return apiFetch<ApiMe>("/me");
}

// The Worker derives the user from the JWT; the id parameter only guards against mixing sessions.
export async function getProfile(userId: string): Promise<Profile | null> {
  if (isDemoMode) return DEMO_PROFILE;
  const data = await me();
  return data.id === userId ? data.profile : null;
}

export async function getAppUser(userId: string): Promise<AppUser | null> {
  if (isDemoMode) return DEMO_APP_USER;
  const data = await me();
  return data.id === userId ? data.user : null;
}

function toProfileInput(values: ProfileFormInput): ProfileInput {
  return {
    height_cm: values.heightCm,
    weight_kg: values.weightKg,
    gender: values.gender,
    bust_cm: values.bustCm,
    waist_cm: values.waistCm,
    hip_cm: values.hipCm,
    shoulder_cm: values.shoulderCm,
    inseam_cm: values.inseamCm,
    style_preferences: values.stylePreferences,
    favorite_colors: values.favoriteColors,
    avoid_colors: values.avoidColors,
    preferred_fit: values.preferredFit,
    location_name: values.location?.name ?? null,
    latitude: values.location?.latitude ?? null,
    longitude: values.location?.longitude ?? null,
    timezone: values.location?.timezone ?? null,
  };
}

export async function saveProfile(_userId: string, values: ProfileFormInput, options: { completeOnboarding?: boolean } = {}): Promise<Profile> {
  if (isDemoMode) throw new Error(DEMO_WRITE_ERROR);
  return apiFetch<Profile>("/me/profile", { method: "PUT", body: { ...toProfileInput(values), complete_onboarding: options.completeOnboarding ?? false } });
}

export async function updateDisplayName(_userId: string, displayName: string): Promise<void> {
  if (isDemoMode) throw new Error(DEMO_WRITE_ERROR);
  await apiFetch<AppUser>("/me", { method: "PATCH", body: { display_name: displayName } });
}

/** Small helper the UI uses to nudge users toward a complete profile. */
export function profileCompleteness(profile: Profile | null): { percent: number; missing: string[] } {
  if (!profile) return { percent: 0, missing: ["Basics", "Style", "Colors", "Location"] };
  const checks: Array<[string, boolean]> = [
    ["Basics", profile.height_cm !== null && profile.weight_kg !== null && profile.gender !== null],
    ["Style", profile.style_preferences.length > 0 && profile.preferred_fit !== null],
    ["Colors", profile.favorite_colors.length > 0],
    ["Location", profile.latitude !== null && profile.longitude !== null],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}
