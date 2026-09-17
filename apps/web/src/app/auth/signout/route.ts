import { NextResponse, type NextRequest } from "next/server";

import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

/** POST-only sign-out so a plain link can't log someone out (CSRF hygiene). */
export async function POST(request: NextRequest) {
  if (!isDemoMode) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
