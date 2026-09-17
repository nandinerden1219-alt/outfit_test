import Link from "next/link";

import { signIn } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/home";
  const linkInvalid = params.error === "link_invalid";

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to see what to wear today.</p>
      </div>

      {linkInvalid && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>That link has expired or was already used. Please log in or request a new one.</AlertDescription>
        </Alert>
      )}

      <AuthForm
        action={signIn}
        submitLabel="Log in"
        hiddenFields={{ next }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
        footer={
          <div className="flex flex-col gap-3 text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
            <p>
              New here?{" "}
              <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        }
      />
    </>
  );
}
