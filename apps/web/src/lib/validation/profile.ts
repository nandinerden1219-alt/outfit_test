import { z } from "zod";

import { COLOR_OPTIONS, STYLE_OPTIONS } from "@/lib/constants/fashion";

const styleValues = STYLE_OPTIONS.map((o) => o.value);
const colorValues = COLOR_OPTIONS.map((o) => o.value);

/** Optional numeric field in a fixed range. `null` means "not provided". */
const optionalCm = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();

export const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(64).nullable(),
});

export const profileFormSchema = z.object({
  heightCm: optionalCm(100, 250),
  weightKg: optionalCm(30, 300),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).nullable(),
  bustCm: optionalCm(50, 200),
  waistCm: optionalCm(40, 200),
  hipCm: optionalCm(50, 200),
  shoulderCm: optionalCm(30, 80),
  inseamCm: optionalCm(50, 120),
  stylePreferences: z.array(z.enum(styleValues as [string, ...string[]])).max(6),
  favoriteColors: z.array(z.enum(colorValues as [string, ...string[]])).max(8),
  avoidColors: z.array(z.enum(colorValues as [string, ...string[]])).max(8),
  preferredFit: z.enum(["fitted", "regular", "relaxed", "oversized"]).nullable(),
  location: locationSchema.nullable(),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

/** Onboarding requires the basics; everything else stays optional. */
export const onboardingSchema = profileFormSchema.extend({
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]),
  stylePreferences: z.array(z.enum(styleValues as [string, ...string[]])).min(1).max(6),
});

export const emailSchema = z.email("Enter a valid email address");
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long");
