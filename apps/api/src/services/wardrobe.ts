/**
 * Wardrobe CRUD + the per-image ingest pipeline:
 *   original → store → background removal → analysis (one call) → derived fields → row.
 * One image = one analysis, ever; edits are manual.
 */

import { engineFields, formalityLabel, needsReview, type ClothingAnalysis } from "@outfit/engine";
import type { ApiWardrobeItem } from "@outfit/shared";

import type { Repositories } from "../db/repositories";
import { itemLabel, itemSlot, newId, type WardrobeItem } from "../domain";
import { AppError, assertOwnerPath, notFound } from "../errors";
import { EXTENSIONS, type Storage } from "../storage/storage";
import type { BackgroundRemover, ClothingAnalyzer, ImageInput } from "./providers";

export type IngestResult = { item: WardrobeItem; analyzed: boolean; background_removed: boolean; needs_review: boolean };

export class WardrobeService {
  constructor(
    private repos: Repositories,
    private storage: Storage,
    private analyzer: ClothingAnalyzer | null,
    private remover: BackgroundRemover,
  ) {}

  list(userId: string) {
    return this.repos.wardrobe.listItems(userId);
  }

  async get(userId: string, id: string): Promise<WardrobeItem> {
    const item = await this.repos.wardrobe.getItem(userId, id);
    if (!item) throw notFound("Wardrobe item not found.");
    return item;
  }

  /** Public view: signed URLs + derived fields; provider internals stay server-side. */
  async toApi(item: WardrobeItem): Promise<ApiWardrobeItem> {
    const { ai_raw: _raw, ai_model: _model, ...rest } = item;
    const [image_url, original_image_url] = await Promise.all([
      this.storage.signedUrl("wardrobe", item.image_path),
      item.original_image_path ? this.storage.signedUrl("wardrobe", item.original_image_path) : Promise.resolve(null),
    ]);
    return { ...rest, image_url, original_image_url, formality_label: formalityLabel(item.formality), slot: itemSlot(item), label: itemLabel(item) };
  }

  toApiMany(items: WardrobeItem[]) {
    return Promise.all(items.map((i) => this.toApi(i)));
  }

  async ingest(userId: string, image: ImageInput, analyze = true): Promise<IngestResult> {
    const base = `${userId}/${newId()}`;
    const originalPath = `${base}.${EXTENSIONS[image.mimeType] ?? "jpg"}`;
    await this.storage.upload("wardrobe", originalPath, image.data, image.mimeType);

    const processed = await this.remover.remove(image);
    let processedPath = originalPath;
    let backgroundRemoved = false;
    if (processed) {
      processedPath = `${base}-cutout.png`;
      await this.storage.upload("wardrobe", processedPath, processed.data, processed.mimeType);
      backgroundRemoved = true;
    }

    let analysis: ClothingAnalysis | null = null;
    let analyzed = false;
    if (analyze && this.analyzer) {
      try {
        analysis = await this.analyzer.analyze(processed ?? image);
        analyzed = true;
      } catch (e) {
        console.info("Clothing analysis unavailable:", e instanceof Error ? e.message : e);
      }
    }

    const row = rowFromAnalysis(analysis);
    const review = analysis ? needsReview(analysis) : true;
    const item = await this.repos.wardrobe.createItem(userId, {
      ...row,
      image_path: processedPath,
      original_image_path: originalPath,
      processed_image_path: processedPath,
      background_removed: backgroundRemoved,
      ai_model: analyzed && this.analyzer ? this.analyzer.name : null,
      ai_confidence: analysis?.confidence ?? null,
      ai_raw: analysis ? (analysis as unknown as Record<string, unknown>) : null,
      needs_review: review,
    });
    return { item, analyzed, background_removed: backgroundRemoved, needs_review: review };
  }

  async analyze(image: ImageInput): Promise<{ analysis: ClothingAnalysis; needs_review: boolean }> {
    if (!this.analyzer) throw new AppError("ai_unavailable", "Clothing analysis is not configured on this server.", 503);
    const analysis = await this.analyzer.analyze(image);
    return { analysis, needs_review: needsReview(analysis) };
  }

  async create(userId: string, data: Partial<WardrobeItem> & { image_path: string; category: WardrobeItem["category"] }) {
    assertOwnerPath(userId, data.image_path);
    for (const key of ["original_image_path", "processed_image_path"] as const) {
      const v = data[key];
      if (v) assertOwnerPath(userId, v);
      else data[key] = data.image_path;
    }
    return this.repos.wardrobe.createItem(userId, data);
  }

  async update(userId: string, id: string, data: Partial<WardrobeItem>) {
    if (data.image_path) assertOwnerPath(userId, data.image_path);
    const updated = await this.repos.wardrobe.updateItem(userId, id, data);
    if (!updated) throw notFound("Wardrobe item not found.");
    return updated;
  }

  async delete(userId: string, id: string) {
    const item = await this.get(userId, id);
    if (!(await this.repos.wardrobe.deleteItem(userId, id))) throw notFound("Wardrobe item not found.");
    for (const path of new Set([item.image_path, item.original_image_path, item.processed_image_path])) if (path) await this.storage.delete("wardrobe", path);
  }
}

function rowFromAnalysis(a: ClothingAnalysis | null): Partial<WardrobeItem> & { category: WardrobeItem["category"] } {
  if (!a) {
    // Placeholder until the user confirms; flagged needs_review.
    return { category: "top", name: null, subcategory: null, pattern: null, dominant_color: null, secondary_colors: [], material: null, season: [], style: [], warmth: null, formality: null, occasions: [], fit: null };
  }
  const derived = engineFields(a);
  return {
    name: a.name,
    category: a.category ?? "top",
    subcategory: a.subcategory,
    pattern: a.pattern,
    dominant_color: a.color,
    secondary_colors: a.secondary_colors,
    material: a.material,
    season: a.season,
    style: derived.style,
    warmth: derived.warmth,
    formality: derived.formality,
    occasions: derived.occasions,
    layering: derived.layering,
    rain_protection: derived.rain_protection,
    wind_protection: derived.wind_protection,
    fit: null,
  };
}
