"use client";

import { ChipSelect, ColorChipSelect } from "@/components/shared/chip-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  ITEM_FIT_OPTIONS,
  OCCASION_OPTIONS,
  PATTERN_OPTIONS,
  SEASON_OPTIONS,
  STYLE_OPTIONS,
  SUBCATEGORY_OPTIONS,
} from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";
import type { WardrobeItemInput } from "@/types/api-models";
import type { OccasionType, SeasonType, WardrobeCategory } from "@/types/database";

export type ItemFormValues = Omit<
  WardrobeItemInput,
  "image_path" | "original_image_path" | "processed_image_path" | "background_removed" | "needs_review"
>;

export const EMPTY_ITEM: ItemFormValues = {
  name: "",
  category: "top",
  subcategory: "",
  pattern: null,
  dominant_color: null,
  secondary_colors: [],
  material: "",
  season: [],
  warmth: 2,
  style: [],
  fit: "regular",
  formality: 2,
  occasions: [],
  layering: false,
  rain_protection: false,
  wind_protection: false,
  brand: "",
  size: "",
  favorite: false,
  available: true,
};

type ItemFormProps = {
  values: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  disabled?: boolean;
  /** Field names the AI was unsure about — highlighted for the user to confirm. */
  review?: boolean;
};

const SCALE = [1, 2, 3, 4, 5];

function ScaleField({
  label,
  low,
  high,
  value,
  onChange,
  disabled,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="w-14 text-xs text-muted-foreground">{low}</span>
        <div role="radiogroup" className="flex flex-1 gap-1.5">
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                "h-10 flex-1 rounded-lg border text-sm font-medium transition-colors",
                value === n ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/40",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="w-14 text-right text-xs text-muted-foreground">{high}</span>
      </div>
    </div>
  );
}

export function ItemForm({ values, onChange, disabled, review }: ItemFormProps) {
  return (
    <div className="flex flex-col gap-7">
      {review && (
        <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
          We weren&apos;t fully sure about this item. Please check the details below before saving.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Category</Label>
          <Select
            value={values.category}
            onValueChange={(v) => onChange({ category: v as WardrobeCategory, subcategory: "" })}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Type</Label>
          <Select
            value={values.subcategory ?? ""}
            onValueChange={(v) => onChange({ subcategory: v })}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="What kind?" />
            </SelectTrigger>
            <SelectContent>
              {SUBCATEGORY_OPTIONS[values.category].map((sub) => (
                <SelectItem key={sub} value={sub} className="capitalize">
                  {sub}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="e.g. Blue denim jacket"
            value={values.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            maxLength={80}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Pattern</Label>
          <ChipSelect
            mode="single"
            name="Pattern"
            options={PATTERN_OPTIONS}
            value={values.pattern}
            onChange={(pattern) => onChange({ pattern })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Main colour</Label>
        <ColorChipSelect
          name="Main colour"
          options={COLOR_OPTIONS}
          value={values.dominant_color ? [values.dominant_color] : []}
          onChange={(v) => onChange({ dominant_color: v[v.length - 1] ?? null })}
          max={1}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="material">
            Material <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="material"
            placeholder="cotton, wool, denim…"
            value={values.material ?? ""}
            onChange={(e) => onChange({ material: e.target.value })}
            maxLength={40}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Fit</Label>
          <ChipSelect
            mode="single"
            name="Fit"
            options={ITEM_FIT_OPTIONS}
            value={values.fit}
            onChange={(fit) => onChange({ fit })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Seasons</Label>
        <ChipSelect
          mode="multi"
          name="Seasons"
          options={SEASON_OPTIONS}
          value={values.season}
          onChange={(season) => onChange({ season: season as SeasonType[] })}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ScaleField label="Warmth" low="Light" high="Heavy" value={values.warmth} onChange={(warmth) => onChange({ warmth })} disabled={disabled} />
        <ScaleField label="Formality" low="Casual" high="Formal" value={values.formality} onChange={(formality) => onChange({ formality })} disabled={disabled} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          Style <span className="font-normal text-muted-foreground">(up to 4)</span>
        </Label>
        <ChipSelect
          mode="multi"
          name="Style"
          options={STYLE_OPTIONS}
          value={values.style}
          onChange={(style) => onChange({ style })}
          max={4}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Good for</Label>
        <ChipSelect
          mode="multi"
          name="Occasions"
          options={OCCASION_OPTIONS}
          value={values.occasions}
          onChange={(occasions) => onChange({ occasions: occasions as OccasionType[] })}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["layering", "Layers well"],
            ["rain_protection", "Rainproof"],
            ["wind_protection", "Windproof"],
            ["favorite", "Favourite"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 text-sm">
            <Checkbox checked={values[key]} onCheckedChange={(v) => onChange({ [key]: v === true })} disabled={disabled} />
            {label}
          </label>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand">
            Brand <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="brand" value={values.brand ?? ""} onChange={(e) => onChange({ brand: e.target.value })} maxLength={60} disabled={disabled} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="size">
            Size <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="size" value={values.size ?? ""} onChange={(e) => onChange({ size: e.target.value })} maxLength={20} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

/** Normalises empty strings to null before sending to the API. */
export function cleanItemValues(values: ItemFormValues): ItemFormValues {
  const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    ...values,
    name: text(values.name),
    subcategory: text(values.subcategory),
    material: text(values.material),
    brand: text(values.brand),
    size: text(values.size),
  };
}
