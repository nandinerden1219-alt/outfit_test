import type { ApiOutfit, ApiWardrobeItem } from "@/types/api-models";
import type { OutfitSlot } from "@/types/database";

/** One wardrobe item id per slot — what the try-on rail shows. Plain module: usable on server and client. */
export type Selection = Partial<Record<OutfitSlot, string | null>>;

/** Display order of the rail rows. */
export const ROW_ORDER: OutfitSlot[] = ["outerwear", "layer", "top", "dress", "bottom", "shoes", "accessory"];

export function selectionFromOutfit(outfit: ApiOutfit): Selection {
  const sel: Selection = {};
  for (const { slot, item } of outfit.items) sel[slot] = item.id;
  return sel;
}

export function selectionFromItems(items: ApiWardrobeItem[]): Selection {
  const sel: Selection = {};
  for (const item of items) if (!sel[item.slot]) sel[item.slot] = item.id;
  return sel;
}

export function selectedIds(sel: Selection): string[] {
  return ROW_ORDER.map((s) => sel[s]).filter((id): id is string => Boolean(id));
}

/** Swaps go slot by slot: ◀ / ▶ move to the previous / next piece of the same kind, wrapping around. */
export function cycle(itemsInSlot: ApiWardrobeItem[], currentId: string | null, direction: 1 | -1): string | null {
  if (itemsInSlot.length === 0) return null;
  const index = itemsInSlot.findIndex((i) => i.id === currentId);
  if (index === -1) return itemsInSlot[direction === 1 ? 0 : itemsInSlot.length - 1].id;
  return itemsInSlot[(index + direction + itemsInSlot.length) % itemsInSlot.length].id;
}
