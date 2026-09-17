import { ShirtIcon } from "lucide-react";
import Link from "next/link";

import { OutfitGenerator, type LiveWeather } from "@/components/outfit/outfit-generator";
import { BackendNotice } from "@/components/shared/backend-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError, errorMessage } from "@/lib/api";
import { readOccasion } from "@/lib/constants/occasion";
import { describeWeatherCode, weatherChoice } from "@/lib/constants/weather";
import { listWardrobeItems } from "@/services/wardrobe.service";
import { getWeather } from "@/services/weather.service";

export const metadata = { title: "Outfits" };

export default async function OutfitsPage({ searchParams }: PageProps<"/outfits">) {
  const params = await searchParams;
  const occasion = readOccasion(params.occasion) ?? "casual";
  const autoStart = params.go === "1";

  let wardrobeCount = 0;
  let live: LiveWeather | null = null;
  let error: { message: string; unreachable: boolean } | null = null;
  try {
    wardrobeCount = (await listWardrobeItems()).filter((i) => i.available).length;
    try {
      // Today's forecast for the profile location pre-fills the conditions; the user can still adjust.
      const w = await getWeather();
      live = { location: w.location, temperature: w.feels_like, weather: weatherChoice(w), label: describeWeatherCode(w.weather_code).label.toLowerCase() };
    } catch {
      live = null;
    }
  } catch (e) {
    error = { message: errorMessage(e), unreachable: e instanceof ApiClientError && e.unreachable };
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Outfits for today" description="Matched from your own wardrobe for the weather and where you are going. Tap a look to see it on you." />
      {error ? (
        <BackendNotice message={error.message} unreachable={error.unreachable} />
      ) : wardrobeCount === 0 ? (
        <EmptyState
          icon={ShirtIcon}
          title="Add some clothes first"
          description="Outfits are built only from what is in your wardrobe. Upload a top, a bottom and a pair of shoes to get started."
          action={
            <Button asChild className="rounded-full">
              <Link href="/wardrobe/add">Add clothes</Link>
            </Button>
          }
        />
      ) : (
        <OutfitGenerator wardrobeCount={wardrobeCount} live={live} defaultOccasion={occasion} autoStart={autoStart} />
      )}
    </div>
  );
}
