import { apiFetch } from "@/lib/api";
import type { ApiWeather } from "@/types/api-models";

/** Cached forecast for the profile location (backend caches for an hour). */
export async function getWeather(options: { refresh?: boolean } = {}): Promise<ApiWeather> {
  const query = options.refresh ? "?refresh=true" : "";
  return apiFetch<ApiWeather>(`/weather${query}`);
}
