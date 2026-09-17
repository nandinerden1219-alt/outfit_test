import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isDemoMode } from "@/lib/demo";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Routes that require a session. Everything else is public. */
const PROTECTED_PREFIXES = ["/home", "/wardrobe", "/outfits", "/try-on", "/saved-outfits", "/profile", "/onboarding"];

/** Signed-in users are bounced away from these. */
const AUTH_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * coarse route protection. Fine-grained checks (onboarding complete, row
 * ownership) happen in layouts and RLS respectively.
 */
export async function updateSession(request: NextRequest) {
  // Demo mode: no session to refresh and every route is viewable.
  if (isDemoMode) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth — do not replace with getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (AUTH_ONLY_PATHS.includes(pathname) || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
