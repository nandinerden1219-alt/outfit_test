/**
 * Deterministic outfit engine: filtering, candidate generation, scoring, explanations.
 * Pure functions over plain objects — no I/O — so the whole pipeline is unit-testable.
 *
 *   WARDROBE → weather filter → season filter → occasion filter → compatibility
 *            → candidate generation → scoring → top N
 */

import type { ApiScoreBreakdown, OccasionType, OutfitSlot, PreferredFit, SeasonType, WardrobeCategory } from "@outfit/shared";

import * as sw from "./rules";
import { ruleFor, type OccasionRule } from "./rules";
import { slotForItem } from "./taxonomy";
import type { WeatherContext } from "./weather";

// ---------------------------------------------------------------- inputs

/** The subset of a wardrobe row the engine reads. */
export type EngineItem = {
  id: string;
  name: string | null;
  category: WardrobeCategory;
  subcategory: string | null;
  dominant_color: string | null;
  material: string | null;
  season: SeasonType[];
  warmth: number | null;
  style: string[];
  fit: string | null;
  formality: number | null;
  occasions: OccasionType[];
  rain_protection: boolean;
  wind_protection: boolean;
  available: boolean;
};

export type EngineProfile = {
  style_preferences: string[];
  favorite_colors: string[];
  avoid_colors: string[];
  preferred_fit: PreferredFit | null;
  latitude?: number | null;
};

export type EnginePreferences = {
  color_weights: Record<string, number>;
  style_weights: Record<string, number>;
  category_weights: Record<string, number>;
  fit_weights: Record<string, number>;
  material_weights: Record<string, number>;
  interaction_count: number;
};

export const DEFAULT_WARMTH = 2;
export const DEFAULT_FORMALITY = 2;
export const REQUIRED_SLOTS: readonly OutfitSlot[] = ["top", "bottom", "shoes"];
const RELAXED_WEATHER_SCORE = 15;

export const label = (item: EngineItem): string => item.name || item.subcategory || item.category;
export const slotFor = (item: EngineItem): OutfitSlot => slotForItem(item.category, item.subcategory);
const sub = (item: EngineItem) => (item.subcategory || item.name || "").toLowerCase();
const warmth = (item: EngineItem) => (item.warmth ?? DEFAULT_WARMTH);
const formality = (item: EngineItem) => item.formality ?? DEFAULT_FORMALITY;
const isOpenShoe = (item: EngineItem) => sw.OPEN_SHOE_KEYWORDS.some((k) => sub(item).includes(k));
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---------------------------------------------------------------- season

