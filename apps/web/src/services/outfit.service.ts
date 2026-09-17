import { apiFetch } from "@/lib/api";
import type { ApiEvaluation, ApiOutfit, OutfitGenerationInput } from "@/types/api-models";
import type { OccasionType } from "@/types/database";

/** 3–5 combinations built only from the user's own wardrobe. */
export async function generateOutfits(input: OutfitGenerationInput): Promise<ApiOutfit[]> {
  return apiFetch<ApiOutfit[]>("/outfits/generate", { method: "POST", body: input, timeoutMs: 60_000 });
}

/** Persists a user-assembled look (e.g. after swapping pieces in try-on). */
export async function saveCombination(itemIds: string[], occasion: OccasionType, name?: string | null): Promise<ApiOutfit> {
  return apiFetch<ApiOutfit>("/outfits", { method: "POST", body: { item_ids: itemIds, occasion, name: name ?? null } });
}

export async function getSavedOutfits(): Promise<ApiOutfit[]> {
  return apiFetch<ApiOutfit[]>("/outfits/saved");
}

export async function getOutfit(id: string): Promise<ApiOutfit> {
  return apiFetch<ApiOutfit>(`/outfits/${encodeURIComponent(id)}`);
}

export async function setOutfitSaved(id: string, saved: boolean): Promise<ApiOutfit> {
  return apiFetch<ApiOutfit>(`/outfits/${encodeURIComponent(id)}`, { method: "PATCH", body: { saved } });
}

/** MATCH / MIS-MATCH for a combination the user assembled (same rules as the generator). */
export async function evaluateCombination(
  itemIds: string[],
  occasion: OccasionType,
  temperatureC?: number | null,
): Promise<ApiEvaluation> {
  return apiFetch<ApiEvaluation>("/outfits/evaluate", {
    method: "POST",
    body: { item_ids: itemIds, occasion, temperature_c: temperatureC ?? 18 },
  });
}
