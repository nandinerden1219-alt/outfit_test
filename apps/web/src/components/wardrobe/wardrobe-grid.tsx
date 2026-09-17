"use client";

import { HeartIcon, PencilIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateWardrobeItemAction } from "@/app/(app)/actions";
import { ItemTile } from "@/components/wardrobe/item-tile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { humanize, optionLabel, SEASON_OPTIONS } from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";
import type { ApiWardrobeItem } from "@/types/api-models";
import { CATEGORY_GROUPS, WARDROBE_FILTERS, type WardrobeFilter } from "@/types/wardrobe";

export function matchesFilter(item: ApiWardrobeItem, filter: WardrobeFilter): boolean {
  return filter === "all" || CATEGORY_GROUPS[filter].includes(item.category);
}

/** Small read-only detail view; editing lives on /wardrobe/[id]. */
function ItemDetail({ item }: { item: ApiWardrobeItem }) {
  const facts: Array<[string, string | null]> = [
    ["Type", item.subcategory ? humanize(item.subcategory) : null],
    ["Colour", item.dominant_color ? humanize(item.dominant_color) : null],
    ["Other colours", item.secondary_colors.length ? item.secondary_colors.map(humanize).join(", ") : null],
    ["Pattern", item.pattern ? humanize(item.pattern) : null],
    ["Material", item.material],
    ["Style", item.style.length ? item.style.map(humanize).join(", ") : null],
    ["Season", item.season.length ? item.season.map((s) => optionLabel(SEASON_OPTIONS, s)).join(", ") : null],
    ["Formality", item.formality_label ? humanize(item.formality_label) : null],
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
      <ItemTile item={item} showLabel={false} />
      <div className="min-w-0">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={cn("capitalize", !v && "text-muted-foreground/60")}>{v ?? "Not set"}</dd>
            </div>
          ))}
        </dl>
        {item.needs_review && (
          <p className="mt-4 rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand">
            Some details could not be detected. Check them so outfits use this piece correctly.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/try-on?items=${item.id}`}>
              <SparklesIcon data-icon="inline-start" />
              Try it on
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/wardrobe/${item.id}`}>
              <PencilIcon data-icon="inline-start" />
              Edit details
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WardrobeGrid({ items }: { items: ApiWardrobeItem[] }) {
  const [filter, setFilter] = useState<WardrobeFilter>("all");
  const [open, setOpen] = useState<ApiWardrobeItem | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(items, (state, patch: { id: string; favorite: boolean }) =>
    state.map((i) => (i.id === patch.id ? { ...i, favorite: patch.favorite } : i)),
  );
  const [, startTransition] = useTransition();

  const visible = optimistic.filter((i) => matchesFilter(i, filter));
  const counts = Object.fromEntries(
    WARDROBE_FILTERS.map((f) => [f.value, optimistic.filter((i) => matchesFilter(i, f.value)).length]),
  ) as Record<WardrobeFilter, number>;

  const toggleFavorite = (item: ApiWardrobeItem) => {
    startTransition(async () => {
      setOptimistic({ id: item.id, favorite: !item.favorite });
      const result = await updateWardrobeItemAction(item.id, { favorite: !item.favorite });
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by category">
        {WARDROBE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            onClick={() => setFilter(f.value)}
            aria-selected={filter === f.value}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              filter === f.value ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/40",
            )}
          >
            {f.label} <span className="opacity-60">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">Nothing in this category yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <li key={item.id} className="group relative rounded-2xl border bg-card p-2 transition-colors hover:border-foreground/30">
              <button type="button" onClick={() => setOpen(item)} className="block w-full text-left">
                <ItemTile item={{ ...item, favorite: false }} />
              </button>
              <button
                type="button"
                aria-label={item.favorite ? "Remove from favourites" : "Add to favourites"}
                aria-pressed={item.favorite}
                onClick={() => toggleFavorite(item)}
                className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-transform hover:scale-105"
              >
                <HeartIcon className={cn("size-4", item.favorite ? "fill-brand text-brand" : "text-muted-foreground")} />
              </button>
              {!item.available && (
                <span className="absolute left-4 top-4 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-medium text-background">Unavailable</span>
              )}
              {item.needs_review && (
                <span className="absolute bottom-14 left-4 rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground">Check details</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">{open.label}</DialogTitle>
                <DialogDescription className="capitalize">{humanize(open.category)}</DialogDescription>
              </DialogHeader>
              <ItemDetail item={open} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
