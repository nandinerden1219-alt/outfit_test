import type { ApiOutfit, ApiWardrobeItem } from "@/types/api-models";

/** Plain helpers shared by server and client components. */

/** Link into try-on for this exact outfit. */
export function tryOnHref(outfit: ApiOutfit): string {
  return `/try-on?outfit=${encodeURIComponent(outfit.id)}`;
}

export function outfitTitle(outfit: ApiOutfit): string {
  return outfit.name ?? outfit.items.filter((i) => i.slot !== "accessory").map((i) => i.item.label).join(" · ");
}

const HERO_ORDER = ["outerwear", "dress", "top", "layer", "bottom", "shoes", "accessory"];

/** The card image: the first dressed piece (outerwear → dress → top …). */
export function heroItem(outfit: ApiOutfit): ApiWardrobeItem | null {
  return [...outfit.items].sort((a, b) => HERO_ORDER.indexOf(a.slot) - HERO_ORDER.indexOf(b.slot))[0]?.item ?? null;
}
