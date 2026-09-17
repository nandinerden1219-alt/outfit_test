"use client";

import { HeartIcon, Loader2Icon, MapPinIcon, RefreshCwIcon, SparklesIcon, Undo2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { cachedTryOnsAction, generateOutfitsAction, setOutfitSavedAction, startTryOnAction } from "@/app/(app)/actions";
import { CARD_VIEWS, DeckCard, type CardView } from "@/components/deck/deck-card";
import { MatchOverlay } from "@/components/deck/match-overlay";
import { ChipSelect } from "@/components/shared/chip-select";
import { Button } from "@/components/ui/button";
import { OCCASION_OPTIONS } from "@/lib/constants/fashion";
import type { LiveWeather } from "@/components/outfit/outfit-generator";
import { cn } from "@/lib/utils";
import type { ApiOutfit, ApiTryOnJob } from "@/types/api-models";
import type { OccasionType } from "@/types/database";

export const DECK_SIZE = 8;
export const SWIPE_THRESHOLD_PX = 110;
const TAP_SLOP_PX = 6;
const FLY_MS = 320;
const CACHE_TTL_MS = 30 * 60 * 1000;

type Action = { outfit: ApiOutfit; liked: boolean };
type Fly = "left" | "right" | null;

type DeckState = {
  outfits: ApiOutfit[];
  tryOns: Record<string, ApiTryOnJob | null>;
  savedAt: number;
};

function cacheKey(occasion: OccasionType): string {
  return `deck:${new Date().toISOString().slice(0, 10)}:${occasion}`;
}

function readCache(occasion: OccasionType): DeckState | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(occasion));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeckState;
    return Date.now() - parsed.savedAt < CACHE_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(occasion: OccasionType, state: Omit<DeckState, "savedAt">) {
  try {
    sessionStorage.setItem(cacheKey(occasion), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // storage unavailable — the deck still works, it just regenerates next visit
  }
}

/** A tiny tick on phones that support it; silently nothing elsewhere. */
function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported
  }
}

type SwipeDeckProps = {
  live: LiveWeather | null;
  hasPhoto: boolean;
  photoUrl?: string | null;
  wardrobeCount: number;
  initialOccasion?: OccasionType;
  /** Injected for tests. */
  generate?: typeof generateOutfitsAction;
  cached?: typeof cachedTryOnsAction;
};

/**
 * Today's looks as a Tinder-style stack. Drag right → save, left → skip, up → see it
 * on your photo; tap the card's sides to flip between the look, "on you" and the pieces.
 * Keyboard: ← → ↑, Backspace to undo. Right swipes get an "It's a match!" moment.
 */
