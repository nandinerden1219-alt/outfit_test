import { redirect } from "next/navigation";

import { updatePassword } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password" };

/** Reached from the emailed reset link; the callback has already created a session. */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password");

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {user.email}</p>
      </div>

      <AuthForm
        action={updatePassword}
        submitLabel="Update password"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
            hint: "At least 8 characters.",
          },
        ]}
      />
    </>
  );
}
