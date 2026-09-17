"use server";

import { revalidatePath } from "next/cache";

import { isDemoMode } from "@/lib/demo";
import { getCurrentUser } from "@/lib/supabase/server";
import { onboardingSchema, profileFormSchema } from "@/lib/validation/profile";
import { saveProfile, updateDisplayName } from "@/services/profile.service";
import type { ActionResult } from "@/types/api";
import type { ProfileFormValues } from "@/types/user";

function firstIssue(issues: { path: PropertyKey[]; message: string }[]): string {
  const issue = issues[0];
  if (!issue) return "Please check your answers.";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Called at the end of the onboarding wizard. Requires the mandatory basics. */
export async function completeOnboarding(values: ProfileFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  if (isDemoMode) {
    // Let the demo walk through to /home without persisting anything.
    return { ok: true, message: "Demo mode — profile not saved." };
  }

  try {
    await saveProfile(user.id, parsed.data, { completeOnboarding: true });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save your profile." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Called from the profile page. All fields optional. */
export async function updateProfile(values: ProfileFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const parsed = profileFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  try {
    await saveProfile(user.id, parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save your profile." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function updateName(displayName: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const trimmed = displayName.trim();
  if (trimmed.length === 0 || trimmed.length > 60) {
    return { ok: false, error: "Name must be between 1 and 60 characters." };
  }

  try {
    await updateDisplayName(user.id, trimmed);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update your name." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Name updated." };
}
