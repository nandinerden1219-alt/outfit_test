import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAppUser, getProfile } from "@/services/profile.service";

/**
 * Protected shell. The proxy already rejects anonymous requests; this layout
 * additionally routes users who haven't finished onboarding.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, appUser] = await Promise.all([getProfile(user.id), getAppUser(user.id)]);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  // The auth trigger creates public.users; fall back to auth data if it hasn't run yet.
  const shellUser = appUser ?? {
    id: user.id,
    email: user.email ?? "",
    display_name: (user.user_metadata?.display_name as string | undefined) ?? null,
    avatar_url: null,
    created_at: user.created_at,
    updated_at: user.created_at,
  };

  return <AppShell user={shellUser}>{children}</AppShell>;
}
