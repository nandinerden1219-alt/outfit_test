import { CameraIcon, CheckIcon, LayersIcon, ShirtIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SwipeDeck } from "@/components/deck/swipe-deck";
import type { LiveWeather } from "@/components/outfit/outfit-generator";
import { BackendNotice } from "@/components/shared/backend-notice";
import { ApiClientError, errorMessage } from "@/lib/api";
import { readOccasion } from "@/lib/constants/occasion";
import { describeWeatherCode, weatherChoice } from "@/lib/constants/weather";
import { getCurrentUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getBodyProfileSafe } from "@/services/body.service";
import { getAppUser } from "@/services/profile.service";
import { listWardrobeItems } from "@/services/wardrobe.service";
import { getWeather } from "@/services/weather.service";

export const metadata = { title: "Today" };

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Home is today's deck: looks from your wardrobe for the weather, swiped like Tinder. */
export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const occasion = readOccasion(params.occasion) ?? "casual";

  const appUser = await getAppUser(user.id);
  const firstName = appUser?.display_name?.split(" ")[0];
  const hour = new Date().getHours();

  let wardrobeCount = 0;
  let hasPhoto = false;
  let photoUrl: string | null = null;
  let live: LiveWeather | null = null;
  let backendError: { message: string; unreachable: boolean } | null = null;
  try {
    const [items, profile] = await Promise.all([listWardrobeItems(), getBodyProfileSafe()]);
    wardrobeCount = items.filter((i) => i.available).length;
    hasPhoto = Boolean(profile?.front_image_url);
    photoUrl = profile?.front_image_url ?? null;
    try {
      const w = await getWeather();
      live = { location: w.location, temperature: w.feels_like, weather: weatherChoice(w), label: describeWeatherCode(w.weather_code).label.toLowerCase() };
    } catch {
      live = null;
    }
  } catch (e) {
    backendError = { message: errorMessage(e), unreachable: e instanceof ApiClientError && e.unreachable };
  }

  const setupDone = wardrobeCount > 0 && hasPhoto;
  const steps = [
    { label: "Add your photo", done: hasPhoto, href: "/try-on", icon: CameraIcon, hint: hasPhoto ? "Ready" : "Full body, facing the camera" },
    { label: "Upload your clothes", done: wardrobeCount > 0, href: "/wardrobe/add", icon: ShirtIcon, hint: wardrobeCount ? `${wardrobeCount} pieces` : "10–20 photos to start" },
    { label: "Swipe today's looks", done: false, href: "/home", icon: LayersIcon, hint: "Right to save, left to skip" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {greeting(hour)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Today&apos;s looks from your wardrobe. Swipe right to keep one.</p>
      </section>

      {backendError ? (
        <BackendNotice message={backendError.message} unreachable={backendError.unreachable} />
      ) : (
        <SwipeDeck live={live} hasPhoto={hasPhoto} photoUrl={photoUrl} wardrobeCount={wardrobeCount} initialOccasion={occasion} />
      )}

      {!setupDone && !backendError && (
        <section>
          <h2 className="mb-3 text-base font-semibold">Get set up</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map(({ label, done, href, icon: Icon, hint }, index) => (
              <li key={label}>
                <Link href={href} className="flex h-full items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", done ? "bg-foreground text-background" : "bg-secondary")}>
                    {done ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {index + 1}. {label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
