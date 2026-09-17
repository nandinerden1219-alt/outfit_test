import type { ApiProfile, ApiUser, GenderType, PreferredFit } from "@outfit/shared";

export type { GenderType, PreferredFit };

export type AppUser = ApiUser;
export type Profile = ApiProfile;

/** Editable subset of the profile, as used by onboarding and the profile page. */
export type ProfileFormValues = {
  heightCm: number | null;
  weightKg: number | null;
  gender: GenderType | null;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  shoulderCm: number | null;
  inseamCm: number | null;
  stylePreferences: string[];
  favoriteColors: string[];
  avoidColors: string[];
  preferredFit: PreferredFit | null;
  location: ProfileLocation | null;
};

export type ProfileLocation = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
};

export function profileToFormValues(profile: Profile): ProfileFormValues {
  const hasLocation = profile.latitude !== null && profile.longitude !== null;
  return {
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    gender: profile.gender,
    bustCm: profile.bust_cm,
    waistCm: profile.waist_cm,
    hipCm: profile.hip_cm,
    shoulderCm: profile.shoulder_cm,
    inseamCm: profile.inseam_cm,
    stylePreferences: profile.style_preferences,
    favoriteColors: profile.favorite_colors,
    avoidColors: profile.avoid_colors,
    preferredFit: profile.preferred_fit,
    location: hasLocation
      ? {
          name: profile.location_name ?? "Saved location",
          latitude: profile.latitude as number,
          longitude: profile.longitude as number,
          timezone: profile.timezone,
        }
      : null,
  };
}

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  heightCm: null,
  weightKg: null,
  gender: null,
  bustCm: null,
  waistCm: null,
  hipCm: null,
  shoulderCm: null,
  inseamCm: null,
  stylePreferences: [],
  favoriteColors: [],
  avoidColors: [],
  preferredFit: null,
  location: null,
};
