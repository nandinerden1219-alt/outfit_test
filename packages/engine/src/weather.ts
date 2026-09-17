/** Normalised weather + the derived signals the engine reads. Provider-agnostic. */

import type { ApiDaily, ApiHourly, WeatherChoice } from "@outfit/shared";

import * as rules from "./rules";
import { bandFor, type TemperatureBand } from "./rules";

export type WeatherSnapshot = {
  id: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  temperature: number;
  feels_like: number;
  temp_min: number | null;
  temp_max: number | null;
  humidity: number | null;
  wind_speed: number | null;
  precipitation: number | null;
  precipitation_probability: number | null;
  weather_code: number | null;
  hourly: ApiHourly[];
  daily: ApiDaily[];
  provider: string;
  recorded_at: string;
  expires_at: string;
};

export type WeatherContext = {
  snapshot: WeatherSnapshot;
  band: TemperatureBand;
  effectiveFeelsLike: number;
  strongWind: boolean;
  rainExpected: boolean;
  snowExpected: boolean;
  layeringRecommended: boolean;
  morningFeelsLike: number | null;
  afternoonFeelsLike: number | null;
  eveningFeelsLike: number | null;
};

function feelsLikeAt(snapshot: WeatherSnapshot, hour: number): number | null {
  const first = snapshot.hourly[0];
  if (!first) return null;
  const day = first.time.slice(0, 10);
  const point = snapshot.hourly.find((p) => p.time.startsWith(day) && Number(p.time.slice(11, 13)) === hour);
  return point ? point.feels_like : null;
}

export function buildContext(snapshot: WeatherSnapshot): WeatherContext {
  const wind = snapshot.wind_speed ?? 0;
  const strongWind = wind >= rules.STRONG_WIND_KMH;
  const code = snapshot.weather_code ?? 0;
  const todayCodes = new Set([...snapshot.hourly.slice(0, 24).map((p) => p.weather_code), code]);
  const snow = [...todayCodes].some((c) => rules.SNOW_CODES.has(c));
  const rain =
    [...todayCodes].some((c) => rules.RAIN_CODES.has(c)) ||
    (snapshot.precipitation_probability ?? 0) >= rules.RAIN_PROBABILITY_THRESHOLD ||
    (snapshot.precipitation ?? 0) >= rules.RAIN_AMOUNT_MM_THRESHOLD;

  const morning = feelsLikeAt(snapshot, rules.MORNING_HOUR);
  const afternoon = feelsLikeAt(snapshot, rules.AFTERNOON_HOUR);
  const evening = feelsLikeAt(snapshot, rules.EVENING_HOUR);
  const samples = [morning, afternoon, evening, snapshot.feels_like].filter((v): v is number => v !== null);
  const swing = samples.length >= 2 ? Math.max(...samples) - Math.min(...samples) : 0;
  const layering = swing >= rules.LAYERING_SWING_C;

  // Strong wind makes it feel one band colder; dress for the colder part of the day.
  let effective = snapshot.feels_like - (strongWind ? 3 : 0);
  if (samples.length) effective = Math.min(effective, Math.min(...samples) + swing * 0.25);

  return {
    snapshot,
    band: bandFor(effective),
    effectiveFeelsLike: effective,
    strongWind,
    rainExpected: rain,
    snowExpected: snow,
    layeringRecommended: layering,
    morningFeelsLike: morning,
    afternoonFeelsLike: afternoon,
    eveningFeelsLike: evening,
  };
}

const WEATHER_CODES: Record<WeatherChoice, number> = { sunny: 0, cloudy: 3, rainy: 61, snowy: 71, windy: 3 };
const WINDY_KMH = 35;

/** Builds the engine's weather context from the form inputs (no API call). */
export function manualSnapshot(temperatureC: number, weather: WeatherChoice | null | undefined, now = new Date()): WeatherSnapshot {
  const windy = weather === "windy";
  return {
    id: null,
    location: null,
    latitude: 0,
    longitude: 0,
    temperature: temperatureC,
    feels_like: temperatureC - (windy ? 3 : 0),
    temp_min: null,
    temp_max: null,
    humidity: null,
    wind_speed: windy ? WINDY_KMH : 5,
    precipitation: weather === "rainy" ? 1.5 : 0,
    precipitation_probability: weather === "rainy" || weather === "snowy" ? 80 : 10,
    weather_code: weather ? WEATHER_CODES[weather] : 1,
    hourly: [],
    daily: [],
    provider: "manual",
    recorded_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 3_600_000).toISOString(),
  };
}

/** Collapses a forecast into the five-way weather choice used by the UI. */
export function weatherChoice(ctx: WeatherContext): WeatherChoice {
  if (ctx.snowExpected) return "snowy";
  if (ctx.rainExpected) return "rainy";
  if (ctx.strongWind) return "windy";
  return (ctx.snapshot.weather_code ?? 3) <= 1 ? "sunny" : "cloudy";
}
