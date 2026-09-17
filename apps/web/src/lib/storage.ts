"use client";

import { uploadImageAction } from "@/app/(app)/actions";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "Use a JPEG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 10 MB or smaller.";
  return null;
}

/**
 * Uploads an image into a private bucket via the backend (service role in
 * production, in-memory store in demo mode). Object paths are always
 * "<user_id>/<uuid>.<ext>"; the backend refuses anything else.
 * Returns the storage path (never a public URL) plus a short-lived URL for display.
 */
export async function uploadPrivateImage(
  bucket: "wardrobe" | "body-photos",
  file: File,
): Promise<{ path: string; url: string | null }> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const formData = new FormData();
  formData.append("image", file);
  const result = await uploadImageAction(bucket, formData);
  if (!result.ok || !result.data) throw new Error(result.ok ? "Upload failed." : result.error);
  return { path: result.data.path, url: result.data.url };
}
