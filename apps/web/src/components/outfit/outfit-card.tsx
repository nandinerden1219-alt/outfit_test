"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */

import { HeartIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOutfitSavedAction } from "@/app/(app)/actions";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { ItemTile } from "@/components/wardrobe/item-tile";
import { humanize, OCCASION_OPTIONS, optionLabel, SLOT_LABELS } from "@/lib/constants/fashion";
import { outfitTitle, tryOnHref } from "@/lib/outfit-helpers";
import { cn } from "@/lib/utils";
import type { ApiOutfit, ApiTryOnJob } from "@/types/api-models";

export function OutfitItems({ outfit, size = "md" }: { outfit: ApiOutfit; size?: "sm" | "md" }) {
  return (
    <ul className={cn("grid gap-3", size === "sm" ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5")}>
      {outfit.items.map(({ slot, item }) => (
        <li key={item.id} className="min-w-0">
          <ItemTile item={item} size={size} showLabel={false} />
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{SLOT_LABELS[slot]}</p>
          <p className={cn("truncate font-medium capitalize", size === "sm" ? "text-xs" : "text-sm")}>{item.label}</p>
        </li>
      ))}
    </ul>
  );
}

type OutfitCardProps = {
  outfit: ApiOutfit;
  /** A completed try-on for this outfit: shown instead of the collage. */
  tryOn?: ApiTryOnJob | null;
  /** Called after the saved flag changes (optimistic UIs, lists). */
  onSavedChange?: (outfit: ApiOutfit) => void;
};

/**
 * A pin: the collage is the whole card, tapping it opens the look on your photo.
 * Name + conditions underneath, heart on hover. No scores shown.
 */
export function OutfitCard({ outfit, tryOn, onSavedChange }: OutfitCardProps) {
  const result = tryOn?.status === "completed" ? tryOn.result_image_url : null;
  const [saving, startSaving] = useTransition();
  const [why, setWhy] = useState(false);

  const toggleSaved = () => {
    startSaving(async () => {
      const result = await setOutfitSavedAction(outfit.id, !outfit.saved);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Could not save." : result.error);
        return;
      }
      onSavedChange?.(result.data);
      toast.success(result.data.saved ? "Saved." : "Removed from saved.");
    });
  };

  const conditions = [
    optionLabel(OCCASION_OPTIONS, outfit.occasion),
    outfit.temperature_c !== null ? `${Math.round(outfit.temperature_c)}°` : null,
    outfit.weather ? humanize(outfit.weather) : null,
  ].filter(Boolean);

  return (
    <article className="group mb-4 break-inside-avoid">
      <div className="relative">
        <Link href={tryOnHref(outfit)} aria-label={`See ${outfitTitle(outfit)} on me`} className="block transition-transform duration-200 group-hover:-translate-y-0.5">
          {result ? (
            <div className="studio relative aspect-[3/4] overflow-hidden rounded-2xl">
              <img src={result} alt={`${outfitTitle(outfit)} on you`} className="size-full object-cover" loading="lazy" />
              <div className="absolute bottom-2 left-2 w-16 overflow-hidden rounded-lg border-2 border-card shadow">
                <OutfitCollage items={outfit.items} className="aspect-[4/5] rounded-none p-1" />
              </div>
            </div>
          ) : (
            <OutfitCollage items={outfit.items} />
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSaved}
          disabled={saving}
          aria-pressed={outfit.saved}
          aria-label={outfit.saved ? "Remove from saved" : "Save"}
          className={cn(
            "absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-opacity",
            outfit.saved ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <HeartIcon className={cn("size-4", outfit.saved && "fill-brand text-brand")} />}
        </button>
        <Link
          href={tryOnHref(outfit)}
          className="absolute bottom-3 left-3 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          See it on me
        </Link>
      </div>
      <div className="px-1 pt-2">
        <h3 className="truncate text-sm font-semibold capitalize">{outfitTitle(outfit)}</h3>
        <p className="truncate text-xs text-muted-foreground capitalize">
          {outfit.items.map((i) => i.item.label).join(" · ")}
        </p>
        {conditions.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{conditions.join(" · ")}</p>}
        {outfit.reasons.length > 0 && (
          <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="mt-1 text-xs font-medium underline-offset-4 hover:underline">
            {why ? "Hide" : "Why this outfit?"}
          </button>
        )}
        {why && (
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
            {outfit.reasons.map((r) => (
              <li key={r}>✓ {r}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
