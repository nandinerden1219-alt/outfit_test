import { apiFetch } from "@/lib/api";
import type { ApiIngest, ApiWardrobeItem, WardrobeItemInput } from "@/types/api-models";

/**
 * Server-only wardrobe access through the FastAPI backend.
 * The backend verifies ownership and signs image URLs (buckets are private).
 */

export async function listWardrobeItems(): Promise<ApiWardrobeItem[]> {
  return apiFetch<ApiWardrobeItem[]>("/wardrobe");
}

export async function getWardrobeItem(id: string): Promise<ApiWardrobeItem> {
  return apiFetch<ApiWardrobeItem>(`/wardrobe/${encodeURIComponent(id)}`);
}

/**
 * One clothing photo → background removal → analysis → stored item.
 * The batch uploader calls this once per image, a few at a time.
 */
export async function ingestWardrobeImage(file: File): Promise<ApiIngest> {
  const formData = new FormData();
  formData.append("image", file, file.name || "item.jpg");
  return apiFetch<ApiIngest>("/wardrobe/ingest", { method: "POST", formData, timeoutMs: 120_000 });
}

export async function createWardrobeItem(input: WardrobeItemInput): Promise<ApiWardrobeItem> {
  return apiFetch<ApiWardrobeItem>("/wardrobe", { method: "POST", body: input });
}

export async function updateWardrobeItem(id: string, patch: Partial<WardrobeItemInput>): Promise<ApiWardrobeItem> {
  return apiFetch<ApiWardrobeItem>(`/wardrobe/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  await apiFetch<{ deleted: string }>(`/wardrobe/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Counts only; used by home to decide empty states. Tolerates an unreachable backend. */
export async function countWardrobeItemsSafe(): Promise<number | null> {
  try {
    return (await listWardrobeItems()).length;
  } catch {
    return null;
  }
}
