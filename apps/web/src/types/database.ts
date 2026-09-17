/**
 * Shared vocabulary (re-exported from the API contract). The database itself is
 * Cloudflare D1 behind the Worker; the web app never queries it directly.
 * Supabase is used for Auth only.
 */

export type { GenderType, OccasionType, OutfitSlot, PreferredFit, SeasonType, TryOnStatus, WardrobeCategory, WeatherChoice } from "@outfit/shared";

/** Minimal shape @supabase/ssr needs for the auth client generics. */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
