import {
  CloudDrizzleIcon,
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";

/** WMO weather interpretation codes (Open-Meteo) → label + icon. */
export function describeWeatherCode(code: number | null | undefined): { label: string; icon: LucideIcon } {
  if (code === null || code === undefined) return { label: "Unknown", icon: CloudIcon };
  if (code === 0) return { label: "Clear sky", icon: SunIcon };
  if (code === 1) return { label: "Mainly clear", icon: SunIcon };
  if (code === 2) return { label: "Partly cloudy", icon: CloudSunIcon };
  if (code === 3) return { label: "Overcast", icon: CloudIcon };
  if (code === 45 || code === 48) return { label: "Fog", icon: CloudFogIcon };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: CloudDrizzleIcon };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: CloudRainIcon };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: CloudSnowIcon };
  if (code >= 95) return { label: "Thunderstorm", icon: CloudLightningIcon };
  return { label: "Cloudy", icon: CloudIcon };
}

export function formatTemp(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}°`;
}

/** Collapses a forecast into the generator's five-way weather choice. */
export function weatherChoice(weather: {
  weather_code: number | null;
  strong_wind: boolean;
  rain_expected: boolean;
  snow_expected: boolean;
}): "sunny" | "cloudy" | "rainy" | "snowy" | "windy" {
  if (weather.snow_expected) return "snowy";
  if (weather.rain_expected) return "rainy";
  if (weather.strong_wind) return "windy";
  const code = weather.weather_code ?? 3;
  if (code <= 1) return "sunny";
  return "cloudy";
}
