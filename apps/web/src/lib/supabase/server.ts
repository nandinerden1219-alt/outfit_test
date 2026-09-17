import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { DEMO_AUTH_USER, isDemoMode } from "@/lib/demo";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client bound to the request cookies.
 * Works in Server Components, Server Actions and Route Handlers.
 * Still uses the anon key — RLS applies to every query.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The proxy (src/proxy.ts) refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

/** Convenience: current authenticated user or null. Verified against Supabase Auth. */
export async function getCurrentUser() {
  if (isDemoMode) return DEMO_AUTH_USER;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
