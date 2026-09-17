"use client";

import { useState } from "react";

import { OutfitCard } from "@/components/outfit/outfit-card";
import type { ApiOutfit, ApiTryOnJob } from "@/types/api-models";

/** Saved outfits; un-hearting removes the card immediately. */
export function SavedOutfitList({ outfits: initial, tryOns = {} }: { outfits: ApiOutfit[]; tryOns?: Record<string, ApiTryOnJob | null> }) {
  const [outfits, setOutfits] = useState(initial);
  const onSavedChange = (updated: ApiOutfit) =>
    setOutfits((current) => (updated.saved ? current.map((o) => (o.id === updated.id ? updated : o)) : current.filter((o) => o.id !== updated.id)));

  if (outfits.length === 0) {
    return <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">Nothing saved right now.</p>;
  }
  return (
    <div className="masonry">
      {outfits.map((o) => (
        <OutfitCard key={o.id} outfit={o} tryOn={tryOns[o.id]} onSavedChange={onSavedChange} />
      ))}
    </div>
  );
}
