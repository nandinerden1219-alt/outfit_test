/** Wires repositories, storage and providers for one request (or one queue message). */

import { buildContext, type WeatherSnapshot } from "@outfit/engine";
import type { ApiBodyProfile } from "@outfit/shared";

import type { CurrentUser } from "../auth";
import { d1Repositories } from "../db/d1";
import { MemoryStore, memoryRepositories } from "../db/memory";
import type { Repositories } from "../db/repositories";
import { newId, nowIso, type BodyProfile } from "../domain";
import { settingsFrom, type Env, type Settings } from "../env";
import { notConfigured, notFound } from "../errors";
import { MemoryStorage, R2Storage, UrlSigner, type Storage } from "../storage/storage";
import { OutfitService } from "./outfits";
import {
  GeminiClient,
  GeminiClothingAnalyzer,
  LeffaSpaceVirtualTryOnService,
  MockVirtualTryOnService,
  NoopBackgroundRemover,
  OpenMeteoProvider,
  RemoveBgBackgroundRemover,
  type BackgroundRemover,
  type ClothingAnalyzer,
  type JsonModel,
  type VirtualTryOnService,
  type WeatherProvider,
} from "./providers";
import { TryOnJobService } from "./tryon";
import { WardrobeService } from "./wardrobe";

export type Overrides = Partial<{
  repos: Repositories;
  storage: Storage;
  analyzer: ClothingAnalyzer | null;
  remover: BackgroundRemover;
  tryon: VirtualTryOnService;
  weather: WeatherProvider;
  model: JsonModel | null;
}>;

export type Services = {
  settings: Settings;
  repos: Repositories;
  storage: Storage;
  signer: UrlSigner;
  wardrobe: WardrobeService;
  outfits: OutfitService;
  tryOnJobs: TryOnJobService;
  body: BodyService;
  weather: WeatherService;
};

// Demo mode keeps one store per isolate so uploads and jobs survive between requests.
let demoStore: MemoryStore | null = null;
let demoStorage: MemoryStorage | null = null;

export function resetDemoState() {
  demoStore = null;
  demoStorage = null;
}

export function buildServices(env: Env, overrides: Overrides = {}): Services {
  const settings = settingsFrom(env);
  const signer = new UrlSigner(settings.publicBaseUrl, settings.fileUrlSecret);

  let repos = overrides.repos;
  let storage = overrides.storage;
  if (settings.demoMode) {
    demoStore ??= new MemoryStore();
    demoStorage ??= new MemoryStorage(signer);
    repos ??= memoryRepositories(demoStore);
    storage ??= demoStorage;
  } else {
    if (!repos) {
      if (!env.DB) throw notConfigured("D1 database binding (DB) is missing.");
      repos = d1Repositories(env.DB);
    }
    if (!storage) {
      if (!env.WARDROBE || !env.BODY_PHOTOS || !env.TRYON) throw notConfigured("R2 bucket bindings are missing.");
      if (!settings.fileUrlSecret) throw notConfigured("FILE_URL_SECRET is required to serve images.");
      storage = new R2Storage({ wardrobe: env.WARDROBE, "body-photos": env.BODY_PHOTOS, "try-on": env.TRYON }, signer);
    }
  }

  const model = "model" in overrides ? (overrides.model ?? null) : settings.geminiApiKey ? new GeminiClient(settings.geminiApiKey, settings.geminiModel) : null;
  const analyzer = "analyzer" in overrides ? (overrides.analyzer ?? null) : model ? new GeminiClothingAnalyzer(model) : null;
  const remover = overrides.remover ?? (settings.backgroundRemoval === "removebg" && settings.removeBgApiKey ? new RemoveBgBackgroundRemover(settings.removeBgApiKey) : new NoopBackgroundRemover());
  const tryon = overrides.tryon ?? (settings.tryonProvider === "leffa" ? new LeffaSpaceVirtualTryOnService(settings) : new MockVirtualTryOnService());
  const weatherProvider = overrides.weather ?? new OpenMeteoProvider();

  const wardrobe = new WardrobeService(repos, storage, analyzer, remover);
  return {
    settings,
    repos,
    storage,
    signer,
    wardrobe,
    outfits: new OutfitService(repos, wardrobe, model),
    tryOnJobs: new TryOnJobService(repos, storage, tryon),
    body: new BodyService(repos, storage),
    weather: new WeatherService(repos, weatherProvider),
  };
}

