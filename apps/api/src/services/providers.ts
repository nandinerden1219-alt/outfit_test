/**
 * External AI / data providers, all over fetch (Workers-friendly). Each is behind a
 * small interface so tests and demo mode can swap in fakes. Provider names, keys and
 * payloads never reach the client — errors are mapped to plain messages.
 */

import { ANALYSIS_PROMPT, ANALYSIS_SCHEMA, normalizeAnalysis, type ClothingAnalysis, type WeatherSnapshot, WEATHER_CACHE_TTL_MINUTES } from "@outfit/engine";

import type { Settings } from "../env";
import { AppError, aiUnavailable } from "../errors";

export type ImageInput = { data: ArrayBuffer; mimeType: string };

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// ---------------------------------------------------------------- Gemini

export interface JsonModel {
  name: string;
  /** Structured JSON output for a prompt (+ optional images). */
  generateJson(prompt: string, options?: { images?: ImageInput[]; schema?: unknown; temperature?: number }): Promise<unknown>;
}

export class GeminiClient implements JsonModel {
  name = "gemini";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async generateJson(prompt: string, options: { images?: ImageInput[]; schema?: unknown; temperature?: number } = {}): Promise<unknown> {
    const parts = [...(options.images ?? []).map((img) => ({ inline_data: { mime_type: img.mimeType, data: b64(img.data) } })), { text: prompt }];
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: { response_mime_type: "application/json", response_schema: options.schema, temperature: options.temperature ?? 0.2 },
    };
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      throw aiUnavailable("The AI service is unavailable right now.");
    }
    if (!res.ok) throw aiUnavailable("The AI service is unavailable right now.");
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return JSON.parse(text);
    } catch {
      throw aiUnavailable("The AI returned an unreadable answer.");
    }
  }
}

export interface ClothingAnalyzer {
  name: string;
  analyze(image: ImageInput): Promise<ClothingAnalysis>;
}

export class GeminiClothingAnalyzer implements ClothingAnalyzer {
  name = "gemini";
  constructor(private model: JsonModel) {}
  async analyze(image: ImageInput): Promise<ClothingAnalysis> {
    const raw = await this.model.generateJson(ANALYSIS_PROMPT, { images: [image], schema: ANALYSIS_SCHEMA });
    return normalizeAnalysis(raw);
  }
}

// ---------------------------------------------------------------- background removal

export interface BackgroundRemover {
  name: string;
  /** PNG with alpha, or null to keep the original. Never throws for provider problems. */
  remove(image: ImageInput): Promise<ImageInput | null>;
}

export class NoopBackgroundRemover implements BackgroundRemover {
  name = "none";
  async remove() {
    return null;
  }
}

/** remove.bg (commercial API). Failures fall back to the original photo. */
export class RemoveBgBackgroundRemover implements BackgroundRemover {
  name = "removebg";
  constructor(private apiKey: string) {}
  async remove(image: ImageInput): Promise<ImageInput | null> {
    try {
      const form = new FormData();
      form.append("image_file", new Blob([image.data], { type: image.mimeType }), "item");
      form.append("size", "auto");
      form.append("format", "png");
      const res = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": this.apiKey }, body: form });
      if (!res.ok) {
        console.warn("remove.bg failed", res.status);
        return null;
      }
      return { data: await res.arrayBuffer(), mimeType: "image/png" };
    } catch (e) {
      console.warn("remove.bg unreachable", e);
      return null;
    }
  }
}

// ---------------------------------------------------------------- virtual try-on

export type GarmentRegion = "upper_body" | "lower_body" | "dresses";
export type GarmentInput = { image: ImageInput; region: GarmentRegion; label: string };
export type TryOnRequest = { person: ImageInput; garments: GarmentInput[] };
export type TryOnResult = { provider: string; status: "ok" | "unavailable"; image?: ImageInput; message?: string; applied: string[]; skipped: string[] };

export interface VirtualTryOnService {
  name: string;
  generateTryOn(request: TryOnRequest): Promise<TryOnResult>;
}

export const REGION_BY_CATEGORY: Record<string, GarmentRegion | null> = { top: "upper_body", outerwear: "upper_body", bottom: "lower_body", dress: "dresses", shoes: null, bag: null, accessory: null };
const REGION_ORDER: Record<GarmentRegion, number> = { dresses: 0, upper_body: 1, lower_body: 2 };

