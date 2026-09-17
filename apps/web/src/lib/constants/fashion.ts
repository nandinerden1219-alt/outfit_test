import type { GenderType, OccasionType, OutfitSlot, PreferredFit, SeasonType, WardrobeCategory } from "@/types/database";

export type Option<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

export const GENDER_OPTIONS: Option<GenderType>[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const FIT_OPTIONS: Option<PreferredFit>[] = [
  { value: "fitted", label: "Fitted", description: "Close to the body" },
  { value: "regular", label: "Regular", description: "Classic, true to size" },
  { value: "relaxed", label: "Relaxed", description: "A little room to move" },
  { value: "oversized", label: "Oversized", description: "Loose and roomy" },
];

/** Style vocabulary shared with the AI prompts and the scoring engine. */
export const STYLE_OPTIONS: Option[] = [
  { value: "minimal", label: "Minimal" },
  { value: "casual", label: "Casual" },
  { value: "streetwear", label: "Streetwear" },
  { value: "classic", label: "Classic" },
  { value: "smart_casual", label: "Smart casual" },
  { value: "business", label: "Business" },
  { value: "sporty", label: "Sporty" },
  { value: "preppy", label: "Preppy" },
  { value: "bohemian", label: "Bohemian" },
  { value: "vintage", label: "Vintage" },
  { value: "edgy", label: "Edgy" },
  { value: "romantic", label: "Romantic" },
];

export type ColorOption = Option & { hex: string };

/** Canonical colour names; the AI is asked to map detected colours onto these. */
export const COLOR_OPTIONS: ColorOption[] = [
  { value: "black", label: "Black", hex: "#111111" },
  { value: "white", label: "White", hex: "#FFFFFF" },
  { value: "gray", label: "Gray", hex: "#8E8E8E" },
  { value: "beige", label: "Beige", hex: "#D9C7A7" },
  { value: "cream", label: "Cream", hex: "#F3EBD8" },
  { value: "brown", label: "Brown", hex: "#6B4A2B" },
  { value: "camel", label: "Camel", hex: "#C19A6B" },
  { value: "navy", label: "Navy", hex: "#1F2A44" },
  { value: "blue", label: "Blue", hex: "#3B6FD6" },
  { value: "light_blue", label: "Light blue", hex: "#A9C7EA" },
  { value: "green", label: "Green", hex: "#3E7C4A" },
  { value: "olive", label: "Olive", hex: "#6F7A3C" },
  { value: "yellow", label: "Yellow", hex: "#EFC94C" },
  { value: "orange", label: "Orange", hex: "#E7823A" },
  { value: "red", label: "Red", hex: "#C8332E" },
  { value: "burgundy", label: "Burgundy", hex: "#6E1E2B" },
  { value: "pink", label: "Pink", hex: "#E9A3B8" },
  { value: "purple", label: "Purple", hex: "#7B4FA3" },
];

export const OCCASION_OPTIONS: Option<OccasionType>[] = [
  { value: "work", label: "Work" },
  { value: "school", label: "School" },
  { value: "casual", label: "Casual" },
  { value: "date", label: "Date" },
  { value: "party", label: "Party" },
  { value: "exercise", label: "Exercise" },
  { value: "travel", label: "Travel" },
  { value: "formal", label: "Formal event" },
  { value: "other", label: "Other" },
];

export function colorHex(name: string): string {
  return COLOR_OPTIONS.find((c) => c.value === name)?.hex ?? "#CCCCCC";
}

export function optionLabel<T extends string>(options: Option<T>[], value: T | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export const CATEGORY_OPTIONS: Option<WardrobeCategory>[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "dress", label: "Dress" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "bag", label: "Bag" },
  { value: "accessory", label: "Accessory" },
];

/** Subcategories per category (mirrors backend SUBCATEGORIES). Free text is accepted too. */
export const SUBCATEGORY_OPTIONS: Record<WardrobeCategory, string[]> = {
  top: ["t-shirt", "shirt", "blouse", "sweater", "hoodie", "cardigan", "tank top", "polo"],
  bottom: ["jeans", "trousers", "shorts", "skirt", "leggings"],
  dress: ["dress"],
  outerwear: ["jacket", "coat", "blazer", "vest"],
  shoes: ["sneakers", "boots", "heels", "sandals", "loafers"],
  bag: ["bag"],
  accessory: ["hat", "scarf", "belt", "jewellery", "sunglasses"],
};

export const PATTERN_OPTIONS: Option[] = [
  { value: "solid", label: "Solid" },
  { value: "striped", label: "Striped" },
  { value: "checked", label: "Checked" },
  { value: "floral", label: "Floral" },
  { value: "graphic", label: "Graphic" },
  { value: "dotted", label: "Dotted" },
  { value: "other", label: "Other" },
];

export const WEATHER_OPTIONS: Option<"sunny" | "cloudy" | "rainy" | "snowy" | "windy">[] = [
  { value: "sunny", label: "Sunny" },
  { value: "cloudy", label: "Cloudy" },
  { value: "rainy", label: "Rainy" },
  { value: "snowy", label: "Snowy" },
  { value: "windy", label: "Windy" },
];

export const SEASON_OPTIONS: Option<SeasonType>[] = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "autumn", label: "Autumn" },
  { value: "winter", label: "Winter" },
];

export const ITEM_FIT_OPTIONS: Option[] = FIT_OPTIONS.map(({ value, label }) => ({ value, label }));

export const SLOT_LABELS: Record<OutfitSlot, string> = {
  outerwear: "Outerwear",
  layer: "Layer",
  top: "Top",
  dress: "Dress",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

export const SLOT_ORDER: OutfitSlot[] = ["outerwear", "layer", "top", "dress", "bottom", "shoes", "accessory"];

/** Slots the try-on swap UI offers (top and layer are both "tops" to the user). */
export const SWAP_SLOTS: OutfitSlot[] = ["top", "layer", "bottom", "dress", "outerwear", "shoes"];

/** Try-on paints these slots; shoes/accessories are shown in the summary but not dressed. */
export const TRYON_SLOTS: ReadonlySet<OutfitSlot> = new Set<OutfitSlot>(["top", "layer", "bottom", "dress", "outerwear"]);

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}