// ---------------------------------------------------------------- body photos

export class BodyService {
  constructor(
    private repos: Repositories,
    private storage: Storage,
  ) {}

  latest(userId: string) {
    return this.repos.body.latest(userId);
  }

  async savePhotos(userId: string, paths: Partial<Pick<BodyProfile, "front_image_path" | "side_image_path" | "back_image_path">>): Promise<BodyProfile> {
    const clean = Object.fromEntries(Object.entries(paths).filter(([, v]) => v)) as typeof paths;
    const latest = await this.latest(userId);
    if (latest) {
      const updated = await this.repos.body.updatePhotos(userId, latest.id, clean);
      if (updated) return updated;
    }
    const now = nowIso();
    return this.repos.body.create({ id: newId(), user_id: userId, front_image_path: null, side_image_path: null, back_image_path: null, model_type: "photos-only", created_at: now, updated_at: now, ...clean });
  }

  async toApi(p: BodyProfile): Promise<ApiBodyProfile> {
    const url = (path: string | null) => (path ? this.storage.signedUrl("body-photos", path) : Promise.resolve(null));
    const [front_image_url, side_image_url, back_image_url] = await Promise.all([url(p.front_image_path), url(p.side_image_path), url(p.back_image_path)]);
    return { id: p.id, model_type: p.model_type, front_image_path: p.front_image_path, side_image_path: p.side_image_path, back_image_path: p.back_image_path, front_image_url, side_image_url, back_image_url, created_at: p.created_at };
  }
}

// ---------------------------------------------------------------- weather

export class WeatherService {
  constructor(
    private repos: Repositories,
    private provider: WeatherProvider,
  ) {}

  async forUser(userId: string, force = false): Promise<WeatherSnapshot> {
    const profile = await this.repos.users.getProfile(userId);
    if (!profile || profile.latitude === null || profile.longitude === null) throw notFound("Add your location to your profile to get the weather.");
    return this.forLocation(userId, profile.latitude, profile.longitude, profile.timezone, profile.location_name, force);
  }

  async forLocation(userId: string, latitude: number, longitude: number, timezone: string | null, locationName: string | null, force = false): Promise<WeatherSnapshot> {
    if (!force) {
      const cached = await this.repos.weather.latestFresh(userId, latitude, longitude, new Date());
      if (cached) return cached;
    }
    const snapshot = await this.provider.fetch(latitude, longitude, timezone);
    return this.repos.weather.save(userId, { ...snapshot, location: locationName });
  }

  toApi(snapshot: WeatherSnapshot) {
    const ctx = buildContext(snapshot);
    return {
      ...snapshot,
      band: ctx.band.name,
      band_label: ctx.band.label,
      advice: ctx.band.advice,
      strong_wind: ctx.strongWind,
      rain_expected: ctx.rainExpected,
      snow_expected: ctx.snowExpected,
      layering_recommended: ctx.layeringRecommended,
      morning_feels_like: ctx.morningFeelsLike,
      afternoon_feels_like: ctx.afternoonFeelsLike,
      evening_feels_like: ctx.eveningFeelsLike,
    };
  }
}

/** First request from a signed-in user creates their row (Supabase Auth owns identity). */
export async function ensureUser(services: Services, user: CurrentUser) {
  if (services.settings.demoMode) return;
  await services.repos.users.ensureUser({ id: user.id, email: user.email ?? "", display_name: user.displayName });
}
