import { apiFetch } from "@/lib/api";
import type { ApiBodyProfile, ApiUpload } from "@/types/api-models";

/** Uploads an image through the backend into a private bucket; returns its storage path. */
export async function uploadImage(bucket: "wardrobe" | "body-photos", file: File): Promise<ApiUpload> {
  const formData = new FormData();
  formData.append("image", file, file.name || "image.jpg");
  return apiFetch<ApiUpload>(`/uploads/${bucket}`, { method: "POST", formData, timeoutMs: 60_000 });
}

/** Records the user's photo(s). The front photo is the one that gets dressed. */
export async function saveBodyPhotos(paths: {
  front_image_path?: string | null;
  side_image_path?: string | null;
  back_image_path?: string | null;
}): Promise<ApiBodyProfile> {
  return apiFetch<ApiBodyProfile>("/body/photos", { method: "POST", body: paths });
}

export async function getBodyProfile(): Promise<ApiBodyProfile | null> {
  return apiFetch<ApiBodyProfile | null>("/body/profile");
}

export async function getBodyProfileSafe(): Promise<ApiBodyProfile | null> {
  try {
    return await getBodyProfile();
  } catch {
    return null;
  }
}