/** A dress is applied alone; otherwise at most one upper and one lower garment, upper first. */
export function planGarments(garments: GarmentInput[]): { ordered: GarmentInput[]; skipped: string[] } {
  const ordered = [...garments].sort((a, b) => REGION_ORDER[a.region] - REGION_ORDER[b.region]);
  const dress = ordered.find((g) => g.region === "dresses");
  if (dress) return { ordered: [dress], skipped: ordered.filter((g) => g !== dress).map((g) => g.label) };
  const chosen = new Map<GarmentRegion, GarmentInput>();
  const skipped: string[] = [];
  for (const g of ordered) {
    if (chosen.has(g.region)) skipped.push(g.label);
    else chosen.set(g.region, g);
  }
  return { ordered: (["upper_body", "lower_body"] as const).map((r) => chosen.get(r)).filter((g): g is GarmentInput => Boolean(g)), skipped };
}

export class MockVirtualTryOnService implements VirtualTryOnService {
  name = "mock";
  async generateTryOn(request: TryOnRequest): Promise<TryOnResult> {
    console.warn("MOCK try-on provider: no image generated. Set TRYON_PROVIDER=leffa.");
    return { provider: this.name, status: "unavailable", message: "Virtual try-on is not enabled on this server yet.", applied: [], skipped: request.garments.map((g) => g.label) };
  }
}

/**
 * Leffa on a Hugging Face Space through Gradio's HTTP API:
 *   POST /gradio_api/upload → file paths; POST /gradio_api/call/<fn> → event id;
 *   GET  /gradio_api/call/<fn>/<event id> → SSE stream ending in the result.
 * Garments are applied one at a time, feeding each output back in.
 */
export class LeffaSpaceVirtualTryOnService implements VirtualTryOnService {
  name = "leffa";
  private base: string;
  constructor(private settings: Settings) {
    this.base = `https://${settings.leffaSpace.replace("/", "-").toLowerCase()}.hf.space`;
  }
  private headers(extra: Record<string, string> = {}) {
    return this.settings.hfToken ? { ...extra, authorization: `Bearer ${this.settings.hfToken}` } : extra;
  }
  private async upload(image: ImageInput, name: string): Promise<{ path: string; orig_name: string; mime_type: string; meta: { _type: string } }> {
    const form = new FormData();
    form.append("files", new Blob([image.data], { type: image.mimeType }), name);
    const res = await fetch(`${this.base}/gradio_api/upload`, { method: "POST", headers: this.headers(), body: form });
    if (!res.ok) throw aiUnavailable("The try-on service is not reachable right now.");
    const [path] = (await res.json()) as string[];
    if (!path) throw aiUnavailable("The try-on service rejected the image.");
    return { path, orig_name: name, mime_type: image.mimeType, meta: { _type: "gradio.FileData" } };
  }
  private async predict(person: ImageInput, garment: ImageInput, region: GarmentRegion): Promise<ImageInput> {
    const [src, ref] = await Promise.all([this.upload(person, "person.jpg"), this.upload(garment, "garment.jpg")]);
    const call = await fetch(`${this.base}/gradio_api/call/leffa_predict_vt`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ data: [src, ref, false, this.settings.leffaSteps, 2.5, 42, this.settings.leffaModelType, region, false] }),
    });
    if (!call.ok) throw aiUnavailable("The try-on service failed or is over quota. Try again later.");
    const { event_id } = (await call.json()) as { event_id: string };
    const stream = await fetch(`${this.base}/gradio_api/call/leffa_predict_vt/${event_id}`, { headers: this.headers() });
    if (!stream.ok || !stream.body) throw aiUnavailable("The try-on service failed or is over quota. Try again later.");
    const text = await stream.text();
    // SSE: "event: complete\ndata: [...]" — take the last data line of the complete event.
    const lines = text.split("\n");
    let lastEvent = "";
    let payload: string | null = null;
    for (const line of lines) {
      if (line.startsWith("event:")) lastEvent = line.slice(6).trim();
      else if (line.startsWith("data:") && lastEvent === "complete") payload = line.slice(5).trim();
      else if (line.startsWith("data:") && lastEvent === "error") throw aiUnavailable("The try-on service failed or is over quota. Try again later.");
    }
    if (!payload) throw aiUnavailable("The try-on service returned no image.");
    const [result] = JSON.parse(payload) as Array<{ url?: string; path?: string }>;
    const url = result?.url ?? (result?.path ? `${this.base}/gradio_api/file=${result.path}` : null);
    if (!url) throw aiUnavailable("The try-on service returned no image.");
    const img = await fetch(url, { headers: this.headers() });
    if (!img.ok) throw aiUnavailable("The try-on service returned no image.");
    return { data: await img.arrayBuffer(), mimeType: img.headers.get("content-type")?.split(";")[0] || "image/png" };
  }
  async generateTryOn(request: TryOnRequest): Promise<TryOnResult> {
    const plan = planGarments(request.garments);
    if (!plan.ordered.length) return { provider: this.name, status: "unavailable", message: "No supported garments to try on.", applied: [], skipped: plan.skipped };
    let current = request.person;
    const applied: string[] = [];
    for (const g of plan.ordered) {
      current = await this.predict(current, g.image, g.region);
      applied.push(g.label);
    }
    return { provider: this.name, status: "ok", image: current, applied, skipped: plan.skipped };
  }
}

