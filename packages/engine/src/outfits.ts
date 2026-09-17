/** Naming, diversification and the short factual reasons shown as "Why this outfit?". */

import type { OccasionType, WeatherChoice } from "@outfit/shared";

import { garments, itemIds, label, type Candidate, type ScoredCandidate } from "./engine";
import { NEUTRAL_COLORS, ruleFor } from "./rules";
import type { WeatherContext } from "./weather";

export const MIN_OUTFITS = 3;
export const MAX_OUTFITS = 5;
export const MAX_COUNT = 12;

export type GenerationInput = {
  occasion: OccasionType;
  style: string | null;
  weather: WeatherChoice | null;
  temperature_c: number;
  count?: number;
  exclude?: string[][];
};

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * "<Style> <feature piece>" — e.g. "Minimal Camel Wool Coat". When that name is already
 * used in the batch, the next distinguishing piece is appended so cards never look alike.
 */
export function deterministicName(candidate: Candidate, style: string | null, taken?: Set<string>): string {
  const styleWord = (style ?? "").replace(/_/g, " ");
  const ordered = ["outerwear", "dress", "top", "layer", "bottom", "shoes"] as const;
  const pieces = ordered.map((s) => candidate.items[s]).filter((i): i is NonNullable<typeof i> => Boolean(i)).map((i) => title(label(i)));
  if (!pieces.length) return title(`${styleWord} look`.trim());
  let name = title(`${styleWord} ${pieces[0]}`.trim());
  for (const extra of pieces.slice(1)) {
    if (!taken || !taken.has(name)) break;
    name = name.includes(" with ") ? `${name}, ${extra}` : `${name} with ${extra}`;
  }
  return name;
}

/** Short factual bullets — never a "best" claim. */
export function descriptiveReasons(sc: ScoredCandidate, ctx: WeatherContext, inp: GenerationInput): string[] {
  const reasons = [`Suitable for ${Math.round(inp.temperature_c)}°C`];
  if (inp.weather === "rainy" || inp.weather === "snowy") reasons.push(`Chosen with ${inp.weather} weather in mind`);
  const outer = sc.candidate.items.outerwear;
  if ((ctx.layeringRecommended || outer) && outer) reasons.push(`${title(label(outer))} adds a layer for the cool air`);
  if (inp.style) reasons.push(`${title(inp.style.replace(/_/g, " "))} style`);
  reasons.push(`Works for ${ruleFor(inp.occasion).label.toLowerCase()}`);
  const colors = garments(sc.candidate).map(([, i]) => i.dominant_color).filter((c): c is string => Boolean(c));
  if (colors.length && colors.every((c) => NEUTRAL_COLORS.has(c))) reasons.push("Neutral color combination");
  else if (sc.breakdown.color >= 80) reasons.push("Colors work together");
  reasons.push("Uses your existing clothes");
  return reasons.slice(0, 5);
}

/** Prefer combinations that differ in more than one piece; keep at least MIN_OUTFITS. */
export function diversify(scored: ScoredCandidate[]): ScoredCandidate[] {
  const picked: ScoredCandidate[] = [];
  const differs = (a: ScoredCandidate, b: ScoredCandidate) => {
    const x = new Set(itemIds(a.candidate));
    const y = new Set(itemIds(b.candidate));
    let diff = 0;
    for (const id of x) if (!y.has(id)) diff++;
    for (const id of y) if (!x.has(id)) diff++;
    return diff >= 2;
  };
  for (const sc of scored) if (picked.every((p) => differs(sc, p))) picked.push(sc);
  if (picked.length < MIN_OUTFITS) for (const sc of scored) if (!picked.includes(sc) && picked.length < MIN_OUTFITS) picked.push(sc);
  return picked;
}

export const NAMING_PROMPT = (inp: GenerationInput, lines: string[]) =>
  `Give each outfit a short, friendly name (2–4 words, e.g. 'Casual Beige Layer'). ` +
  `Occasion: ${inp.occasion}; style: ${inp.style ?? "any"}; temperature: ${Math.round(inp.temperature_c)}°C. ` +
  `Return JSON {"outfits": [{"outfitId", "name"}]} using ONLY the ids given.\n${lines.join("\n")}`;

export const NAMING_SCHEMA = {
  type: "OBJECT",
  properties: { outfits: { type: "ARRAY", items: { type: "OBJECT", properties: { outfitId: { type: "STRING" }, name: { type: "STRING" } }, required: ["outfitId", "name"] } } },
  required: ["outfits"],
} as const;
