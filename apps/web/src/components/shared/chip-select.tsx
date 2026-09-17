"use client";

import { CheckIcon } from "lucide-react";

import type { ColorOption, Option } from "@/lib/constants/fashion";
import { cn } from "@/lib/utils";

type BaseProps = {
  name: string;
  className?: string;
  disabled?: boolean;
};

type SingleProps<T extends string> = BaseProps & {
  mode: "single";
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
};

type MultiProps<T extends string> = BaseProps & {
  mode: "multi";
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  max?: number;
};

type ChipSelectProps<T extends string> = SingleProps<T> | MultiProps<T>;

/** Pill-style selector for short option lists. Accessible via native buttons. */
export function ChipSelect<T extends string>(props: ChipSelectProps<T>) {
  const { options, name, className, disabled } = props;

  const isSelected = (v: T) => (props.mode === "single" ? props.value === v : props.value.includes(v));

  const toggle = (v: T) => {
    if (props.mode === "single") {
      props.onChange(props.value === v ? null : v);
      return;
    }
    if (props.value.includes(v)) {
      props.onChange(props.value.filter((x) => x !== v));
    } else if (!props.max || props.value.length < props.max) {
      props.onChange([...props.value, v]);
    }
  };

  const atMax = props.mode === "multi" && props.max !== undefined && props.value.length >= props.max;

  return (
    <div role="group" aria-label={name} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled || (!selected && atMax)}
            aria-pressed={selected}
            onClick={() => toggle(option.value)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:border-foreground/40",
            )}
          >
            {selected && <CheckIcon className="size-3.5" />}
            <span className="flex flex-col items-start leading-tight">
              <span>{option.label}</span>
              {option.description && (
                <span className={cn("text-xs font-normal", selected ? "text-background/70" : "text-muted-foreground")}>
                  {option.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type ColorChipSelectProps = BaseProps & {
  options: ColorOption[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  /** Values that are selected in the "other" list (e.g. avoided colours) — shown as unavailable. */
  excluded?: string[];
};

/** Colour swatches with name labels. */
export function ColorChipSelect({
  options,
  value,
  onChange,
  max,
  excluded = [],
  name,
  className,
  disabled,
}: ColorChipSelectProps) {
  const atMax = max !== undefined && value.length >= max;

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!atMax) onChange([...value, v]);
  };

  return (
    <div role="group" aria-label={name} className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6", className)}>
      {options.map((option) => {
        const selected = value.includes(option.value);
        const isExcluded = excluded.includes(option.value);
        const light = ["white", "cream", "beige", "yellow", "light_blue", "pink"].includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled || isExcluded || (!selected && atMax)}
            aria-pressed={selected}
            title={isExcluded ? "Already in your other list" : option.label}
            onClick={() => toggle(option.value)}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected ? "border-foreground bg-secondary" : "border-border bg-card hover:border-foreground/40",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border",
                light ? "border-border" : "border-transparent",
              )}
              style={{ backgroundColor: option.hex }}
            >
              {selected && <CheckIcon className={cn("size-3.5", light ? "text-foreground" : "text-white")} />}
            </span>
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
