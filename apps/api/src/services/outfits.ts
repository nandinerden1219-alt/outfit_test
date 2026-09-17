/**
 * Outfit generation from the user's own wardrobe:
 *   wardrobe + conditions → engine → diversify → names (LLM optional, IDs only) → reasons → rows.
 * The LLM never chooses or invents items; outfits are described, not ranked as "best".
 */

import {
  MAX_COUNT,
  MAX_OUTFITS,
  MIN_OUTFITS,
  NAMING_PROMPT,
  NAMING_SCHEMA,
  buildContext,
  currentSeason,
  descriptiveReasons,
  deterministicName,
  diversify,
  evaluateCombination,
  itemIds,
  manualSnapshot,
  rankCandidates,
  type Evaluation,
  type GenerationInput,
  type ScoredCandidate,
} from "@outfit/engine";
import type { ApiOutfit, ApiOutfitItem, OccasionType, OutfitSlot } from "@outfit/shared";

import type { Repositories } from "../db/repositories";
import { itemSlot, newId, nowIso, type Outfit, type WardrobeItem } from "../domain";
import { AppError, notFound } from "../errors";
import type { JsonModel } from "./providers";
import type { WardrobeService } from "./wardrobe";

const SLOT_ORDER: OutfitSlot[] = ["outerwear", "layer", "top", "dress", "bottom", "shoes", "accessory"];

export class EmptyWardrobeError extends AppError {
  constructor(message: string, details: string[] = []) {
    super("empty_wardrobe", message, 422, details);
  }
}

export class OutfitService {
  constructor(
    private repos: Repositories,
    private wardrobe: WardrobeService,
    private model: JsonModel | null,
  ) {}

  async toApi(o: Outfit): Promise<ApiOutfit> {
    const refs = [...o.items].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    const items: ApiOutfitItem[] = await Promise.all(refs.map(async (r) => ({ slot: r.slot, item: await this.wardrobe.toApi(r.item) })));
    return { id: o.id, name: o.name, occasion: o.occasion, style: o.style, weather: o.weather, temperature_c: o.temperature_c, reasons: o.reasons, score: o.score, score_breakdown: o.score_breakdown, saved: o.saved, items, created_at: o.created_at };
  }

  async generate(userId: string, inp: GenerationInput): Promise<Outfit[]> {
    const items = (await this.repos.wardrobe.listItems(userId)).filter((i) => i.available);
    if (!items.length) throw new EmptyWardrobeError("Your wardrobe is empty. Add a top, a bottom and shoes to get started.");

    let profile = await this.repos.users.getProfile(userId);
    if (inp.style && profile) profile = { ...profile, style_preferences: [inp.style] };
    else if (inp.style) profile = null;

    const ctx = buildContext(manualSnapshot(inp.temperature_c, inp.weather));
    const season = currentSeason(new Date(), profile?.latitude);
    const count = Math.max(MIN_OUTFITS, Math.min(inp.count ?? MAX_OUTFITS, MAX_COUNT));
    const { scored, assessments } = rankCandidates(items, ctx, inp.occasion, season, profile, null, { exclude: inp.exclude, limit: count * 3 });
    if (!scored.length) {
      const excluded = [...new Set(assessments.filter((a) => a.excluded).map((a) => `${a.item.name || a.item.subcategory || a.item.category}: ${a.excluded}`))].sort();
      throw new EmptyWardrobeError("No outfit fits these conditions from what you own.", excluded.slice(0, 12));
    }

    const chosen = diversify(scored).slice(0, count);
    const withIds = chosen.map((sc) => [newId(), sc] as const);
    const names = await this.names(withIds, inp);
    const byId = new Map(items.map((i) => [i.id, i]));
    const taken = new Set<string>();
    const now = nowIso();
    const out: Outfit[] = [];
    for (const [oid, sc] of withIds) {
      const reasons = descriptiveReasons(sc, ctx, inp);
      const name = names.get(oid) ?? deterministicName(sc.candidate, inp.style, taken);
      taken.add(name);
      const outfit: Outfit = {
        id: oid,
        user_id: userId,
        name,
        occasion: inp.occasion,
        style: inp.style,
        weather: inp.weather ?? null,
        temperature_c: inp.temperature_c,
        reasons,
        score: sc.score,
        score_breakdown: sc.breakdown,
        explanation: reasons.slice(0, 3).join(" · "),
        saved: false,
        items: (Object.entries(sc.candidate.items) as Array<[OutfitSlot, WardrobeItem]>).map(([slot, i]) => ({ slot, item: byId.get(i.id) as WardrobeItem })),
        created_at: now,
      };
      out.push(await this.repos.outfits.createOutfit(outfit));
    }
    return out;
  }