export function currentSeason(day: Date, latitude: number | null | undefined): SeasonType {
  const month = day.getUTCMonth() + 1;
  const northern = latitude === null || latitude === undefined || latitude >= 0;
  const n: Record<number, SeasonType> = { 12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn" };
  const s: Record<number, SeasonType> = { 12: "summer", 1: "summer", 2: "summer", 3: "autumn", 4: "autumn", 5: "autumn", 6: "winter", 7: "winter", 8: "winter", 9: "spring", 10: "spring", 11: "spring" };
  return (northern ? n : s)[month] ?? "spring";
}

// ---------------------------------------------------------------- per-item checks

export type ItemAssessment = {
  item: EngineItem;
  slot: OutfitSlot;
  weatherScore: number;
  occasionScore: number;
  excluded: string | null;
  excludedKind: "warmth" | "hard" | "occasion" | "other" | null;
  relaxed: boolean;
};

export function assessWeather(item: EngineItem, slot: OutfitSlot, ctx: WeatherContext): [number, string | null] {
  const band = ctx.band;
  if (slot === "accessory") {
    if (warmth(item) >= 3 && (band.name === "mild" || band.name === "warm")) return [0, "too warm for today"];
    return [80, null];
  }
  if (slot === "bottom" && sw.BARE_LEG_KEYWORDS.some((k) => sub(item).includes(k)) && !band.allowBareLegs) {
    return [0, `bare legs are not suitable in ${band.label.toLowerCase()} weather`];
  }
  if (slot === "dress" && !band.allowBareLegs) return [0, `a dress alone is not suitable in ${band.label.toLowerCase()} weather`];
  if (slot === "shoes" && isOpenShoe(item)) {
    if (ctx.snowExpected) return [0, "open shoes are not suitable in snow"];
    if (band.name !== "mild" && band.name !== "warm") return [0, `open shoes are not suitable in ${band.label.toLowerCase()} weather`];
  }
  if (slot === "outerwear" && band.outerwear === "none") return [0, "no outerwear needed today"];
  if (slot === "layer" && band.layer === "none") return [0, "no extra layer needed today"];

  const target = band.targetWarmth[slot] ?? DEFAULT_WARMTH;
  const deviation = Math.abs(warmth(item) - target);
  if (deviation > band.maxWarmthDeviation) {
    return [0, `too ${warmth(item) > target ? "warm" : "light"} for ${band.label.toLowerCase()} weather`];
  }
  let score = 100 - deviation * 30;
  if (slot === "shoes" && isOpenShoe(item) && ctx.rainExpected) score -= 25;
  if (ctx.rainExpected && item.rain_protection && (slot === "shoes" || slot === "outerwear")) score += 10;
  if (ctx.strongWind && item.wind_protection && slot === "outerwear") score += 10;
  return [clamp(score), null];
}

export function assessOccasion(item: EngineItem, slot: OutfitSlot, rule: OccasionRule, occasion: OccasionType): [number, string | null] {
  if ([...rule.bannedKeywords].some((k) => sub(item).includes(k))) return [0, `${label(item)} is not worn for ${rule.label.toLowerCase()}`];
  const garmentSlot = slot === "top" || slot === "bottom" || slot === "shoes" || slot === "dress" || slot === "layer";
  if (rule.requiredStyle && garmentSlot && !item.style.includes(rule.requiredStyle)) {
    return [0, `${rule.label.toLowerCase()} needs ${rule.requiredStyle} pieces`];
  }
  const f = formality(item);
  let lo = rule.formalityMin;
  const hi = rule.formalityMax;
  if (slot === "shoes") lo = Math.max(lo, rule.shoesFormalityMin);
  const distance = Math.max(0, lo - f, f - hi);
  if (distance > 1) return [0, `${label(item)} is too ${f < lo ? "casual" : "formal"} for ${rule.label.toLowerCase()}`];

  let score = 100 - distance * 30;
  if (rule.preferredStyles.size && item.style.some((s) => rule.preferredStyles.has(s))) score += 10;
  if (item.occasions.length && !item.occasions.includes(occasion)) score -= 15;
  if (rule.preferNeutralColors && item.dominant_color && !sw.NEUTRAL_COLORS.has(item.dominant_color)) score -= 5;
  return [clamp(score), null];
}

export function assessItems(items: EngineItem[], ctx: WeatherContext, occasion: OccasionType, season: SeasonType): ItemAssessment[] {
  const rule = ruleFor(occasion);
  const out: ItemAssessment[] = [];
  const mk = (item: EngineItem, slot: OutfitSlot, extra: Partial<ItemAssessment>): ItemAssessment => ({
    item,
    slot,
    weatherScore: 0,
    occasionScore: 0,
    excluded: null,
    excludedKind: null,
    relaxed: false,
    ...extra,
  });
  for (const item of items) {
    const slot = slotFor(item);
    if (!item.available) {
      out.push(mk(item, slot, { excluded: "marked unavailable", excludedKind: "other" }));
      continue;
    }
    if (item.season.length && !item.season.includes(season)) {
      out.push(mk(item, slot, { excluded: `not a ${season} piece`, excludedKind: "other" }));
      continue;
    }
    const [wScore, wReason] = assessWeather(item, slot, ctx);
    if (wReason) {
      out.push(mk(item, slot, { excluded: wReason, excludedKind: wReason.startsWith("too ") ? "warmth" : "hard" }));
      continue;
    }
    const [oScore, oReason] = assessOccasion(item, slot, rule, occasion);
    if (oReason) {
      out.push(mk(item, slot, { excluded: oReason, excludedKind: "occasion" }));
      continue;
    }
    out.push(mk(item, slot, { weatherScore: wScore, occasionScore: oScore }));
  }
  return relaxEmptyRequiredSlots(out, ctx, rule, occasion);
}

/** If a required slot has no weather-suitable item, fall back to the closest warmth the user owns. */
function relaxEmptyRequiredSlots(assessments: ItemAssessment[], ctx: WeatherContext, rule: OccasionRule, occasion: OccasionType): ItemAssessment[] {
  const usable = new Set(assessments.filter((a) => a.excluded === null).map((a) => a.slot));
  for (const slot of REQUIRED_SLOTS) {
    if (usable.has(slot)) continue;
    const target = ctx.band.targetWarmth[slot] ?? DEFAULT_WARMTH;
    const pool = assessments.filter((a) => a.slot === slot && a.excludedKind === "warmth").sort((a, b) => Math.abs(warmth(a.item) - target) - Math.abs(warmth(b.item) - target));
    for (const a of pool.slice(0, 2)) {
      const [oScore, oReason] = assessOccasion(a.item, slot, rule, occasion);
      if (oReason) continue;
      a.excluded = null;
      a.excludedKind = null;
      a.relaxed = true;
      a.weatherScore = RELAXED_WEATHER_SCORE;
      a.occasionScore = oScore;
    }
  }
  return assessments;
}

// ---------------------------------------------------------------- candidates

export type Candidate = { items: Partial<Record<OutfitSlot, EngineItem>> };

export const garments = (c: Candidate): Array<[OutfitSlot, EngineItem]> => Object.entries(c.items).filter((e): e is [OutfitSlot, EngineItem] => Boolean(e[1]));
export const itemIds = (c: Candidate): string[] => garments(c).map(([, i]) => i.id).sort();
const idKey = (ids: string[]) => [...ids].sort().join("|");

function bucket(assessments: ItemAssessment[]): Record<OutfitSlot, ItemAssessment[]> {
  const buckets: Record<OutfitSlot, ItemAssessment[]> = { top: [], layer: [], outerwear: [], bottom: [], dress: [], shoes: [], accessory: [] };
  for (const a of assessments) if (a.excluded === null) buckets[a.slot].push(a);
  for (const slot of Object.keys(buckets) as OutfitSlot[]) {
    buckets[slot].sort((a, b) => b.weatherScore + b.occasionScore - (a.weatherScore + a.occasionScore));
    buckets[slot] = buckets[slot].slice(0, sw.PER_SLOT_LIMIT);
  }
  return buckets;
}

export function generateCandidates(assessments: ItemAssessment[], ctx: WeatherContext): Candidate[] {
  const b = bucket(assessments);
  const band = ctx.band;
  let tops = b.top.map((a) => a.item);
  let layers = b.layer.map((a) => a.item);
  const outers = b.outerwear.map((a) => a.item);
  const bottoms = b.bottom.map((a) => a.item);
  const dresses = b.dress.map((a) => a.item);
  const shoes = b.shoes.map((a) => a.item);
  const accessories = b.accessory.map((a) => a.item);

  // A sweater can stand in as the top when the user owns no plain tops.
  if (!tops.length && layers.length) {
    tops = layers;
    layers = [];
  }
  const layerOptions: Array<EngineItem | null> = layers.slice(0, 3);
  if (band.layer !== "required" || !layers.length) layerOptions.push(null);
  const outerOptions: Array<EngineItem | null> = outers.slice(0, 3);
  if (band.outerwear !== "required" || !outers.length) outerOptions.push(null);
  if (!shoes.length) return [];

  const accessoryChoices: Array<EngineItem | null> = [null, ...accessories.slice(0, 2)];
  const out: Candidate[] = [];
  const push = (base: Partial<Record<OutfitSlot, EngineItem>>, layer: EngineItem | null, outer: EngineItem | null) => {
    const items = { ...base };
    if (layer) items.layer = layer;
    if (outer) items.outerwear = outer;
    for (const accessory of accessoryChoices) out.push({ items: accessory ? { ...items, accessory } : { ...items } });
  };
  for (const top of tops) for (const bottom of bottoms) for (const shoe of shoes) for (const layer of layerOptions) for (const outer of outerOptions) push({ top, bottom, shoes: shoe }, layer, outer);
  for (const dress of dresses) for (const shoe of shoes) for (const layer of layerOptions) for (const outer of outerOptions) push({ dress, shoes: shoe }, layer, outer);
  return out;
}

// ---------------------------------------------------------------- scoring

export type ScoredCandidate = { candidate: Candidate; score: number; breakdown: ApiScoreBreakdown; reasons: string[]; issues: string[] };

function colorScore(c: Candidate, profile: EngineProfile | null): number {
  const colors = garments(c).map(([, i]) => i.dominant_color).filter((x): x is string => Boolean(x));
  const accents = colors.filter((x) => !sw.NEUTRAL_COLORS.has(x));
  let score: number;
  if (!accents.length) score = sw.COLOR_SCORES.all_neutral;
  else if (accents.length === 1) score = sw.COLOR_SCORES.one_accent;
  else if (accents.length > sw.MAX_ACCENT_COLORS) score = sw.COLOR_SCORES.too_many_accents;
  else score = new Set(accents.map((x) => sw.COLOR_FAMILIES[x] ?? "other")).size === 1 ? sw.COLOR_SCORES.same_family : sw.COLOR_SCORES.mixed_family;
  if (profile) {
    score += sw.FAVORITE_COLOR_BONUS * colors.filter((x) => profile.favorite_colors.includes(x)).length;
    score -= sw.AVOID_COLOR_PENALTY * colors.filter((x) => profile.avoid_colors.includes(x)).length;
  }
  return clamp(score);
}

function styleScore(c: Candidate, profile: EngineProfile | null): number {
  if (!profile?.style_preferences.length) return 70;
  const prefs = new Set(profile.style_preferences);
  const gs = garments(c).map(([, i]) => i);
  const matching = gs.filter((i) => i.style.some((s) => prefs.has(s))).length;
  return gs.length ? (100 * matching) / gs.length : 0;
}

function fitScore(c: Candidate, profile: EngineProfile | null): number {
  if (!profile?.preferred_fit) return 70;
  const gs = garments(c).filter(([s, i]) => s !== "shoes" && s !== "accessory" && i.fit).map(([, i]) => i);
  if (!gs.length) return 70;
  const neighbours: Record<string, string[]> = { fitted: ["regular"], regular: ["fitted", "relaxed"], relaxed: ["regular", "oversized"], oversized: ["relaxed"] };
  const preferred = profile.preferred_fit;
  const total = gs.reduce((acc, i) => acc + (i.fit === preferred ? 100 : (neighbours[preferred] ?? []).includes(i.fit as string) ? 70 : 35), 0);
  return total / gs.length;
}

function preferenceScore(c: Candidate, prefs: EnginePreferences | null): number {
  if (!prefs || prefs.interaction_count === 0) return 50;
  const signals: number[] = [];
  for (const [, item] of garments(c)) {
    if (item.dominant_color) signals.push(prefs.color_weights[item.dominant_color] ?? 0);
    for (const s of item.style) signals.push(prefs.style_weights[s] ?? 0);
    signals.push(prefs.category_weights[item.category] ?? 0);
    if (item.fit) signals.push(prefs.fit_weights[item.fit] ?? 0);
    if (item.material) signals.push(prefs.material_weights[item.material.toLowerCase()] ?? 0);
  }
  return signals.length ? clamp(50 + sw.PREFERENCE_SCALE * mean(signals)) : 50;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreCandidate(c: Candidate, ctx: WeatherContext, occasion: OccasionType, profile: EngineProfile | null, prefs: EnginePreferences | null): ScoredCandidate {
  const rule = ruleFor(occasion);
  const band = ctx.band;
  const issues: string[] = [];

  // --- weather
  const weatherParts: number[] = [];
  const relaxed: EngineItem[] = [];
  for (const [slot, item] of garments(c)) {
    if (slot === "accessory") continue;
    let [score, reason] = assessWeather(item, slot, ctx);
    if (reason && reason.startsWith("too ") && REQUIRED_SLOTS.includes(slot)) {
      relaxed.push(item);
      score = RELAXED_WEATHER_SCORE;
    } else if (reason) issues.push(`${label(item)}: ${reason}`);
    weatherParts.push(score);
  }
  let weather = mean(weatherParts);
  if (relaxed.length) issues.push(`Light for this weather: ${relaxed.map(label).join(", ")}`);
  const outer = c.items.outerwear;
  const layer = c.items.layer;
  const shoe = c.items.shoes;
  if (band.outerwear === "required" && !outer) {
    weather -= 40;
    issues.push(`No outerwear for ${band.label.toLowerCase()} weather`);
  }
  if (band.layer === "required" && !layer) {
    weather -= 15;
    issues.push("Missing a warm layer");
  }
  if (ctx.layeringRecommended && layer && outer) weather += 5;
  weather = clamp(weather);

  // --- occasion
  const occasionParts: number[] = [];
  for (const [slot, item] of garments(c)) {
    const [score, reason] = assessOccasion(item, slot, rule, occasion);
    if (reason) issues.push(reason.charAt(0).toUpperCase() + reason.slice(1));
    occasionParts.push(score);
  }
  let occasionScore = mean(occasionParts);
  if (layer && sub(layer).includes("hoodie") && outer && formality(outer) >= 4) {
    occasionScore -= 15;
    issues.push("A hoodie under formal outerwear clashes");
  }
  const formalities = garments(c).filter(([s]) => s !== "accessory").map(([, i]) => formality(i));
  if (formalities.length && Math.max(...formalities) - Math.min(...formalities) > 2) {
    occasionScore -= 15;
    issues.push("Pieces differ a lot in formality");
  }
  occasionScore = clamp(occasionScore);

  const style = styleScore(c, profile);
  const color = colorScore(c, profile);
  const fit = fitScore(c, profile);
  const preference = preferenceScore(c, prefs);
  const breakdown: ApiScoreBreakdown = {
    weather: round1(weather),
    occasion: round1(occasionScore),
    style: round1(style),
    color: round1(color),
    fit: round1(fit),
    user_preference: round1(preference),
  };
  const total = weather * sw.WEIGHTS.weather + occasionScore * sw.WEIGHTS.occasion + style * sw.WEIGHTS.style + color * sw.WEIGHTS.color + fit * sw.WEIGHTS.fit + preference * sw.WEIGHTS.user_preference;

  const reasons = buildReasons(c, ctx, occasion, profile, breakdown);
  if (color <= sw.COLOR_SCORES.too_many_accents) issues.push("Too many accent colours");
  if (profile && garments(c).some(([, i]) => i.dominant_color && profile.avoid_colors.includes(i.dominant_color))) issues.push("Uses a colour you avoid");
  if (shoe && isOpenShoe(shoe) && ctx.rainExpected) issues.push("Open shoes with rain expected");

  return { candidate: c, score: round1(clamp(total)), breakdown, reasons, issues };
}

export function buildReasons(c: Candidate, ctx: WeatherContext, occasion: OccasionType, profile: EngineProfile | null, breakdown: ApiScoreBreakdown): string[] {
  const reasons: string[] = [];
  const snap = ctx.snapshot;
  const band = ctx.band;
  const outer = c.items.outerwear;
  const layer = c.items.layer;
  const shoe = c.items.shoes;
  if (breakdown.weather >= 60) reasons.push(`Suitable for ${Math.round(snap.feels_like)}°C feels-like (${band.label.toLowerCase()})`);
  if (ctx.strongWind && outer?.wind_protection) reasons.push(`Wind-resistant ${label(outer)} for ${Math.round(snap.wind_speed ?? 0)} km/h wind`);
  if (ctx.rainExpected && (shoe?.rain_protection || outer?.rain_protection)) reasons.push("Rain-ready pieces for the wet forecast");
  if (ctx.layeringRecommended && layer) {
    const parts: string[] = [];
    if (ctx.morningFeelsLike !== null) parts.push(`${Math.round(ctx.morningFeelsLike)}° in the morning`);
    if (ctx.afternoonFeelsLike !== null) parts.push(`${Math.round(ctx.afternoonFeelsLike)}° in the afternoon`);
    reasons.push(`A removable layer for today's temperature swing${parts.length ? ` (${parts.join(", ")})` : ""}`);
  }
  if (profile?.style_preferences.length) {
    const prefs = new Set(profile.style_preferences);
    const hit = garments(c).flatMap(([, i]) => i.style).find((s) => prefs.has(s));
    if (hit) reasons.push(`Matches your ${hit.replace(/_/g, " ")} style`);
  }
  if (breakdown.occasion >= 70) reasons.push(`Formality fits ${ruleFor(occasion).label.toLowerCase()}`);
  if (breakdown.color >= 80) reasons.push("Cohesive colour palette");
  reasons.push("Uses your existing wardrobe");
  return reasons.slice(0, 5);
}

// ---------------------------------------------------------------- pipeline

export type RankOptions = { exclude?: string[][]; limit?: number };

/** Full deterministic pipeline: scored candidates (best first) + per-item assessments. */
export function rankCandidates(
  items: EngineItem[],
  ctx: WeatherContext,
  occasion: OccasionType,
  season: SeasonType,
  profile: EngineProfile | null,
  prefs: EnginePreferences | null,
  options: RankOptions = {},
): { scored: ScoredCandidate[]; assessments: ItemAssessment[] } {
  const assessments = assessItems(items, ctx, occasion, season);
  const candidates = generateCandidates(assessments, ctx);
  const excluded = new Set((options.exclude ?? []).map(idKey));
  const limit = options.limit ?? sw.RANKER_CANDIDATES;
  const scored = candidates
    .filter((c) => !excluded.has(idKey(itemIds(c))))
    .map((c) => scoreCandidate(c, ctx, occasion, profile, prefs))
    .sort((a, b) => b.score - a.score);

  // Diversify: avoid near-duplicates (same top+bottom with a different bag).
  const seenCores = new Set<string>();
  const diverse: ScoredCandidate[] = [];
  for (const s of scored) {
    const core = idKey(garments(s.candidate).filter(([slot]) => slot === "top" || slot === "bottom" || slot === "dress").map(([, i]) => i.id));
    if (seenCores.has(core)) continue;
    seenCores.add(core);
    diverse.push(s);
    if (diverse.length >= limit) break;
  }
  return { scored: diverse, assessments };
}

export type Evaluation = { verdict: "match" | "almost" | "mismatch"; score: number; breakdown: ApiScoreBreakdown; reasons: string[]; issues: string[] };

/** Judge a user-assembled combination; structural problems become issues, never errors. */
export function evaluateCombination(items: EngineItem[], ctx: WeatherContext, occasion: OccasionType, profile: EngineProfile | null, prefs: EnginePreferences | null): Evaluation {
  const slots: Partial<Record<OutfitSlot, EngineItem>> = {};
  const issues: string[] = [];
  for (const item of items) {
    const slot = slotFor(item);
    const existing = slots[slot];
    if (existing) issues.push(`Two ${slot} pieces: ${label(existing)} and ${label(item)}`);
    slots[slot] = item;
  }
  const hasDress = Boolean(slots.dress);
  const hasTop = Boolean(slots.top) || (Boolean(slots.layer) && !hasDress);
  if (!hasDress && !hasTop) issues.push("Add a top");
  if (!hasDress && !slots.bottom) issues.push("Add a bottom");
  if (hasDress && slots.bottom) issues.push("A dress and a bottom together is unusual");
  if (!slots.shoes) issues.push("Add shoes");
  if (!slots.top && slots.layer && !hasDress) {
    slots.top = slots.layer;
    delete slots.layer;
  }
  const scored = scoreCandidate({ items: slots }, ctx, occasion, profile, prefs);
  const all = [...issues, ...scored.issues];
  const structural = issues.length > 0;
  const text = all.join(" ").toLowerCase();
  const hard = ["not suitable", "not worn", "needs", "too casual", "too formal", "too light", "too warm"].some((k) => text.includes(k));
  let verdict: Evaluation["verdict"];
  if (!structural && !hard && scored.score >= 70) verdict = "match";
  else if (!structural && !hard && scored.score >= 55 && all.length <= 1) verdict = "almost";
  else verdict = "mismatch";
  return { verdict, score: scored.score, breakdown: scored.breakdown, reasons: scored.reasons, issues: all };
}
