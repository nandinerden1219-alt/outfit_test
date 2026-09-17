"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */

import { CameraIcon, ChevronUpIcon, InfoIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useEffect } from "react";

import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { ItemTile } from "@/components/wardrobe/item-tile";
import { Progress } from "@/components/ui/progress";
import { humanize, OCCASION_OPTIONS, optionLabel, SLOT_LABELS } from "@/lib/constants/fashion";
import { useTryOnJob } from "@/lib/hooks/use-tryon-job";
import { outfitTitle } from "@/lib/outfit-helpers";
import { cn } from "@/lib/utils";
import type { ApiOutfit, ApiTryOnJob } from "@/types/api-models";

/** Card "photos", Tinder style: tap the right half for the next one, left for the previous. */
export type CardView = "look" | "on-you" | "pieces";
export const CARD_VIEWS: CardView[] = ["look", "on-you", "pieces"];

export type DeckCardProps = {
  outfit: ApiOutfit;
  /** Existing try-on for this outfit (cached or just started). */
  job: ApiTryOnJob | null;
  onJobChange: (outfitId: string, job: ApiTryOnJob | null) => void;
  view: CardView;
  expanded: boolean;
  onToggleExpanded?: () => void;
  /** Drag offset in px while the user is swiping (top card only). */
  dx?: number;
  dy?: number;
  hasPhoto: boolean;
  className?: string;
};

/**
 * One look in the deck: full-bleed image, gradient caption, LIKE / NOPE / SEE ON ME
 * stamps that fade in with the drag, and an info sheet with the pieces and reasons.
 */
