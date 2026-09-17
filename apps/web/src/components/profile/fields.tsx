"use client";

import { Loader2Icon, LocateFixedIcon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ChipSelect, ColorChipSelect } from "@/components/shared/chip-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_OPTIONS, FIT_OPTIONS, GENDER_OPTIONS, STYLE_OPTIONS } from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";
import { getBrowserLocation, searchLocations, type LocationSuggestion } from "@/services/geocoding.service";
import type { ProfileFormValues } from "@/types/user";

/**
 * Field groups shared by the onboarding wizard and the profile page.
 * Each group edits a slice of ProfileFormValues through a patch callback.
 */

export type FieldGroupProps = {
  values: ProfileFormValues;
  onChange: (patch: Partial<ProfileFormValues>) => void;
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Primitive: numeric input with unit
// ---------------------------------------------------------------------------

type NumberFieldProps = {
  label: string;
  unit: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
};

export function NumberField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 0.5,
  placeholder,
  hint,
  disabled,
  required,
}: NumberFieldProps) {
  const id = useId();
  const outOfRange = value !== null && (value < min || value > max);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {!required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          value={value ?? ""}
          aria-invalid={outOfRange}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
          className="pr-12"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted-foreground">
          {unit}
        </span>
      </div>
      {outOfRange ? (
        <p className="text-xs text-destructive">
          Enter a value between {min} and {max} {unit}.
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basics: height, weight, gender
// ---------------------------------------------------------------------------

export function BasicsFields({ values, onChange, disabled }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          label="Height"
          unit="cm"
          value={values.heightCm}
          onChange={(heightCm) => onChange({ heightCm })}
          min={100}
          max={250}
          placeholder="170"
          disabled={disabled}
          required
        />
        <NumberField
          label="Weight"
          unit="kg"
          value={values.weightKg}
          onChange={(weightKg) => onChange({ weightKg })}
          min={30}
          max={300}
          placeholder="65"
          disabled={disabled}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Gender</Label>
        <ChipSelect
          mode="single"
          name="Gender"
          options={GENDER_OPTIONS}
          value={values.gender}
          onChange={(gender) => onChange({ gender })}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">Used to interpret sizing and clothing categories. You can change it anytime.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Measurements (user-entered, optional)
// ---------------------------------------------------------------------------

export function MeasurementsFields({ values, onChange, disabled }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        If you know these, they help us judge fit. Leave anything blank if you&apos;re unsure — height and weight alone
        can&apos;t tell us your measurements, and we won&apos;t pretend they can.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Shoulder" unit="cm" value={values.shoulderCm} onChange={(shoulderCm) => onChange({ shoulderCm })} min={30} max={80} disabled={disabled} />
        <NumberField label="Bust / chest" unit="cm" value={values.bustCm} onChange={(bustCm) => onChange({ bustCm })} min={50} max={200} disabled={disabled} />
        <NumberField label="Waist" unit="cm" value={values.waistCm} onChange={(waistCm) => onChange({ waistCm })} min={40} max={200} disabled={disabled} />
        <NumberField label="Hip" unit="cm" value={values.hipCm} onChange={(hipCm) => onChange({ hipCm })} min={50} max={200} disabled={disabled} />
        <NumberField label="Inseam" unit="cm" value={values.inseamCm} onChange={(inseamCm) => onChange({ inseamCm })} min={50} max={120} disabled={disabled} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style + fit
// ---------------------------------------------------------------------------

export function StyleFields({ values, onChange, disabled }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Label>
          Your style <span className="font-normal text-muted-foreground">(pick up to 4)</span>
        </Label>
        <ChipSelect
          mode="multi"
          name="Style preferences"
          options={STYLE_OPTIONS}
          value={values.stylePreferences}
          onChange={(stylePreferences) => onChange({ stylePreferences })}
          max={4}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Preferred fit</Label>
        <ChipSelect
          mode="single"
          name="Preferred fit"
          options={FIT_OPTIONS}
          value={values.preferredFit}
          onChange={(preferredFit) => onChange({ preferredFit })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

export function ColorFields({ values, onChange, disabled }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Label>
          Colours you love <span className="font-normal text-muted-foreground">(up to 6)</span>
        </Label>
        <ColorChipSelect
          name="Favourite colours"
          options={COLOR_OPTIONS}
          value={values.favoriteColors}
          excluded={values.avoidColors}
          onChange={(favoriteColors) => onChange({ favoriteColors })}
          max={6}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>
          Colours you avoid <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <ColorChipSelect
          name="Avoided colours"
          options={COLOR_OPTIONS}
          value={values.avoidColors}
          excluded={values.favoriteColors}
          onChange={(avoidColors) => onChange({ avoidColors })}
          max={6}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location (for weather)
// ---------------------------------------------------------------------------

export function LocationFields({ values, onChange, disabled }: FieldGroupProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const inputId = useId();

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) setResults([]);
  };

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchLocations(query, controller.signal));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error("Couldn't search locations right now.");
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      onChange({ location: await getBrowserLocation() });
      setQuery("");
      setResults([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        We use your location only to fetch the local forecast. Search for a city or use your device location.
      </p>

      {values.location ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <MapPinIcon className="size-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{values.location.name}</p>
              <p className="text-xs text-muted-foreground">
                {values.location.latitude.toFixed(2)}, {values.location.longitude.toFixed(2)}
                {values.location.timezone ? ` · ${values.location.timezone}` : ""}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove location" disabled={disabled} onClick={() => onChange({ location: null })}>
            <XIcon />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground" />
            <Input
              id={inputId}
              placeholder="Search for a city"
              value={query}
              disabled={disabled}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-10"
              autoComplete="off"
              aria-label="Search for a city"
            />
            {searching && <Loader2Icon className="absolute inset-y-0 right-3.5 my-auto size-4 animate-spin text-muted-foreground" />}
          </div>

          {results.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary")}
                    onClick={() => {
                      onChange({ location: { name: r.name, latitude: r.latitude, longitude: r.longitude, timezone: r.timezone } });
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button type="button" variant="outline" onClick={useMyLocation} disabled={disabled || locating} className="self-start">
            {locating ? <Loader2Icon className="animate-spin" /> : <LocateFixedIcon />}
            Use my current location
          </Button>
        </div>
      )}
    </div>
  );
}
