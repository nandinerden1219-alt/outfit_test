import { apiFetch } from "@/lib/api";
import type { ApiTryOnJob } from "@/types/api-models";

/**
 * Async virtual try-on: create a job, then poll it. The backend reuses a
 * completed job when the same photo + items were already generated.
 */
export async function createTryOnJob(itemIds: string[], outfitId?: string | null): Promise<ApiTryOnJob> {
  return apiFetch<ApiTryOnJob>("/try-on/jobs", {
    method: "POST",
    body: { item_ids: itemIds, outfit_id: outfitId ?? null },
  });
}

export async function getTryOnJob(id: string): Promise<ApiTryOnJob> {
  return apiFetch<ApiTryOnJob>(`/try-on/jobs/${encodeURIComponent(id)}`);
}

export async function listTryOnJobs(limit = 20): Promise<ApiTryOnJob[]> {
  return apiFetch<ApiTryOnJob[]>(`/try-on/jobs?limit=${limit}`);
}

/** Completed results for several outfits at once (deck / saved list): outfit id → job | null. */
export async function getCachedTryOns(outfits: Array<{ id: string; item_ids: string[] }>): Promise<Record<string, ApiTryOnJob | null>> {
  if (outfits.length === 0) return {};
  return apiFetch<Record<string, ApiTryOnJob | null>>("/try-on/cached", { method: "POST", body: { outfits: outfits.slice(0, 40) } });
}

/** Completed result for exactly this set of items, if one exists. */
export async function getCachedTryOn(itemIds: string[]): Promise<ApiTryOnJob | null> {
  if (itemIds.length === 0) return null;
  return apiFetch<ApiTryOnJob | null>(`/try-on/cached?item_ids=${encodeURIComponent(itemIds.join(","))}`);
}
