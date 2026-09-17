import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAppUser, getProfile } from "@/services/profile.service";
import { EMPTY_PROFILE_FORM, profileToFormValues } from "@/types/user";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, appUser] = await Promise.all([getProfile(user.id), getAppUser(user.id)]);

  const shellUser = appUser ?? {
    id: user.id,
    email: user.email ?? "",
    display_name: null,
    avatar_url: null,
    created_at: user.created_at,
    updated_at: user.created_at,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profile"
        description="Your details and style preferences. Outfit generation uses these alongside what you type in the form."
      />
      <ProfileForm user={shellUser} initialValues={profile ? profileToFormValues(profile) : EMPTY_PROFILE_FORM} />
    </div>
  );
}
