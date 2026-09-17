/** Domain vocabulary + the deterministic derivations the AI never guesses. */

import type { OccasionType, OutfitSlot, SeasonType, WardrobeCategory } from "@outfit/shared";

export const CATEGORIES: readonly WardrobeCategory[] = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"];
export const SEASONS: readonly SeasonType[] = ["spring", "summer", "autumn", "winter"];
export const OCCASIONS: readonly OccasionType[] = ["work", "school", "casual", "date", "party", "exercise", "travel", "formal", "other"];
export const SLOTS: readonly OutfitSlot[] = ["top", "layer", "outerwear", "bottom", "dress", "shoes", "accessory"];

/** Subcategories the analyzer may return, grouped by category. Free text is accepted too. */
export const SUBCATEGORIES: Record<WardrobeCategory, readonly string[]> = {
  top: ["t-shirt", "shirt", "blouse", "sweater", "hoodie", "cardigan", "tank top", "polo"],
  bottom: ["jeans", "trousers", "shorts", "skirt", "leggings"],
  dress: ["dress"],
  outerwear: ["jacket", "coat", "blazer", "vest"],
  shoes: ["sneakers", "boots", "heels", "sandals", "loafers"],
  bag: ["bag"],
  accessory: ["hat", "scarf", "belt", "jewellery", "sunglasses"],
};
export const ALL_SUBCATEGORIES: readonly string[] = Object.values(SUBCATEGORIES).flat();

/** Tops worn over another top (mid layer). */
export const LAYER_SUBCATEGORIES = ["sweater", "hoodie", "cardigan"] as const;

export function slotForItem(category: WardrobeCategory, subcategory: string | null | undefined): OutfitSlot {
  const sub = (subcategory ?? "").trim().toLowerCase();
  switch (category) {
    case "top":
      return LAYER_SUBCATEGORIES.some((k) => sub.includes(k)) ? "layer" : "top";
    case "bottom":
      return "bottom";
    case "dress":
      return "dress";
    case "outerwear":
      return "outerwear";
    case "shoes":
      return "shoes";
    default:
      return "accessory";
  }
}

// Base warmth 1 (very light) .. 5 (deep winter) by subcategory keyword — first match wins.
const WARMTH_BY_KEYWORD: ReadonlyArray<readonly [string, number]> = [
  ["coat", 5], ["parka", 5], ["puffer", 5], ["boots", 4], ["sweater", 3], ["hoodie", 3], ["cardigan", 3],
  ["jacket", 3], ["blazer", 2], ["vest", 2], ["trousers", 2], ["jeans", 2], ["leggings", 2], ["shirt", 2],
  ["blouse", 2], ["polo", 2], ["loafers", 2], ["heels", 1], ["sneakers", 1], ["sandals", 1], ["shorts", 1],
  ["skirt", 2], ["dress", 2], ["tank", 1], ["t-shirt", 1], ["scarf", 4], ["hat", 2],
];
const WARM_MATERIALS = ["wool", "fleece", "down", "cashmere", "shearling", "leather"];
const LIGHT_MATERIALS = ["linen", "silk", "mesh", "chiffon"];

export const FORMALITY_LABELS: Record<string, number> = {
  loungewear: 1,
  sporty: 1,
  casual: 2,
  "smart casual": 3,
  "smart-casual": 3,
  smart_casual: 3,
  business: 4,
  formal: 5,
};
export const FORMALITY_LABEL_BY_SCORE: Record<number, string> = { 1: "casual", 2: "casual", 3: "smart casual", 4: "business", 5: "formal" };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function deriveWarmth(subcategory: string | null | undefined, material: string | null | undefined, season: SeasonType[]): number {
  const sub = (subcategory ?? "").toLowerCase();
  let base = 2;
  for (const [keyword, value] of WARMTH_BY_KEYWORD) {
    if (sub.includes(keyword)) {
      base = value;
      break;
    }
  }
  const mat = (material ?? "").toLowerCase();
  if (WARM_MATERIALS.some((m) => mat.includes(m))) base += 1;
  if (LIGHT_MATERIALS.some((m) => mat.includes(m))) base -= 1;
  const set = new Set(season);
  if (season.length && set.size === 1 && set.has("winter")) base += 1;
  if (season.length && set.size === 1 && set.has("summer")) base -= 1;
  return clamp(base, 1, 5);
}

export function deriveFormality(label: string | null | undefined, subcategory: string | null | undefined): number {
  if (label) {
    const key = label.trim().toLowerCase();
    if (key in FORMALITY_LABELS) return FORMALITY_LABELS[key] as number;
  }
  const sub = (subcategory ?? "").toLowerCase();
  if (["heels", "blazer", "blouse", "loafers"].some((k) => sub.includes(k))) return 4;
  if (["shirt", "trousers", "coat", "dress", "skirt", "cardigan"].some((k) => sub.includes(k))) return 3;
  if (["hoodie", "sneakers", "shorts", "leggings", "tank", "sandals"].some((k) => sub.includes(k))) return 1;
  return 2;
}

export function deriveOccasions(formality: number, style: string[]): OccasionType[] {
  const tags = new Set(style);
  const out = new Set<OccasionType>();
  if (tags.has("sporty")) ["exercise", "casual"].forEach((o) => out.add(o as OccasionType));
  if (formality <= 2) ["casual", "school", "travel"].forEach((o) => out.add(o as OccasionType));
  if (formality >= 2 && formality <= 4) ["date", "work"].forEach((o) => out.add(o as OccasionType));
  if (formality >= 3) out.add("party");
  if (formality >= 4) out.add("formal");
  return [...out].sort();
}

export function formalityLabel(score: number | null | undefined): string | null {
  return score ? (FORMALITY_LABEL_BY_SCORE[score] ?? null) : null;
}
