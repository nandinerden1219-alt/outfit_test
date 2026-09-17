"use client";

import { Loader2Icon, MapPinIcon, SlidersHorizontalIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { generateOutfitsAction } from "@/app/(app)/actions";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { ChipSelect } from "@/components/shared/chip-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OCCASION_OPTIONS, STYLE_OPTIONS, WEATHER_OPTIONS } from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";
import type { ApiOutfit, WeatherChoice } from "@/types/api-models";
import type { OccasionType } from "@/types/database";

export type LiveWeather = {
  location: string | null;
  temperature: number;
  weather: WeatherChoice;
  label: string;
};

type GeneratorProps = {
  wardrobeCount: number;
  /** Today's forecast for the profile location, when there is one. */
  live?: LiveWeather | null;
  defaultOccasion?: OccasionType;
  /** Generate on first render (e.g. arriving from the home page). */
  autoStart?: boolean;
};

export function OutfitGenerator({ wardrobeCount, live, defaultOccasion = "casual", autoStart = false }: GeneratorProps) {
  const [occasion, setOccasion] = useState<OccasionType>(defaultOccasion);
  const [style, setStyle] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherChoice | null>(live?.weather ?? null);
  const [temperature, setTemperature] = useState<string>(String(live ? Math.round(live.temperature) : 18));
  const [showFilters, setShowFilters] = useState(!live);
  const [outfits, setOutfits] = useState<ApiOutfit[] | null>(null);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const temp = Number(temperature);
  const valid = Number.isFinite(temp) && temp >= -50 && temp <= 60;

  const generate = () => {
    if (!valid || wardrobeCount === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await generateOutfitsAction({ occasion, style, weather, temperature_c: temp });
      if (!result.ok) {
        setOutfits(null);
        setError({ message: result.error, details: result.fieldErrors?.details });
        return;
      }
      setOutfits(result.data ?? []);
    });
  };

  // Arriving from the home page: show looks right away, no form to fill.
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && !started.current && wardrobeCount > 0) {
      started.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [autoStart, wardrobeCount]);

  const updateSaved = (updated: ApiOutfit) => setOutfits((current) => current?.map((o) => (o.id === updated.id ? updated : o)) ?? null);

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------- context bar */}
      <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm">
              <MapPinIcon className="size-3.5 text-muted-foreground" />
              <span className="truncate">{live.location ?? "Your location"}</span>
              <span className="text-muted-foreground">·</span>
              {Math.round(live.temperature)}° {live.label}
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-3 py-1.5 text-sm text-muted-foreground">No location yet — set the weather below</span>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            {showFilters ? "Hide options" : "Adjust"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Where are you going?</Label>
          <ChipSelect mode="single" name="Occasion" options={OCCASION_OPTIONS} value={occasion} onChange={(v) => v && setOccasion(v)} disabled={pending} />
        </div>

        {showFilters && (
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="temperature" className="text-xs uppercase tracking-wide text-muted-foreground">
                Temperature °C
              </Label>
              <Input id="temperature" type="number" inputMode="numeric" min={-50} max={60} value={temperature} onChange={(e) => setTemperature(e.target.value)} aria-invalid={!valid} disabled={pending} />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Weather</Label>
              <ChipSelect mode="single" name="Weather" options={WEATHER_OPTIONS} value={weather} onChange={setWeather} disabled={pending} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Style (optional)</Label>
              <ChipSelect mode="single" name="Style" options={STYLE_OPTIONS} value={style} onChange={setStyle} disabled={pending} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Only from the {wardrobeCount} pieces you own.</p>
          <Button size="lg" onClick={generate} disabled={pending || !valid || wardrobeCount === 0} className="rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {outfits ? "New looks" : "Show me outfits"}
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-dashed px-5 py-6 text-sm">
          <p className="font-medium">{error.message}</p>
          {error.details && (
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {error.details.split("\n").map((d) => (
                <li key={d} className="capitalize">
                  {d}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-muted-foreground">
            Try another occasion or temperature, or{" "}
            <Link href="/wardrobe/add" className="underline underline-offset-4">
              add more clothes
            </Link>
            .
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------- the feed */}
      {pending && !outfits ? (
        <div className="masonry" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("mb-4 animate-pulse break-inside-avoid rounded-2xl bg-secondary", i % 2 ? "aspect-[4/5]" : "aspect-[4/5.6]")} />
          ))}
        </div>
      ) : outfits && outfits.length > 0 ? (
        <section aria-live="polite">
          <p className="mb-3 text-sm text-muted-foreground">
            {outfits.length} looks for today · tap one to see it on you
          </p>
          <div className="masonry">
            {outfits.map((o) => (
              <OutfitCard key={o.id} outfit={o} onSavedChange={updateSaved} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