export function DeckCard({ outfit, job: initialJob, onJobChange, view, expanded, onToggleExpanded, dx = 0, dy = 0, hasPhoto, className }: DeckCardProps) {
  const { job, isActive } = useTryOnJob(initialJob);

  useEffect(() => {
    if (job !== initialJob) onJobChange(outfit.id, job);
  }, [job, initialJob, onJobChange, outfit.id]);

  const result = job?.status === "completed" ? job.result_image_url : null;
  const like = Math.max(0, Math.min(1, dx / 110));
  const nope = Math.max(0, Math.min(1, -dx / 110));
  const up = Math.max(0, Math.min(1, -dy / 110)) * (1 - Math.max(like, nope));
  const viewIndex = CARD_VIEWS.indexOf(view);
  const conditions = [
    optionLabel(OCCASION_OPTIONS, outfit.occasion),
    outfit.temperature_c !== null ? `${Math.round(outfit.temperature_c)}°` : null,
    outfit.weather ? humanize(outfit.weather) : null,
  ].filter(Boolean) as string[];

  return (
    <article
      className={cn("relative h-full w-full select-none overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/5", className)}
      data-deck-card={outfit.id}
      data-view={view}
    >
      {/* ---------------------------------------------------------- media */}
      <div className="studio absolute inset-0">
        {view === "look" && <OutfitCollage items={outfit.items} className="aspect-auto size-full rounded-none p-5" />}
        {view === "on-you" &&
          (result ? (
            <img src={result} alt={`${outfitTitle(outfit)} on you`} className="size-full object-cover" draggable={false} />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-card shadow-sm">
                {isActive ? <Loader2Icon className="size-6 animate-spin" /> : hasPhoto ? <SparklesIcon className="size-6" /> : <CameraIcon className="size-6" />}
              </span>
              <p className="text-base font-semibold">{isActive ? (job?.step ?? "Working…") : hasPhoto ? "See this look on you" : "Add your photo"}</p>
              <p className="max-w-[26ch] text-sm text-muted-foreground">
                {isActive ? "A few seconds — stay on this card." : hasPhoto ? "Swipe up or tap ✨ and it appears on your photo." : "One full-body photo and every look is shown on you."}
              </p>
              {isActive && job && <Progress value={job.progress} className="w-40" aria-label="Try-on progress" />}
              {job?.status === "failed" && !isActive && <p className="text-xs text-destructive">Could not dress you this time — try again.</p>}
            </div>
          ))}
        {view === "pieces" && (
          <ul className="grid size-full grid-cols-2 content-start gap-3 overflow-y-auto p-5 pb-32">
            {outfit.items.map(({ slot, item }) => (
              <li key={item.id} className="rounded-2xl bg-card p-2 shadow-sm">
                <ItemTile item={item} showLabel={false} ratio="aspect-square" size="sm" />
                <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{SLOT_LABELS[slot]}</p>
                <p className="truncate text-xs font-medium capitalize">{item.label}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------------------------------------------------- photo indicators */}
      <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
        {CARD_VIEWS.map((v, i) => (
          <span key={v} className={cn("h-1 flex-1 rounded-full transition-colors", i === viewIndex ? "bg-foreground/80" : "bg-foreground/20")} />
        ))}
      </div>
      {result && view !== "on-you" && (
        <span className="absolute left-3 top-6 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
          <SparklesIcon className="size-3" />
          On you ready
        </span>
      )}
      {isActive && view !== "on-you" && (
        <span className="absolute left-3 top-6 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
          <Loader2Icon className="size-3 animate-spin" />
          Dressing you…
        </span>
      )}

      {/* ---------------------------------------------------------- stamps */}
      <span aria-hidden style={{ opacity: like, transform: `rotate(-14deg) scale(${0.9 + like * 0.2})` }} className="absolute left-5 top-10 rounded-lg border-[5px] border-emerald-500 px-3 py-1 text-3xl font-black tracking-widest text-emerald-500">
        LIKE
      </span>
      <span aria-hidden style={{ opacity: nope, transform: `rotate(14deg) scale(${0.9 + nope * 0.2})` }} className="absolute right-5 top-10 rounded-lg border-[5px] border-rose-500 px-3 py-1 text-3xl font-black tracking-widest text-rose-500">
        NOPE
      </span>
      <span aria-hidden style={{ opacity: up, transform: `translateX(-50%) scale(${0.9 + up * 0.2})` }} className="absolute bottom-28 left-1/2 rounded-lg border-[5px] border-sky-500 px-3 py-1 text-2xl font-black tracking-widest text-sky-500">
        SEE ON ME
      </span>

      {/* ---------------------------------------------------------- caption */}
      <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-4 pt-16 text-white transition-opacity", expanded && "opacity-0")}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold capitalize drop-shadow">{outfitTitle(outfit)}</h3>
            <p className="truncate text-sm text-white/85 capitalize">{outfit.items.map((i) => i.item.label).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conditions.map((c) => (
                <span key={c} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] backdrop-blur">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Why this outfit?"
            aria-expanded={expanded}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur transition-transform hover:scale-105"
          >
            <InfoIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------- info sheet */}
      <div
        className={cn("absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-3xl bg-card p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] transition-transform duration-300", expanded ? "translate-y-0" : "translate-y-full")}
        onPointerDown={(e) => e.stopPropagation()}
        aria-hidden={!expanded}
      >
        <button type="button" onClick={onToggleExpanded} className="mx-auto mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronUpIcon className="size-3 rotate-180" />
          Close
        </button>
        <h3 className="text-lg font-semibold capitalize">{outfitTitle(outfit)}</h3>
        <p className="text-xs text-muted-foreground">{conditions.join(" · ")}</p>
        {outfit.reasons.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {outfit.reasons.map((r) => (
              <li key={r}>✓ {r}</li>
            ))}
          </ul>
        )}
        <ul className="mt-4 grid grid-cols-4 gap-2">
          {outfit.items.map(({ slot, item }) => (
            <li key={item.id} className="min-w-0">
              <ItemTile item={item} showLabel={false} ratio="aspect-square" size="sm" />
              <p className="mt-1 truncate text-[10px] text-muted-foreground">{SLOT_LABELS[slot]}</p>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
