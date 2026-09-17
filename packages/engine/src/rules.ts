/** Every threshold the engine uses. Tune here, never inline. */

import type { OccasionType, OutfitSlot } from "@outfit/shared";

// ---------------------------------------------------------------- scoring

export const WEIGHTS = { weather: 0.35, occasion: 0.25, style: 0.15, color: 0.1, fit: 0.1, user_preference: 0.05 } as const;

export const NEUTRAL_COLORS = new Set(["black", "white", "gray", "beige", "cream", "brown", "camel", "navy"]);
export const COLOR_FAMILIES: Record<string, string> = {
  red: "warm",
  burgundy: "warm",
  orange: "warm",
  yellow: "warm",
  pink: "warm",
  green: "cool",
  olive: "cool",
  blue: "cool",
  light_blue: "cool",
  purple: "cool",
};
export const MAX_ACCENT_COLORS = 2;
export const COLOR_SCORES = { all_neutral: 85, one_accent: 100, same_family: 80, mixed_family: 55, too_many_accents: 35 } as const;
export const FAVORITE_COLOR_BONUS = 6;
export const AVOID_COLOR_PENALTY = 25;
export const PER_SLOT_LIMIT = 6;
export const RANKER_CANDIDATES = 8;
export const PREFERENCE_SCALE = 40;

// ---------------------------------------------------------------- occasions

export type OccasionRule = {
  label: string;
  formalityMin: number;
  formalityMax: number;
  preferredStyles: ReadonlySet<string>;
  /** Subcategory keywords never recommended for this occasion. */
  bannedKeywords: ReadonlySet<string>;
  /** Style tag that must appear on garments (e.g. sporty for exercise). */
  requiredStyle: string | null;
  shoesFormalityMin: number;
  preferNeutralColors: boolean;
};

const rule = (r: Partial<OccasionRule> & Pick<OccasionRule, "label" | "formalityMin" | "formalityMax">): OccasionRule => ({
  preferredStyles: new Set(),
  bannedKeywords: new Set(),
  requiredStyle: null,
  shoesFormalityMin: 1,
  preferNeutralColors: false,
  ...r,
});

export const OCCASION_RULES: Record<OccasionType, OccasionRule> = {
  work: rule({
    label: "Work",
    formalityMin: 3,
    formalityMax: 5,
    preferredStyles: new Set(["business", "smart_casual", "classic", "minimal"]),
    bannedKeywords: new Set(["shorts", "hoodie", "tank"]),
    shoesFormalityMin: 2,
    preferNeutralColors: true,
  }),
  school: rule({ label: "School", formalityMin: 1, formalityMax: 3, preferredStyles: new Set(["casual", "streetwear", "minimal", "preppy"]) }),
  casual: rule({ label: "Casual", formalityMin: 1, formalityMax: 3, preferredStyles: new Set(["casual", "minimal", "streetwear", "bohemian", "vintage"]) }),
  date: rule({
    label: "Date",
    formalityMin: 2,
    formalityMax: 4,
    preferredStyles: new Set(["smart_casual", "romantic", "minimal", "classic", "edgy"]),
    bannedKeywords: new Set(["hoodie"]),
    shoesFormalityMin: 2,
  }),
  party: rule({
    label: "Party",
    formalityMin: 3,
    formalityMax: 5,
    preferredStyles: new Set(["edgy", "romantic", "streetwear", "vintage"]),
    bannedKeywords: new Set(["hoodie"]),
    shoesFormalityMin: 2,
  }),
  exercise: rule({
    label: "Exercise",
    formalityMin: 1,
    formalityMax: 2,
    preferredStyles: new Set(["sporty"]),
    bannedKeywords: new Set(["jeans", "coat", "shirt", "blouse", "dress", "skirt", "sweater", "heels", "loafers", "blazer"]),
    requiredStyle: "sporty",
  }),
  travel: rule({ label: "Travel", formalityMin: 1, formalityMax: 3, preferredStyles: new Set(["casual", "minimal", "sporty", "streetwear"]) }),
  formal: rule({
    label: "Formal event",
    formalityMin: 4,
    formalityMax: 5,
    preferredStyles: new Set(["classic", "business", "romantic"]),
    bannedKeywords: new Set(["t-shirt", "hoodie", "shorts", "jeans", "sneakers", "sandals", "leggings", "tank"]),
    shoesFormalityMin: 4,
    preferNeutralColors: true,
  }),
  other: rule({ label: "Other", formalityMin: 1, formalityMax: 5 }),
};

