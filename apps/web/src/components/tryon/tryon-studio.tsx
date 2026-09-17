"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */

import { ChevronLeftIcon, ChevronRightIcon, HeartIcon, Loader2Icon, RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { evaluateAction, saveCombinationAction, startTryOnAction } from "@/app/(app)/actions";
import { MatchBadge, type Verdict } from "@/components/outfit/match-badge";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { PhotoUploader } from "@/components/tryon/photo-uploader";
import { ItemTile } from "@/components/wardrobe/item-tile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { OCCASION_OPTIONS, SLOT_LABELS, TRYON_SLOTS } from "@/lib/constants/fashion";
import { useTryOnJob } from "@/lib/hooks/use-tryon-job";
import { cycle, ROW_ORDER, selectedIds, type Selection } from "@/lib/tryon-selection";
import { cn } from "@/lib/utils";
import type { ApiBodyProfile, ApiOutfit, ApiTryOnJob, ApiWardrobeItem } from "@/types/api-models";
import type { OccasionType, OutfitSlot } from "@/types/database";

/** Rows always shown; dress/layer/accessory rows appear only when used. */
const KEY_SLOTS: OutfitSlot[] = ["outerwear", "top", "bottom", "shoes"];
const EVALUATE_DEBOUNCE_MS = 350;

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

type TryOnStudioProps = {
  items: ApiWardrobeItem[];
  profile: ApiBodyProfile | null;
  outfit: ApiOutfit | null;
  initialSelection: Selection;
  /** A completed job for exactly this selection, if one already exists. */
  initialJob: ApiTryOnJob | null;
  occasion: OccasionType;
  /** Injected for tests; defaults to the server action. */
  evaluate?: typeof evaluateAction;
};

export function TryOnStudio({ items, profile: initialProfile, outfit, initialSelection, initialJob, occasion: initialOccasion, evaluate = evaluateAction }: TryOnStudioProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [occasion, setOccasion] = useState<OccasionType>(initialOccasion);
  const [picker, setPicker] = useState<OutfitSlot | null>(null);
  const [verdict, setVerdict] = useState<{ verdict: Verdict; issues: string[] } | null>(outfit ? { verdict: "match", issues: [] } : null);
  const [starting, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(outfit?.saved ? outfit.id : null);
  const { job, setJob, pollError, isActive } = useTryOnJob(initialJob);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const bySlot = useMemo(() => {
    const map = new Map<OutfitSlot, ApiWardrobeItem[]>();
    for (const item of items) {
      if (!item.available) continue;
      map.set(item.slot, [...(map.get(item.slot) ?? []), item]);
    }
    return map;
  }, [items]);

  const ids = selectedIds(selection);
  const idsKey = ids.join(",");
  const dressed = ids.filter((id) => TRYON_SLOTS.has(byId.get(id)?.slot ?? "accessory"));
  const hasPhoto = Boolean(profile?.front_image_url);
  const jobMatches = job ? sameSet(job.item_ids, ids) : false;
  const rows = ROW_ORDER.filter((slot) => selection[slot] || KEY_SLOTS.includes(slot) || (slot === "dress" && !selection.top && !selection.bottom));
  const collageItems = rows
    .map((slot) => ({ slot, item: selection[slot] ? byId.get(selection[slot] as string) : undefined }))
    .filter((r): r is { slot: OutfitSlot; item: ApiWardrobeItem } => Boolean(r.item));

  // Re-judge the combination whenever it changes (debounced).
  const initialKey = selectedIds(initialSelection).join(",");
  useEffect(() => {
    if (!idsKey) return;
    if (idsKey === initialKey && outfit && occasion === initialOccasion) return; // generated outfits are matches by construction
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await evaluate(idsKey.split(","), occasion, outfit?.temperature_c ?? null);
      if (!cancelled && result.ok && result.data) setVerdict({ verdict: result.data.verdict, issues: result.data.issues });
    }, EVALUATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idsKey, occasion, initialKey, initialOccasion, outfit, evaluate]);

  const generate = () => {
    startGenerate(async () => {
      const result = await startTryOnAction(ids, outfit && sameSet(ids, outfit.items.map((i) => i.item.id)) ? outfit.id : null);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Could not start the try-on." : result.error);
        return;
      }
      setJob(result.data);
      setSavedId(null);
    });
  };

  const change = (slot: OutfitSlot, id: string | null) => {
    setSelection((current) => {
      const next = { ...current, [slot]: id };
      // A dress replaces top + bottom and vice versa.
      if (slot === "dress" && id) {
        next.top = null;
        next.bottom = null;
        next.layer = null;
      }
      if ((slot === "top" || slot === "bottom") && id) next.dress = null;
      return next;
    });
    setSavedId(null);
  };

  const save = () => {
    startSave(async () => {
      const result = await saveCombinationAction(ids, occasion, outfit && jobMatches ? outfit.name : null);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Could not save." : result.error);
        return;
      }
      setSavedId(result.data.id);
      toast.success("Outfit saved.");
    });
  };

  const showResult = job?.status === "completed" && job.result_image_url;
  const seeDisabled = starting || isActive || dressed.length === 0 || (jobMatches && job?.status === "completed");
  const seeLabel = job && !jobMatches ? "See new look on me" : job?.status === "completed" ? "This is on you" : "See it on me";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      {/* ---------------------------------------------------------------- on you */}
      <section className="flex flex-col gap-3">
        <div className="studio relative overflow-hidden rounded-3xl">
          <div className="aspect-[3/4] w-full">
            {showResult ? (
              <img src={job.result_image_url ?? ""} alt="You wearing this outfit" className="size-full object-contain" />
            ) : profile?.front_image_url ? (
              <img src={profile.front_image_url} alt="Your photo" className={cn("size-full object-contain transition", isActive && "scale-[1.01] opacity-40 blur-[2px]")} />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-base font-medium">Add a photo of yourself</p>
                <p className="max-w-[28ch] text-sm text-muted-foreground">Full body, facing the camera. Outfits are shown on this photo.</p>
              </div>
            )}
          </div>

          {isActive && job && (
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur" aria-live="polite">
              <div className="flex items-center gap-3 text-sm font-medium">
                <Loader2Icon className="size-4 shrink-0 animate-spin" />
                {job.step ?? "Working…"}
              </div>
              <Progress value={job.progress} className="mt-3" aria-label="Try-on progress" />
              {pollError && <p className="mt-2 text-xs text-destructive">{pollError}</p>}
            </div>
          )}

          {job?.status === "failed" && (
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur">
              <p className="text-sm font-medium">We could not generate this look.</p>
              {job.error && <p className="mt-1 text-xs text-muted-foreground">{job.error}</p>}
              <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={generate} disabled={starting || !hasPhoto}>
                <RefreshCwIcon data-icon="inline-start" />
                Try again
              </Button>
            </div>
          )}

          {showResult && (
            <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
              {jobMatches ? "Your look" : "Outfit changed"}
            </span>
          )}
          {hasPhoto && (
            <div className="absolute right-3 top-3">
              <PhotoUploader profile={profile} onSaved={setProfile} compact />
            </div>
          )}
        </div>

        {showResult && (job.skipped.length > 0 || job.applied.length > 0) && (
          <p className="px-1 text-xs text-muted-foreground">
            {job.applied.length > 0 && <>Dressed: {job.applied.join(", ")}. </>}
            {job.skipped.length > 0 && <>Shown but not dressed: {job.skipped.join(", ")}.</>}
          </p>
        )}

        {!hasPhoto ? (
          <div className="rounded-3xl border bg-card p-4">
            <PhotoUploader profile={profile} onSaved={setProfile} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={generate} disabled={seeDisabled} className="rounded-full">
              {starting || isActive ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              {seeLabel}
            </Button>
            <Button size="lg" variant={savedId ? "secondary" : "outline"} onClick={save} disabled={saving || ids.length < 2 || Boolean(savedId)} className="rounded-full">
              {saving ? <Loader2Icon className="animate-spin" /> : <HeartIcon className={cn(savedId && "fill-brand text-brand")} />}
              {savedId ? "Saved" : "Save"}
            </Button>
            {savedId && (
              <Button asChild variant="ghost" size="lg" className="rounded-full">
                <Link href="/saved-outfits">View saved</Link>
              </Button>
            )}
          </div>
        )}
        {hasPhoto && dressed.length === 0 && ids.length > 0 && (
          <p className="px-1 text-xs text-muted-foreground">Add a top, bottom, dress or outerwear — shoes and accessories are shown but not dressed.</p>
        )}
      </section>

      {/* ---------------------------------------------------------------- the outfit + swaps */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-3xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold capitalize">{outfit?.name && jobMatches ? outfit.name : "This outfit"}</h2>
              <p className="text-xs text-muted-foreground">{ids.length} pieces</p>
            </div>
            {verdict && idsKey && <MatchBadge verdict={verdict.verdict} />}
          </div>
          <OutfitCollage items={collageItems} className="mt-3 aspect-[5/4]" />
          {idsKey && verdict?.issues.length ? (
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {verdict.issues.slice(0, 3).map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Swap pieces</p>
            <select
              aria-label="Occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as OccasionType)}
              className="rounded-full border bg-card px-3 py-1 text-xs"
            >
              {OCCASION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {rows.map((slot) => {
            const current = selection[slot] ? (byId.get(selection[slot] as string) ?? null) : null;
            const options = bySlot.get(slot) ?? [];
            const canCycle = options.length > (current ? 1 : 0);
            return (
              <div key={slot} className="flex items-center gap-3 rounded-2xl border bg-card p-2.5" data-slot-row={slot}>
                <div className="w-14 shrink-0">
                  {current ? (
                    <ItemTile item={{ ...current, favorite: false }} showLabel={false} ratio="aspect-square" size="sm" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed text-[10px] text-muted-foreground">none</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{SLOT_LABELS[slot]}</p>
                  <p className="truncate text-sm font-medium capitalize">{current?.label ?? "Not selected"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label={`Previous ${SLOT_LABELS[slot].toLowerCase()}`} onClick={() => change(slot, cycle(options, current?.id ?? null, -1))} disabled={!canCycle || isActive}>
                    <ChevronLeftIcon />
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPicker(slot)} disabled={options.length === 0 || isActive}>
                    Swap
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label={`Next ${SLOT_LABELS[slot].toLowerCase()}`} onClick={() => change(slot, cycle(options, current?.id ?? null, 1))} disabled={!canCycle || isActive}>
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            );
          })}
          {job && !jobMatches && job.status !== "failed" && (
            <p className="rounded-2xl bg-brand-soft px-3 py-2 text-xs text-brand">You changed the outfit — see the new look on you when you are ready.</p>
          )}
        </div>
      </aside>

      {/* ---------------------------------------------------------------- picker */}
      <Dialog open={picker !== null} onOpenChange={(v) => !v && setPicker(null)}>
        <DialogContent className="max-w-2xl">
          {picker && (
            <>
              <DialogHeader>
                <DialogTitle>Choose a {SLOT_LABELS[picker].toLowerCase()}</DialogTitle>
                <DialogDescription>Only pieces from your wardrobe.</DialogDescription>
              </DialogHeader>
              <ul className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                {(bySlot.get(picker) ?? []).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        change(picker, item.id);
                        setPicker(null);
                      }}
                      aria-pressed={selection[picker] === item.id}
                      className={cn("w-full rounded-2xl border p-2 text-left transition-colors hover:border-foreground/40", selection[picker] === item.id && "border-foreground")}
                    >
                      <ItemTile item={{ ...item, favorite: false }} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
              {selection[picker] && (
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() => {
                    change(picker, null);
                    setPicker(null);
                  }}
                >
                  <XIcon data-icon="inline-start" />
                  Remove {SLOT_LABELS[picker].toLowerCase()}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