  /** One optional LLM call to name the whole batch. IDs only; anything else is dropped. */
  private async names(withIds: ReadonlyArray<readonly [string, ScoredCandidate]>, inp: GenerationInput): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!this.model || !withIds.length) return out;
    const lines = withIds.map(([oid, sc]) => `OUTFIT ${oid}: ${Object.entries(sc.candidate.items).map(([slot, i]) => `${slot}: ${i.name || i.subcategory || i.category}`).join(", ")}`);
    try {
      const raw = (await this.model.generateJson(NAMING_PROMPT(inp, lines), { schema: NAMING_SCHEMA, temperature: 0.6 })) as { outfits?: Array<{ outfitId?: string; name?: string }> };
      const valid = new Set(withIds.map(([oid]) => oid));
      for (const o of raw?.outfits ?? []) if (o.outfitId && valid.has(o.outfitId) && typeof o.name === "string" && o.name.trim()) out.set(o.outfitId, o.name.trim().slice(0, 40));
    } catch (e) {
      console.info("Outfit naming unavailable:", e instanceof Error ? e.message : e);
    }
    return out;
  }

  async evaluate(userId: string, ids: string[], inp: GenerationInput): Promise<Evaluation> {
    const items = await this.loadItems(userId, ids);
    const profile = await this.repos.users.getProfile(userId);
    return evaluateCombination(items, buildContext(manualSnapshot(inp.temperature_c, inp.weather)), inp.occasion, profile, null);
  }

  async get(userId: string, id: string): Promise<Outfit> {
    const o = await this.repos.outfits.getOutfit(userId, id);
    if (!o) throw notFound("Outfit not found.");
    return o;
  }

  async setSaved(userId: string, id: string, saved: boolean): Promise<Outfit> {
    const o = await this.repos.outfits.setSaved(userId, id, saved);
    if (!o) throw notFound("Outfit not found.");
    return o;
  }

  listSaved(userId: string) {
    return this.repos.outfits.listSaved(userId);
  }

  /** Persist a user-assembled look (e.g. after swapping pieces) as a saved outfit. */
  async saveCombination(userId: string, ids: string[], occasion: OccasionType, name: string | null): Promise<Outfit> {
    const items = await this.loadItems(userId, ids);
    if (items.length < 2) throw new AppError("invalid_outfit", "An outfit needs at least two pieces.");
    const slots: Partial<Record<OutfitSlot, WardrobeItem>> = {};
    for (const item of items) slots[itemSlot(item)] ??= item;
    const outfit: Outfit = {
      id: newId(),
      user_id: userId,
      name: name || deterministicName({ items: slots }, null) || "Saved look",
      occasion,
      style: null,
      weather: null,
      temperature_c: null,
      reasons: ["Saved from your try-on"],
      score: 0,
      score_breakdown: null,
      explanation: null,
      saved: true,
      items: (Object.entries(slots) as Array<[OutfitSlot, WardrobeItem]>).map(([slot, item]) => ({ slot, item })),
      created_at: nowIso(),
    };
    return this.repos.outfits.createOutfit(outfit);
  }

  private async loadItems(userId: string, ids: string[]): Promise<WardrobeItem[]> {
    const out: WardrobeItem[] = [];
    for (const id of new Set(ids)) {
      const item = await this.repos.wardrobe.getItem(userId, id);
      if (!item) throw notFound(`Wardrobe item ${id} not found.`);
      out.push(item);
    }
    return out;
  }
}

export const idsOf = (o: Outfit) => itemIds({ items: Object.fromEntries(o.items.map((r) => [r.slot, r.item])) });
