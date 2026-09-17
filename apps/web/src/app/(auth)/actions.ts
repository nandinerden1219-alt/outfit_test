"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isDemoMode } from "@/lib/demo";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, passwordSchema } from "@/lib/validation/profile";
import type { ActionResult } from "@/types/api";

const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signUpSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1, "Tell us your name").max(60),
});

/** Only allow same-site relative redirects. */
function safeNext(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  if (isDemoMode) redirect("/home");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  redirect(safeNext(formData.get("next"), "/home"));
}

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  if (isDemoMode) redirect("/onboarding");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Email confirmation disabled in the Supabase project → session exists → go straight in.
  if (data.session) {
    redirect("/onboarding");
  }

  return {
    ok: true,
    message: "Check your inbox — we sent you a confirmation link.",
  };
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address" } };
  }

  if (isDemoMode) return { ok: true, message: "Demo mode — no email is sent." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: { password: parsed.error.issues[0]?.message ?? "Invalid password" } };
  }

  if (isDemoMode) return { ok: false, error: "Demo mode — changes are not saved." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { ok: false, error: error.message };
  }
  redirect("/home");
}

export async function signOut(): Promise<void> {
  if (!isDemoMode) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
