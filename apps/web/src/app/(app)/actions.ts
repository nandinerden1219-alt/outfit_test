"use server";

import { revalidatePath } from "next/cache";

import { ApiClientError, errorMessage } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUser } from "@/lib/supabase/server";
import { saveBodyPhotos, uploadImage } from "@/services/body.service";
import { evaluateCombination, generateOutfits, saveCombination, setOutfitSaved } from "@/services/outfit.service";
import { createTryOnJob, getCachedTryOn, getCachedTryOns, getTryOnJob } from "@/services/tryon.service";
import {
  createWardrobeItem,
  deleteWardrobeItem,
  ingestWardrobeImage,
  updateWardrobeItem,
} from "@/services/wardrobe.service";
import type { ActionResult } from "@/types/api";
import type {
  ApiBodyProfile,
  ApiEvaluation,
  ApiIngest,
  ApiOutfit,
  ApiTryOnJob,
  ApiUpload,
  ApiWardrobeItem,
  OutfitGenerationInput,
  WardrobeItemInput,
} from "@/types/api-models";
import type { OccasionType } from "@/types/database";

/**
 * Server actions wrapping the backend. They never expose the API URL or the
 * user's token to the browser and always return a serialisable ActionResult.
 */

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  if (!isDemoMode && !(await getCurrentUser())) {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const code = error instanceof ApiClientError ? error.code : undefined;
    const details = error instanceof ApiClientError ? error.details : undefined;
    return {
      ok: false,
      error: errorMessage(error),
      fieldErrors: code ? { code, ...(Array.isArray(details) ? { details: details.join("\n") } : {}) } : undefined,
    };
  }
}

// ---------------------------------------------------------------- wardrobe

/** One image → background removal → analysis → stored item. */
export async function ingestWardrobeImageAction(formData: FormData): Promise<ActionResult<ApiIngest>> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image first." };
  const result = await guard(() => ingestWardrobeImage(file));
  if (result.ok) revalidatePath("/wardrobe");
  return result;
}

export async function createWardrobeItemAction(input: WardrobeItemInput): Promise<ActionResult<ApiWardrobeItem>> {
  const result = await guard(() => createWardrobeItem(input));
  if (result.ok) revalidatePath("/wardrobe");
  return result;
}

export async function updateWardrobeItemAction(
  id: string,
  patch: Partial<WardrobeItemInput>,
): Promise<ActionResult<ApiWardrobeItem>> {
  const result = await guard(() => updateWardrobeItem(id, patch));
  if (result.ok) {
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${id}`);
  }
  return result;
}

export async function deleteWardrobeItemAction(id: string): Promise<ActionResult> {
  const result = await guard(() => deleteWardrobeItem(id));
  if (result.ok) revalidatePath("/wardrobe");
  return result.ok ? { ok: true } : result;
}

// ---------------------------------------------------------------- outfits

export async function generateOutfitsAction(input: OutfitGenerationInput): Promise<ActionResult<ApiOutfit[]>> {
  return guard(() => generateOutfits(input));
}

export async function evaluateAction(
  itemIds: string[],
  occasion: OccasionType,
  temperatureC?: number | null,
): Promise<ActionResult<ApiEvaluation>> {
  if (itemIds.length === 0) return { ok: false, error: "Pick something first." };
  return guard(() => evaluateCombination(itemIds, occasion, temperatureC));
}

export async function setOutfitSavedAction(outfitId: string, saved: boolean): Promise<ActionResult<ApiOutfit>> {
  const result = await guard(() => setOutfitSaved(outfitId, saved));
  if (result.ok) {
    revalidatePath("/saved-outfits");
    revalidatePath("/home");
  }
  return result;
}

export async function saveCombinationAction(
  itemIds: string[],
  occasion: OccasionType,
  name?: string | null,
): Promise<ActionResult<ApiOutfit>> {
  if (itemIds.length < 2) return { ok: false, error: "An outfit needs at least two pieces." };
  const result = await guard(() => saveCombination(itemIds, occasion, name));
  if (result.ok) {
    revalidatePath("/saved-outfits");
    revalidatePath("/home");
  }
  return result;
}

// ---------------------------------------------------------------- try-on

export async function startTryOnAction(itemIds: string[], outfitId?: string | null): Promise<ActionResult<ApiTryOnJob>> {
  if (itemIds.length === 0) return { ok: false, error: "Pick something to wear first." };
  return guard(() => createTryOnJob(itemIds, outfitId));
}

export async function tryOnJobAction(jobId: string): Promise<ActionResult<ApiTryOnJob>> {
  return guard(() => getTryOnJob(jobId));
}

export async function cachedTryOnAction(itemIds: string[]): Promise<ActionResult<ApiTryOnJob | null>> {
  return guard(() => getCachedTryOn(itemIds));
}

export async function cachedTryOnsAction(
  outfits: Array<{ id: string; item_ids: string[] }>,
): Promise<ActionResult<Record<string, ApiTryOnJob | null>>> {
  return guard(() => getCachedTryOns(outfits));
}

// ---------------------------------------------------------------- photos

export async function uploadImageAction(
  bucket: "wardrobe" | "body-photos",
  formData: FormData,
): Promise<ActionResult<ApiUpload>> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image first." };
  return guard(() => uploadImage(bucket, file));
}

export async function saveBodyPhotosAction(paths: {
  front_image_path?: string | null;
  side_image_path?: string | null;
  back_image_path?: string | null;
}): Promise<ActionResult<ApiBodyProfile>> {
  const result = await guard(() => saveBodyPhotos(paths));
  if (result.ok) {
    revalidatePath("/try-on");
    revalidatePath("/home");
  }
  return result;
}
