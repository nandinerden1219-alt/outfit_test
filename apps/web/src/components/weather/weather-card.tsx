import { DropletsIcon, LayersIcon, MapPinIcon, ThermometerIcon, WindIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { describeWeatherCode, formatTemp } from "@/lib/constants/weather";
import { cn } from "@/lib/utils";
import type { ApiWeather } from "@/types/api-models";

type WeatherCardProps = {
  weather: ApiWeather;
  compact?: boolean;
  className?: string;
};

export function WeatherCard({ weather, compact = false, className }: WeatherCardProps) {
  const { label, icon: Icon } = describeWeatherCode(weather.weather_code);
  const signals = [
    weather.strong_wind && "Windy",
    weather.snow_expected ? "Snow" : weather.rain_expected && "Rain likely",
    weather.layering_recommended && "Big swing today",
  ].filter(Boolean) as string[];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className={cn("flex flex-col gap-4", compact ? "p-4" : "p-5 sm:p-6")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary">
              <Icon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPinIcon className="size-3" />
                <span className="truncate">{weather.location ?? "Your location"}</span>
              </p>
              <p className="text-3xl font-semibold leading-tight">
                {formatTemp(weather.temperature)}
                <span className="ml-2 text-base font-normal text-muted-foreground">{label}</span>
              </p>
            </div>
          </div>
          {!compact && (
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">{weather.band_label}</span>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-secondary/60 px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <ThermometerIcon className="size-3" /> Feels like
            </dt>
            <dd className="font-semibold">{formatTemp(weather.feels_like)}</dd>
          </div>
          <div className="rounded-xl bg-secondary/60 px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <WindIcon className="size-3" /> Wind
            </dt>
            <dd className="font-semibold">{weather.wind_speed !== null ? `${Math.round(weather.wind_speed)} km/h` : "—"}</dd>
          </div>
          <div className="rounded-xl bg-secondary/60 px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <DropletsIcon className="size-3" /> Rain
            </dt>
            <dd className="font-semibold">
              {weather.precipitation_probability !== null ? `${Math.round(weather.precipitation_probability)}%` : "—"}
            </dd>
          </div>
        </dl>

        {!compact && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>
              Today {formatTemp(weather.temp_min)} – {formatTemp(weather.temp_max)}
            </span>
            {weather.morning_feels_like !== null && weather.afternoon_feels_like !== null && (
              <span>
                Morning {formatTemp(weather.morning_feels_like)} · Afternoon {formatTemp(weather.afternoon_feels_like)}
                {weather.evening_feels_like !== null && ` · Evening ${formatTemp(weather.evening_feels_like)}`}
              </span>
            )}
            {signals.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                {s === "Big swing today" && <LayersIcon className="size-3" />}
                {s}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Shown when the profile has no coordinates yet. */
export function WeatherNeedsLocation() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Add your location</p>
          <p className="text-sm text-muted-foreground">We need it to fetch the local forecast.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/profile">Set location</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
