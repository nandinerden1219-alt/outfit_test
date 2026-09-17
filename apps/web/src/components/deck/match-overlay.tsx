"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */

import { HeartIcon, SparklesIcon } from "lucide-react";
import { useEffect } from "react";

import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { outfitTitle } from "@/lib/outfit-helpers";
import type { ApiOutfit } from "@/types/api-models";

type MatchOverlayProps = {
  outfit: ApiOutfit;
  /** The user's photo, when they have one. */
  photoUrl: string | null;
  /** A finished try-on for this outfit, when one exists. */
  resultUrl: string | null;
  onSeeOnMe: () => void;
  onDismiss: () => void;
};

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  delay: `${(i % 6) * 90}ms`,
  hue: (i * 47) % 360,
  size: 6 + (i % 4) * 3,
}));

/** "It's a match!" — the moment after a right swipe. Tap anywhere or wait to continue. */
export function MatchOverlay({ outfit, photoUrl, resultUrl, onSeeOnMe, onDismiss }: MatchOverlayProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  return (
    <div role="dialog" aria-label="Saved" onClick={onDismiss} className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden rounded-[28px] bg-foreground/90 p-6 text-center text-background backdrop-blur-sm">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-0 animate-[confetti_1.6s_ease-out_forwards] rounded-sm"
          style={{ left: c.left, animationDelay: c.delay, width: c.size, height: c.size * 1.6, backgroundColor: `hsl(${c.hue} 90% 60%)` }}
        />
      ))}
      <p className="text-4xl font-black italic tracking-tight text-brand drop-shadow-sm sm:text-5xl">It&apos;s a match!</p>
      <p className="mt-1 text-sm text-background/80">Saved to your looks.</p>

      <div className="mt-6 flex items-center gap-3">
        <div className="size-28 overflow-hidden rounded-full border-4 border-background bg-secondary shadow-lg">
          {photoUrl ? <img src={photoUrl} alt="You" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-4xl">🙂</span>}
        </div>
        <HeartIcon className="size-7 fill-brand text-brand" />
        <div className="size-28 overflow-hidden rounded-full border-4 border-background bg-secondary shadow-lg">
          {resultUrl ? <img src={resultUrl} alt={outfitTitle(outfit)} className="size-full object-cover" /> : <OutfitCollage items={outfit.items} className="aspect-auto size-full rounded-none p-3" />}
        </div>
      </div>
      <p className="mt-4 truncate text-base font-semibold capitalize">{outfitTitle(outfit)}</p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {!resultUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSeeOnMe();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-background px-5 text-sm font-medium text-foreground"
          >
            <SparklesIcon className="size-4" />
            See it on me
          </button>
        )}
        <button type="button" onClick={onDismiss} className="inline-flex min-h-11 items-center justify-center rounded-full border border-background/40 px-5 text-sm font-medium">
          Keep swiping
        </button>
      </div>
    </div>
  );
}
