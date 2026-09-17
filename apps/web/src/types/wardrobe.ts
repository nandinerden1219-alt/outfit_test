import type { WardrobeCategory } from "@outfit/shared";

/** Filter chips on /wardrobe: [All] [Tops] [Bottoms] [Dresses] [Outerwear] [Shoes] [Accessories]. */
export type WardrobeFilter = "all" | "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "accessories";

export const CATEGORY_GROUPS: Record<Exclude<WardrobeFilter, "all">, WardrobeCategory[]> = {
  tops: ["top"],
  bottoms: ["bottom"],
  dresses: ["dress"],
  outerwear: ["outerwear"],
  shoes: ["shoes"],
  accessories: ["bag", "accessory"],
};

export const WARDROBE_FILTERS: Array<{ value: WardrobeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessories", label: "Accessories" },
];
