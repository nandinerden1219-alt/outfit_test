/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import { ShirtIcon } from "lucide-react";

import { colorHex } from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";
import type { ApiOutfitItem, ApiWardrobeItem } from "@/types/api-models";
import type { OutfitSlot } from "@/types/database";

/** Hero first, then the rest — the same order a stylist lays pieces out. */
const COLLAGE_ORDER: OutfitSlot[] = ["dress", "outerwear", "top", "layer", "bottom", "shoes", "accessory"];

function Piece({ item, className }: { item: ApiWardrobeItem; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden", className)}>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.label}
          className={cn("size-full", item.background_removed ? "object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]" : "rounded-xl object-cover")}
          loading="lazy"
        />
      ) : (
        <div
          className="flex size-[78%] items-center justify-center rounded-2xl"
          style={{ backgroundColor: item.dominant_color ? colorHex(item.dominant_color) : "#e5e1da" }}
          title={item.label}
        >
          <ShirtIcon className="size-6 text-black/20" />
        </div>
      )}
    </div>
  );
}

type OutfitCollageProps = {
  items: ApiOutfitItem[];
  className?: string;
};

/**
 * Pinterest-style flat lay: the main piece takes the left two-thirds, the
 * others stack on the right, on a soft studio ground. Pure layout, 2D only.
 */
export function OutfitCollage({ items, className }: OutfitCollageProps) {
  const ordered = [...items].sort((a, b) => COLLAGE_ORDER.indexOf(a.slot) - COLLAGE_ORDER.indexOf(b.slot));
  const [hero, ...rest] = ordered;

  if (!hero) {
    return (
      <div className={cn("studio flex aspect-[4/5] items-center justify-center rounded-2xl text-sm text-muted-foreground", className)}>
        No pieces yet
      </div>
    );
  }

  const side = rest.slice(0, 3);
  const extra = rest.length - side.length;

  return (
    <div className={cn("studio relative aspect-[4/5] overflow-hidden rounded-2xl p-3", className)} data-collage>
      <div className="grid size-full grid-cols-3 grid-rows-3 gap-2">
        <Piece item={hero.item} className={cn("row-span-3", side.length === 0 ? "col-span-3" : "col-span-2")} />
        {side.map(({ item }) => (
          <Piece key={item.id} item={item} className="col-span-1 row-span-1" />
        ))}
      </div>
      {extra > 0 && (
        <span className="absolute bottom-3 right-3 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium shadow-sm">+{extra}</span>
      )}
    </div>
  );
}
