import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Brand } from "@/components/shared/brand";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBodyProfileSafe } from "@/services/body.service";
import { getAppUser, getProfile } from "@/services/profile.service";
import { EMPTY_PROFILE_FORM, profileToFormValues } from "@/types/user";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const [profile, appUser, bodyProfile] = await Promise.all([getProfile(user.id), getAppUser(user.id), getBodyProfileSafe()]);
  if (profile?.onboarding_completed_at && !isDemoMode) redirect("/home");

  const initialValues = profile ? profileToFormValues(profile) : EMPTY_PROFILE_FORM;
  const firstName = appUser?.display_name?.split(" ")[0] ?? null;

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Brand href="/onboarding" />
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 sm:px-8 sm:pt-8">
        <div className="rounded-3xl border bg-card p-6 sm:p-10">
          <OnboardingWizard initialValues={initialValues} firstName={firstName} bodyProfile={bodyProfile} />
        </div>
      </main>
    </div>
  );
}
