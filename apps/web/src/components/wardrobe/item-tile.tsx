/* eslint-disable @next/next/no-img-element -- signed Supabase URLs are short-lived; next/image would need remotePatterns per project */
import { HeartIcon, ShirtIcon } from "lucide-react";

import { colorHex, humanize } from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";
import type { ApiWardrobeItem } from "@/types/api-models";

type ItemTileProps = {
  item: Pick<ApiWardrobeItem, "label" | "category" | "dominant_color" | "image_url" | "favorite" | "background_removed">;
  className?: string;
  /** Aspect ratio class for the image box. */
  ratio?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const LIGHT = new Set(["white", "cream", "beige", "yellow", "light_blue", "pink", "gray"]);

/**
 * A wardrobe item as a picture. Cut-outs (transparent PNG) sit on a soft
 * neutral ground; falls back to a colour swatch when there is no image.
 */
export function ItemTile({ item, className, ratio = "aspect-[3/4]", showLabel = true, size = "md" }: ItemTileProps) {
  const color = item.dominant_color ? colorHex(item.dominant_color) : "#E5E1DA";
  const light = item.dominant_color ? LIGHT.has(item.dominant_color) : true;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn("relative flex items-center justify-center overflow-hidden rounded-xl border bg-secondary", ratio)}
        style={item.image_url ? undefined : { backgroundColor: color }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.label}
            className={cn("size-full", item.background_removed ? "object-contain p-2" : "object-cover")}
            loading="lazy"
          />
        ) : (
          <ShirtIcon className={cn(size === "sm" ? "size-5" : "size-8", light ? "text-black/20" : "text-white/40")} />
        )}
        {item.favorite && (
          <HeartIcon className="absolute right-2 top-2 size-4 fill-brand text-brand drop-shadow" aria-label="Favourite" />
        )}
      </div>
      {showLabel && (
        <>
          <p className={cn("mt-2 truncate font-medium capitalize", size === "sm" ? "text-xs" : "text-sm")}>{item.label}</p>
          <p className="truncate text-xs text-muted-foreground capitalize">
            {item.dominant_color ? `${humanize(item.dominant_color)} · ` : ""}
            {humanize(item.category)}
          </p>
        </>
      )}
    </div>
  );
}
