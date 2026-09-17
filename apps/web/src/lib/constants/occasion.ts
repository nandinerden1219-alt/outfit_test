import { OCCASION_OPTIONS } from "@/lib/constants/fashion";
import type { OccasionType } from "@/types/database";

const VALID = new Set<string>(OCCASION_OPTIONS.map((o) => o.value));

/** Parses an `?occasion=` search param; unknown values become null. Safe on server and client. */
export function readOccasion(value: string | string[] | undefined): OccasionType | null {
  return typeof value === "string" && VALID.has(value) ? (value as OccasionType) : null;
}
