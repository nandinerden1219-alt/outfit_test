/**
 * Public environment variables (safe for the browser).
 * Server-only secrets never live here — they belong to the FastAPI backend.
 *
 * Values are read lazily so an incomplete .env.local produces a clear error at
 * request time instead of breaking module evaluation during `next build`.
 */

import { isDemoMode } from "@/lib/demo";

/** Placeholders used only in demo mode; never contacted because demo mode skips Supabase calls. */
const DEMO_FALLBACKS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://demo.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
};

function required(name: string, value: string | undefined): string {
  if (!value && isDemoMode && DEMO_FALLBACKS[name]) return DEMO_FALLBACKS[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy apps/web/.env.example to apps/web/.env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  /** Supabase now issues "publishable" keys; legacy projects still call it the anon key. */
  get supabaseKey(): string {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get apiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};
