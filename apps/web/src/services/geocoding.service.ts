import type { ProfileLocation } from "@/types/user";

/**
 * City search via Open-Meteo's geocoding API (no API key, CORS-enabled).
 * Runs in the browser during onboarding / profile editing.
 * https://open-meteo.com/en/docs/geocoding-api
 */

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

export type LocationSuggestion = ProfileLocation & { id: number };

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Location search failed (${response.status})`);
  }

  const payload = (await response.json()) as GeocodingResponse;
  return (payload.results ?? []).map((r) => ({
    id: r.id,
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? null,
  }));
}

/** Browser geolocation wrapped in a promise. Rejects if unavailable or denied. */
export function getBrowserLocation(): Promise<ProfileLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          name: "Current location",
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        });
      },
      (error) => reject(new Error(error.message || "Could not get your location.")),
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}