export const ruleFor = (occasion: OccasionType): OccasionRule => OCCASION_RULES[occasion];

// ---------------------------------------------------------------- weather

export type TemperatureBand = {
  name: string;
  label: string;
  minFeelsLike: number;
  maxFeelsLike: number;
  targetWarmth: Partial<Record<OutfitSlot, number>>;
  outerwear: "required" | "optional" | "none";
  layer: "required" | "optional" | "none";
  maxWarmthDeviation: number;
  allowBareLegs: boolean;
  advice: string;
};

export const BANDS: readonly TemperatureBand[] = [
  {
    name: "extreme_cold",
    label: "Extreme cold",
    minFeelsLike: -Infinity,
    maxFeelsLike: -15,
    targetWarmth: { top: 3, layer: 4, outerwear: 5, bottom: 4, dress: 4, shoes: 5 },
    outerwear: "required",
    layer: "required",
    maxWarmthDeviation: 1.5,
    allowBareLegs: false,
    advice: "Heavy coat plus warm layers.",
  },
  {
    name: "very_cold",
    label: "Very cold",
    minFeelsLike: -15,
    maxFeelsLike: -5,
    targetWarmth: { top: 3, layer: 4, outerwear: 4.5, bottom: 3.5, dress: 4, shoes: 4 },
    outerwear: "required",
    layer: "required",
    maxWarmthDeviation: 2,
    allowBareLegs: false,
    advice: "Winter outerwear plus warm layers.",
  },
  {
    name: "cold",
    label: "Cold",
    minFeelsLike: -5,
    maxFeelsLike: 5,
    targetWarmth: { top: 2.5, layer: 3, outerwear: 4, bottom: 3, dress: 3, shoes: 3.5 },
    outerwear: "required",
    layer: "optional",
    maxWarmthDeviation: 2,
    allowBareLegs: false,
    advice: "Jacket or coat with a layer underneath.",
  },
  {
    name: "cool",
    label: "Cool",
    minFeelsLike: 5,
    maxFeelsLike: 15,
    targetWarmth: { top: 2, layer: 3, outerwear: 3, bottom: 2.5, dress: 2.5, shoes: 2.5 },
    outerwear: "optional",
    layer: "optional",
    maxWarmthDeviation: 2,
    allowBareLegs: true,
    advice: "Light jacket or a sweater.",
  },
  {
    name: "mild",
    label: "Mild",
    minFeelsLike: 15,
    maxFeelsLike: 22,
    targetWarmth: { top: 1.5, layer: 2, outerwear: 2, bottom: 2, dress: 2, shoes: 2 },
    outerwear: "optional",
    layer: "optional",
    maxWarmthDeviation: 1.5,
    allowBareLegs: true,
    advice: "Long sleeves or light clothing.",
  },
  {
    name: "warm",
    label: "Warm",
    minFeelsLike: 22,
    maxFeelsLike: Infinity,
    targetWarmth: { top: 1, layer: 1, outerwear: 1, bottom: 1, dress: 1, shoes: 1 },
    outerwear: "none",
    layer: "none",
    maxWarmthDeviation: 1.5,
    allowBareLegs: true,
    advice: "Lightweight, breathable clothing.",
  },
];

export function bandFor(feelsLike: number): TemperatureBand {
  return BANDS.find((b) => b.minFeelsLike <= feelsLike && feelsLike < b.maxFeelsLike) ?? (BANDS[BANDS.length - 1] as TemperatureBand);
}

export const STRONG_WIND_KMH = 30;
export const RAIN_PROBABILITY_THRESHOLD = 50;
export const RAIN_AMOUNT_MM_THRESHOLD = 1;
export const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
export const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
export const LAYERING_SWING_C = 8;
export const MORNING_HOUR = 8;
export const AFTERNOON_HOUR = 14;
export const EVENING_HOUR = 19;
export const OPEN_SHOE_KEYWORDS = ["sandal", "flip", "slide", "open", "mule", "espadrille"];
export const BARE_LEG_KEYWORDS = ["shorts", "skirt"];
export const WEATHER_CACHE_TTL_MINUTES = 60;
