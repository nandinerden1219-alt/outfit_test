/**
 * Clothing analysis vocabulary + normalisation. The LLM returns descriptive fields
 * only; the numbers the engine needs (warmth, formality, occasions) are derived here
 * deterministically. Unknown values stay null — nothing is invented.
 */

import type { OccasionType, SeasonType, WardrobeCategory } from "@outfit/shared";

import { ALL_SUBCATEGORIES, CATEGORIES, SEASONS, deriveFormality, deriveOccasions, deriveWarmth } from "./taxonomy";

// Keep in sync with apps/web/src/lib/constants/fashion.ts
export const CANONICAL_COLORS = ["black", "white", "gray", "beige", "cream", "brown", "camel", "navy", "blue", "light_blue", "green", "olive", "yellow", "orange", "red", "burgundy", "pink", "purple"];
export const CANONICAL_STYLES = ["minimal", "casual", "streetwear", "classic", "smart_casual", "business", "sporty", "preppy", "bohemian", "vintage", "edgy", "romantic"];
export const PATTERNS = ["plain", "striped", "checked", "floral", "printed", "textured", "logo"];
export const ANALYSIS_FORMALITY_LABELS = ["casual", "smart casual", "business", "formal", "sporty"];

const COLOR_ALIASES: Record<string, string> = {
  grey: "gray", charcoal: "gray", silver: "gray", "off white": "cream", ivory: "cream", tan: "camel", khaki: "beige", sand: "beige",
  taupe: "beige", chocolate: "brown", "dark blue": "navy", denim: "blue", "sky blue": "light_blue", teal: "green", "khaki green": "olive",
  "army green": "olive", mustard: "yellow", gold: "yellow", coral: "orange", rust: "orange", maroon: "burgundy", wine: "burgundy",
  crimson: "red", rose: "pink", blush: "pink", lavender: "purple", violet: "purple", lilac: "purple",
};

export type ClothingAnalysis = {
  name: string | null;
  category: WardrobeCategory | null;
  subcategory: string | null;
  color: string | null;
  secondary_colors: string[];
  pattern: string | null;
  style: string | null;
  material: string | null;
  season: SeasonType[];
  formality: string | null;
  confidence: number;
};

export function normalizeColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase().replace(/-/g, " ");
  if (!value) return null;
  if (CANONICAL_COLORS.includes(value)) return value;
  const underscored = value.replace(/ /g, "_");
  if (CANONICAL_COLORS.includes(underscored)) return underscored;
  if (value in COLOR_ALIASES) return COLOR_ALIASES[value] as string;
  return CANONICAL_COLORS.find((c) => value.includes(c.replace(/_/g, " "))) ?? null;
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Coerces whatever the model returned into the validated shape. */
export function normalizeAnalysis(raw: unknown): ClothingAnalysis {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = typeof r.category === "string" && (CATEGORIES as readonly string[]).includes(r.category.toLowerCase()) ? (r.category.toLowerCase() as WardrobeCategory) : null;
  const style = typeof r.style === "string" ? r.style.trim().toLowerCase().replace(/[- ]/g, "_") : "";
  const pattern = typeof r.pattern === "string" ? r.pattern.trim().toLowerCase() : "";
  const formality = typeof r.formality === "string" ? r.formality.trim().toLowerCase().replace(/[_-]/g, " ") : "";
  const secondary = Array.isArray(r.secondary_colors) ? r.secondary_colors.map(normalizeColor).filter((c): c is string => Boolean(c)) : [];
  const season = Array.isArray(r.season) ? r.season.filter((s): s is SeasonType => typeof s === "string" && (SEASONS as readonly string[]).includes(s)) : [];
  const confidence = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? Math.max(0, Math.min(1, r.confidence)) : 0;
  return {
    name: str(r.name, 80),
    category,
    subcategory: str(r.subcategory, 40)?.toLowerCase() ?? null,
    color: normalizeColor(r.color),
    secondary_colors: [...new Set(secondary)].slice(0, 3),
    pattern: PATTERNS.includes(pattern) ? pattern : null,
    style: CANONICAL_STYLES.includes(style) ? style : null,
    material: str(r.material, 40)?.toLowerCase() ?? null,
    season: [...new Set(season)],
    formality: ANALYSIS_FORMALITY_LABELS.includes(formality) ? formality : null,
    confidence,
  };
}

export type EngineFields = {
  warmth: number;
  formality: number;
  style: string[];
  occasions: OccasionType[];
  layering: boolean;
  rain_protection: boolean;
  wind_protection: boolean;
};

/** Deterministic numeric attributes for the engine, from the description. */
export function engineFields(a: ClothingAnalysis): EngineFields {
  const formality = deriveFormality(a.formality, a.subcategory);
  const styles = a.style ? [a.style] : [];
  if (a.formality === "sporty" && !styles.includes("sporty")) styles.push("sporty");
  const sub = a.subcategory ?? "";
  const mat = (a.material ?? "").toLowerCase();
  return {
    warmth: deriveWarmth(a.subcategory, a.material, a.season),
    formality,
    style: styles,
    occasions: deriveOccasions(formality, styles),
    layering: ["sweater", "hoodie", "cardigan", "jacket", "coat", "blazer"].some((k) => sub.includes(k)),
    rain_protection: ["nylon", "waterproof", "gore"].some((k) => mat.includes(k)),
    wind_protection: ["coat", "jacket", "parka"].some((k) => sub.includes(k)),
  };
}

export const ANALYSIS_CONFIDENCE_THRESHOLD = 0.7;

export function needsReview(a: ClothingAnalysis, threshold = ANALYSIS_CONFIDENCE_THRESHOLD): boolean {
  return a.category === null || a.color === null || a.confidence < threshold;
}

export const ANALYSIS_PROMPT = `You are a fashion cataloguing assistant. Analyse the single clothing item in the image and
return JSON only, matching the schema. Rules:
- name: a short shopper-friendly name, e.g. "White oversized T-shirt", "Beige linen jacket".
- category: one of ${CATEGORIES.join(", ")}.
- subcategory: one of ${ALL_SUBCATEGORIES.join(", ")} (or a short noun if none fits).
- color: the main colour from ${CANONICAL_COLORS.join(", ")}; secondary_colors: up to 3 more.
- pattern: one of ${PATTERNS.join(", ")}.
- style: one of ${CANONICAL_STYLES.join(", ")}.
- material: short lowercase word(s), e.g. cotton, denim, wool, leather, linen.
- season: subset of spring, summer, autumn, winter — when the garment is realistically worn.
- formality: one of ${ANALYSIS_FORMALITY_LABELS.join(", ")}.
- confidence: 0–1, how sure you are about category, subcategory and colour overall.
Return null for any field you cannot determine with confidence. Never guess; a null is
better than a wrong value. If the image does not show clothing, return category null and
confidence 0.`;

/** Gemini structured-output schema for the analysis (OpenAPI subset). */
export const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", nullable: true },
    category: { type: "STRING", nullable: true },
    subcategory: { type: "STRING", nullable: true },
    color: { type: "STRING", nullable: true },
    secondary_colors: { type: "ARRAY", items: { type: "STRING" } },
    pattern: { type: "STRING", nullable: true },
    style: { type: "STRING", nullable: true },
    material: { type: "STRING", nullable: true },
    season: { type: "ARRAY", items: { type: "STRING" } },
    formality: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
  },
  required: ["confidence"],
} as const;