export function SwipeDeck({ live, hasPhoto, photoUrl = null, wardrobeCount, initialOccasion = "casual", generate = generateOutfitsAction, cached = cachedTryOnsAction }: SwipeDeckProps) {
  const router = useRouter();
  const [occasion, setOccasion] = useState<OccasionType>(initialOccasion);
  const [outfits, setOutfits] = useState<ApiOutfit[]>([]);
  const [tryOns, setTryOns] = useState<Record<string, ApiTryOnJob | null>>({});
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Action[]>([]);
  const [loading, setLoading] = useState(wardrobeCount > 0);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<Fly>(null);
  const [view, setView] = useState<CardView>("look");
  const [expanded, setExpanded] = useState(false);
  const [match, setMatch] = useState<ApiOutfit | null>(null);
  const [, startTransition] = useTransition();
  const [dressing, startDressing] = useTransition();
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  // Latest deck contents for "more looks" (read inside the stable load callback).
  const deckRef = useRef<{ outfits: ApiOutfit[]; tryOns: Record<string, ApiTryOnJob | null>; seen: string[][] }>({ outfits: [], tryOns: {}, seen: [] });

  const current = outfits[index] ?? null;
  const exhausted = !loading && !error && outfits.length > 0 && index >= outfits.length;
  const currentJob = current ? (tryOns[current.id] ?? null) : null;
  const currentResult = currentJob?.status === "completed" ? currentJob.result_image_url : null;

  const load = useCallback(
    async (occ: OccasionType, opts: { more?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      if (!opts.more) {
        const hit = readCache(occ);
        if (hit) {
          deckRef.current = { outfits: hit.outfits, tryOns: hit.tryOns, seen: hit.outfits.map((o) => o.items.map((i) => i.item.id)) };
          setOutfits(hit.outfits);
          setTryOns(hit.tryOns);
          setIndex(0);
          setHistory([]);
          setLoading(false);
          return;
        }
      }
      const result = await generate({
        occasion: occ,
        weather: live?.weather ?? null,
        temperature_c: live ? Math.round(live.temperature) : 18,
        count: DECK_SIZE,
        exclude: opts.more ? deckRef.current.seen : [],
      });
      if (!result.ok || !result.data) {
        setError(result.ok ? "No looks came back." : result.error);
        setLoading(false);
        return;
      }
      const fresh = result.data;
      const cachedJobs = await cached(fresh.map((o) => ({ id: o.id, item_ids: o.items.map((i) => i.item.id) })));
      const jobs = cachedJobs.ok && cachedJobs.data ? cachedJobs.data : {};
      const prev = deckRef.current;
      const nextOutfits = opts.more ? [...prev.outfits, ...fresh] : fresh;
      const nextTryOns = { ...(opts.more ? prev.tryOns : {}), ...jobs };
      deckRef.current = { outfits: nextOutfits, tryOns: nextTryOns, seen: [...(opts.more ? prev.seen : []), ...fresh.map((o) => o.items.map((i) => i.item.id))] };
      setOutfits(nextOutfits);
      setTryOns(nextTryOns);
      if (!opts.more) {
        setIndex(0);
        setHistory([]);
      }
      writeCache(occ, { outfits: nextOutfits, tryOns: nextTryOns });
      setLoading(false);
    },
    [generate, cached, live],
  );

  useEffect(() => {
    if (wardrobeCount === 0) return;
    // Deferred so the effect only schedules work (the lint rule's "no sync setState in effects").
    const id = window.setTimeout(() => void load(occasion), 0);
    return () => window.clearTimeout(id);
  }, [occasion, wardrobeCount, load]);

  const onJobChange = useCallback((outfitId: string, job: ApiTryOnJob | null) => {
    setTryOns((t) => {
      const next = { ...t, [outfitId]: job };
      deckRef.current = { ...deckRef.current, tryOns: next };
      return next;
    });
  }, []);

  useEffect(() => {
    if (outfits.length) writeCache(occasion, { outfits, tryOns });
  }, [tryOns, outfits, occasion]);

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setDrag({ dx: 0, dy: 0 });
    setFlying(null);
    setView("look");
    setExpanded(false);
  }, []);

  const commit = useCallback(
    (liked: boolean) => {
      if (!current || flying) return;
      haptic(liked ? [10, 40, 18] : 10);
      setFlying(liked ? "right" : "left");
      setExpanded(false);
      window.setTimeout(() => {
        setHistory((h) => [...h, { outfit: current, liked }]);
        advance();
        if (liked) setMatch(current);
      }, FLY_MS);
      if (liked) {
        startTransition(async () => {
          const result = await setOutfitSavedAction(current.id, true);
          if (!result.ok) toast.error(result.error);
          else setOutfits((list) => list.map((o) => (o.id === current.id ? { ...o, saved: true } : o)));
        });
      }
    },
    [current, flying, advance],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || flying) return;
    haptic(8);
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    setView("look");
    setExpanded(false);
    if (last.liked) {
      startTransition(async () => {
        await setOutfitSavedAction(last.outfit.id, false);
        setOutfits((list) => list.map((o) => (o.id === last.outfit.id ? { ...o, saved: false } : o)));
      });
    }
  }, [history, flying]);

  const seeOnMe = useCallback(
    (outfit: ApiOutfit | null = current) => {
      if (!outfit) return;
      if (!hasPhoto) {
        toast("Add a photo of yourself first.", { action: { label: "Add photo", onClick: () => router.push("/try-on") } });
        return;
      }
      setView("on-you");
      const existing = tryOns[outfit.id];
      if (existing && (existing.is_active || existing.status === "completed")) return;
      haptic(12);
      startDressing(async () => {
        const result = await startTryOnAction(
          outfit.items.map((i) => i.item.id),
          outfit.id,
        );
        if (!result.ok || !result.data) {
          toast.error(result.ok ? "Could not start." : result.error);
          return;
        }
        setTryOns((t) => {
          const next = { ...t, [outfit.id]: result.data ?? null };
          deckRef.current = { ...deckRef.current, tryOns: next };
          return next;
        });
      });
    },
    [current, hasPhoto, tryOns, router],
  );

  const flip = useCallback((direction: 1 | -1) => {
    setView((v) => {
      const i = CARD_VIEWS.indexOf(v);
      return CARD_VIEWS[(i + direction + CARD_VIEWS.length) % CARD_VIEWS.length];
    });
  }, []);

  // Keyboard: ← skip, → save, ↑/Enter see on me, ↓/space flip photo, Backspace undo, Esc close sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (match) {
        if (e.key === "Escape" || e.key === "Enter") setMatch(null);
        return;
      }
      if (e.key === "ArrowRight") commit(true);
      else if (e.key === "ArrowLeft") commit(false);
      else if (e.key === "ArrowUp" || e.key === "Enter") seeOnMe();
      else if (e.key === "ArrowDown" || e.key === " ") flip(1);
      else if (e.key === "Backspace") undo();
      else if (e.key === "Escape") setExpanded(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, seeOnMe, undo, flip, match]);

  // Pointer drag on the top card; a tap (no movement) flips the photo on the tapped side.
  const onPointerDown = (e: React.PointerEvent) => {
    if (flying || expanded) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) moved.current = true;
    setDrag({ dx, dy: Math.min(0, dy) * 0.9 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const { dx, dy } = drag;
    dragStart.current = null;
    setDragging(false);
    if (!moved.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      flip(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
      setDrag({ dx: 0, dy: 0 });
      return;
    }
    if (dx > SWIPE_THRESHOLD_PX) commit(true);
    else if (dx < -SWIPE_THRESHOLD_PX) commit(false);
    else if (dy < -SWIPE_THRESHOLD_PX) {
      setDrag({ dx: 0, dy: 0 });
      seeOnMe();
    } else setDrag({ dx: 0, dy: 0 });
  };

  const progress = Math.min(1, Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) / SWIPE_THRESHOLD_PX);
  const rotate = flying === "right" ? 24 : flying === "left" ? -24 : drag.dx / 16;
  const tx = flying === "right" ? 640 : flying === "left" ? -640 : drag.dx;
  const ty = flying ? -40 : drag.dy;
  const topBusy = Boolean(currentJob?.is_active) || dressing;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------------- context */}
      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm">
            <MapPinIcon className="size-3.5 text-muted-foreground" />
            <span className="truncate">{live.location ?? "Your location"}</span>
            <span className="text-muted-foreground">·</span>
            {Math.round(live.temperature)}° {live.label}
          </span>
        ) : (
          <Link href="/profile" className="rounded-full bg-secondary px-3 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline">
            Add your location for live weather
          </Link>
        )}
        {!hasPhoto && (
          <Link href="/try-on" className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm text-brand">
            <SparklesIcon className="size-3.5" />
            Add your photo to see looks on you
          </Link>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&>div]:flex-nowrap sm:[&>div]:flex-wrap">
        <ChipSelect mode="single" name="Occasion" options={OCCASION_OPTIONS} value={occasion} onChange={(v) => v && setOccasion(v)} disabled={loading} />
      </div>

      {/* ---------------------------------------------------------- stack */}
      <div className="relative mx-auto h-[min(54vh,640px)] w-full max-w-sm sm:h-[min(72vh,680px)]" role="region" aria-label="Today's looks" aria-live="polite">
        {loading ? (
          <div className="absolute inset-0 animate-pulse rounded-[28px] bg-secondary" />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed p-6 text-center">
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" className="rounded-full" onClick={() => load(occasion)}>
              <RefreshCwIcon data-icon="inline-start" />
              Try again
            </Button>
          </div>
        ) : wardrobeCount === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed p-6 text-center">
            <p className="text-base font-medium">Add your clothes first</p>
            <p className="text-sm text-muted-foreground">Looks are built only from what you own.</p>
            <Button asChild className="rounded-full">
              <Link href="/wardrobe/add">Add clothes</Link>
            </Button>
          </div>
        ) : exhausted ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[28px] bg-card p-6 text-center shadow-sm">
            <span className="relative flex size-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <span className="absolute inset-3 animate-ping rounded-full bg-brand/30 [animation-delay:300ms]" />
              <span className="relative flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <SparklesIcon className="size-5" />
              </span>
            </span>
            <div>
              <p className="text-base font-semibold">That&apos;s all for now</p>
              <p className="text-sm text-muted-foreground">
                {history.filter((h) => h.liked).length} saved · {history.filter((h) => !h.liked).length} skipped
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="rounded-full" onClick={() => load(occasion, { more: true })}>
                <SparklesIcon data-icon="inline-start" />
                More looks
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/saved-outfits">Saved</Link>
              </Button>
            </div>
          </div>
        ) : (
          outfits
            .slice(index, index + 3)
            .map((o, i) => {
              // Cards behind the top one grow into place as the top card leaves.
              const depth = i === 0 ? 0 : i - progress;
              return (
                <div
                  key={o.id}
                  className={cn("absolute inset-0 touch-none", i === 0 ? "z-30" : i === 1 ? "z-20" : "z-10")}
                  style={{
                    transform:
                      i === 0
                        ? `translate(${tx}px, ${ty}px) rotate(${rotate}deg)`
                        : `translateY(${Math.max(0, depth) * 14}px) scale(${1 - Math.max(0, depth) * 0.05})`,
                    transition: dragging ? "none" : `transform ${flying ? FLY_MS : 260}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FLY_MS}ms ease`,
                    opacity: i === 0 && flying ? 0 : 1,
                  }}
                  onPointerDown={i === 0 ? onPointerDown : undefined}
                  onPointerMove={i === 0 ? onPointerMove : undefined}
                  onPointerUp={i === 0 ? onPointerUp : undefined}
                  onPointerCancel={i === 0 ? onPointerUp : undefined}
                >
                  {/* keyed by job so a card re-mounts (and starts polling) when a try-on is assigned to it */}
                  <DeckCard
                    key={`${o.id}:${tryOns[o.id]?.id ?? "none"}`}
                    outfit={o}
                    job={tryOns[o.id] ?? null}
                    onJobChange={onJobChange}
                    view={i === 0 ? view : "look"}
                    expanded={i === 0 && expanded}
                    onToggleExpanded={i === 0 ? () => setExpanded((v) => !v) : undefined}
                    dx={i === 0 ? drag.dx : 0}
                    dy={i === 0 ? drag.dy : 0}
                    hasPhoto={hasPhoto}
                  />
                </div>
              );
            })
            .reverse()
        )}

        {match && (
          <MatchOverlay
            outfit={match}
            photoUrl={photoUrl}
            resultUrl={tryOns[match.id]?.status === "completed" ? (tryOns[match.id]?.result_image_url ?? null) : null}
            onSeeOnMe={() => {
              const target = match;
              setMatch(null);
              router.push(`/try-on?outfit=${encodeURIComponent(target.id)}`);
            }}
            onDismiss={() => setMatch(null)}
          />
        )}
      </div>

      {/* ---------------------------------------------------------- actions */}
      {current && !loading && !error && (
        <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 sm:gap-4">
          <ActionButton label="Undo" onClick={undo} disabled={history.length === 0} className="size-11 text-amber-500">
            <Undo2Icon className="size-4" />
          </ActionButton>
          <ActionButton label="Skip" onClick={() => commit(false)} className="size-14 text-rose-500">
            <XIcon className="size-7" />
          </ActionButton>
          <ActionButton label="See it on me" onClick={() => seeOnMe()} disabled={topBusy} className={cn("size-12 text-sky-500", currentResult && "ring-2 ring-sky-200")}>
            {topBusy ? <Loader2Icon className="size-5 animate-spin" /> : <SparklesIcon className="size-5" />}
          </ActionButton>
          <ActionButton label="Save" onClick={() => commit(true)} className="size-14 text-emerald-500">
            <HeartIcon className="size-7" />
          </ActionButton>
        </div>
      )}
      {current && !loading && (
        <p className="text-center text-xs text-muted-foreground">
          {index + 1} / {outfits.length} · tap the card to flip · swipe up to see it on you
        </p>
      )}
    </div>
  );
}

function ActionButton({ label, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-full border bg-card shadow-md transition-transform duration-150 hover:scale-110 active:scale-90 disabled:opacity-40 disabled:hover:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
