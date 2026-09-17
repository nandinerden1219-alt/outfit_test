/**
 * Asynchronous virtual try-on jobs.
 *   POST /try-on/jobs → job (queued) → queue/background: prepare → dress → store → completed
 * Identical (person photo, item ids) requests reuse the completed result.
 */

import type { ApiTryOnJob } from "@outfit/shared";

import type { Repositories } from "../db/repositories";
import { isActiveJob, itemLabel, newId, nowIso, type TryOnJob, type WardrobeItem } from "../domain";
import { AppError, notFound } from "../errors";
import { mimeForPath, type Storage } from "../storage/storage";
import { REGION_BY_CATEGORY, type GarmentInput, type VirtualTryOnService } from "./providers";

export const STEPS = {
  queued: ["Preparing your outfit…", 5],
  preparing: ["Preparing your outfit…", 15],
  dressing: ["AI is dressing you…", 45],
  saving: ["Generating image…", 85],
  completed: ["Completed", 100],
} as const;

export async function cacheKeyFor(personPath: string, itemIds: string[]): Promise<string> {
  const raw = [personPath, ...[...new Set(itemIds)].sort()].join("|");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class TryOnJobService {
  constructor(
    private repos: Repositories,
    private storage: Storage,
    private tryon: VirtualTryOnService,
  ) {}

  async toApi(job: TryOnJob): Promise<ApiTryOnJob> {
    const [result_image_url, person_image_url] = await Promise.all([
      job.result_image_path ? this.storage.signedUrl("try-on", job.result_image_path) : Promise.resolve(null),
      this.storage.signedUrl("body-photos", job.person_image_path),
    ]);
    return {
      id: job.id,
      outfit_id: job.outfit_id,
      item_ids: job.item_ids,
      status: job.status,
      is_active: isActiveJob(job),
      step: job.step,
      progress: job.progress,
      result_image_url,
      person_image_url,
      applied: job.applied,
      skipped: job.skipped,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  async get(userId: string, id: string): Promise<TryOnJob> {
    const job = await this.repos.tryOnJobs.get(userId, id);
    if (!job) throw notFound("Try-on job not found.");
    return job;
  }

  recent(userId: string, limit = 20) {
    return this.repos.tryOnJobs.listRecent(userId, limit);
  }

  cachedForItems(userId: string, itemIds: string[]) {
    return this.repos.tryOnJobs.latestCompletedForItems(userId, [...new Set(itemIds)]);
  }

  /** Returns [job, created]. Cached completed results and active duplicates are returned as-is. */
  async start(userId: string, itemIds: string[], outfitId: string | null): Promise<[TryOnJob, boolean]> {
    const body = await this.repos.body.latest(userId);
    if (!body?.front_image_path) throw new AppError("missing_photo", "Add a photo of yourself first.");
    const ids = [...new Set(itemIds)];
    if (!ids.length) throw new AppError("missing_garments", "Choose at least one piece of clothing.");

    let supported = 0;
    for (const id of ids) {
      const item = await this.repos.wardrobe.getItem(userId, id);
      if (!item) throw notFound(`Wardrobe item ${id} not found.`);
      if (REGION_BY_CATEGORY[item.category]) supported++;
    }
    if (!supported) throw new AppError("unsupported_garments", "Try-on works with tops, bottoms, dresses and outerwear. Shoes and accessories are shown but not dressed.");

    const key = await cacheKeyFor(body.front_image_path, ids);
    const existing = await this.repos.tryOnJobs.findCached(userId, key);
    if (existing) return [existing, false];

    const now = nowIso();
    const job: TryOnJob = {
      id: newId(),
      user_id: userId,
      outfit_id: outfitId,
      item_ids: ids,
      person_image_path: body.front_image_path,
      cache_key: key,
      status: "queued",
      step: STEPS.queued[0],
      progress: STEPS.queued[1],
      provider: this.tryon.name,
      result_image_path: null,
      applied: [],
      skipped: [],
      error: null,
      created_at: now,
      updated_at: now,
    };
    return [await this.repos.tryOnJobs.create(job), true];
  }

  private step(jobId: string, key: keyof typeof STEPS, extra: Partial<TryOnJob> = {}) {
    const [label, progress] = STEPS[key];
    return this.repos.tryOnJobs.update(jobId, { status: key === "completed" ? "completed" : "processing", step: label, progress, ...extra });
  }

  /** Executes a queued job. Every exit path ends in completed or failed. */
  async run(jobId: string, userId: string): Promise<void> {
    const job = await this.repos.tryOnJobs.get(userId, jobId);
    if (!job || job.status !== "queued") return;
    try {
      await this.step(job.id, "preparing");
      const person = await this.storage.download("body-photos", job.person_image_path);
      const { garments, skipped } = await this.loadGarments(userId, job.item_ids);
      if (!garments.length) throw new AppError("missing_garments", `None of the selected pieces have photos the try-on model can use${skipped.length ? ` (skipped: ${skipped.join(", ")})` : ""}.`);

      await this.step(job.id, "dressing");
      const result = await this.tryon.generateTryOn({ person: { data: person.data, mimeType: person.contentType || mimeForPath(job.person_image_path) }, garments });
      if (result.status !== "ok" || !result.image) throw new AppError("tryon_unavailable", result.message ?? "Virtual try-on is not available right now.");

      await this.step(job.id, "saving");
      const path = `${userId}/${job.id}.${result.image.mimeType === "image/png" ? "png" : "jpg"}`;
      await this.storage.upload("try-on", path, result.image.data, result.image.mimeType);
      await this.step(job.id, "completed", { result_image_path: path, applied: result.applied, skipped: [...skipped, ...result.skipped], error: null });
    } catch (e) {
      const message = e instanceof AppError ? e.message : "Something went wrong while generating your look. Please try again.";
      if (!(e instanceof AppError)) console.error("Try-on job crashed", jobId, e);
      await this.repos.tryOnJobs.update(job.id, { status: "failed", step: null, error: message });
    }
  }

  private async loadGarments(userId: string, itemIds: string[]): Promise<{ garments: GarmentInput[]; skipped: string[] }> {
    const garments: GarmentInput[] = [];
    const skipped: string[] = [];
    for (const id of itemIds.slice(0, 8)) {
      const item: WardrobeItem | null = await this.repos.wardrobe.getItem(userId, id);
      if (!item) throw notFound(`Wardrobe item ${id} not found.`);
      const region = REGION_BY_CATEGORY[item.category];
      if (!region) {
        skipped.push(itemLabel(item));
        continue;
      }
      try {
        const file = await this.storage.download("wardrobe", item.image_path);
        garments.push({ image: { data: file.data, mimeType: file.contentType || mimeForPath(item.image_path) }, region, label: itemLabel(item) });
      } catch {
        skipped.push(`${itemLabel(item)} (no photo)`);
      }
    }
    return { garments, skipped };
  }
}