// ---------------------------------------------------------------- weather

export interface WeatherProvider {
  name: string;
  fetch(latitude: number, longitude: number, timezone: string | null): Promise<WeatherSnapshot>;
}

/** https://open-meteo.com — no key; free for non-commercial use. */
export class OpenMeteoProvider implements WeatherProvider {
  name = "open-meteo";
  async fetch(latitude: number, longitude: number, timezone: string | null): Promise<WeatherSnapshot> {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      timezone: timezone ?? "auto",
      forecast_days: "3",
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
      hourly: "temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code",
      daily: "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code",
    });
    let res: Response;
    try {
      res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    } catch {
      throw new AppError("weather_unavailable", "We couldn't update the weather right now.", 503);
    }
    if (!res.ok) throw new AppError("weather_unavailable", "We couldn't update the weather right now.", 503);
    const d = (await res.json()) as {
      current: Record<string, number | null>;
      hourly: Record<string, Array<number | null>> & { time: string[] };
      daily: Record<string, Array<number | null>> & { time: string[] };
    };
    const hourly = d.hourly.time
      .map((time, i) => ({
        time,
        temperature: d.hourly.temperature_2m?.[i] ?? null,
        feels_like: d.hourly.apparent_temperature?.[i] ?? 0,
        precipitation_probability: d.hourly.precipitation_probability?.[i] ?? 0,
        wind_speed: d.hourly.wind_speed_10m?.[i] ?? 0,
        weather_code: d.hourly.weather_code?.[i] ?? 0,
      }))
      .filter((p): p is typeof p & { temperature: number } => p.temperature !== null);
    const daily = d.daily.time.map((date, i) => ({
      date,
      temp_min: d.daily.temperature_2m_min?.[i] ?? 0,
      temp_max: d.daily.temperature_2m_max?.[i] ?? 0,
      feels_like_min: d.daily.apparent_temperature_min?.[i] ?? 0,
      feels_like_max: d.daily.apparent_temperature_max?.[i] ?? 0,
      precipitation_sum: d.daily.precipitation_sum?.[i] ?? 0,
      precipitation_probability_max: d.daily.precipitation_probability_max?.[i] ?? 0,
      wind_speed_max: d.daily.wind_speed_10m_max?.[i] ?? 0,
      weather_code: d.daily.weather_code?.[i] ?? 0,
    }));
    const now = new Date();
    const today = daily[0];
    return {
      id: null,
      location: null,
      latitude,
      longitude,
      temperature: d.current.temperature_2m ?? 0,
      feels_like: d.current.apparent_temperature ?? 0,
      temp_min: today?.temp_min ?? null,
      temp_max: today?.temp_max ?? null,
      humidity: d.current.relative_humidity_2m ?? null,
      wind_speed: d.current.wind_speed_10m ?? null,
      precipitation: d.current.precipitation ?? null,
      precipitation_probability: today?.precipitation_probability_max ?? null,
      weather_code: d.current.weather_code ?? null,
      hourly,
      daily,
      provider: this.name,
      recorded_at: now.toISOString(),
      expires_at: new Date(now.getTime() + WEATHER_CACHE_TTL_MINUTES * 60_000).toISOString(),
    };
  }
}
