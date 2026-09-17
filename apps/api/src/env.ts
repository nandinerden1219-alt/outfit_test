/** Worker bindings + configuration. Secrets come from `wrangler secret put` / .dev.vars. */

export type Env = {
  // ---- bindings
  DB?: D1Database;
  WARDROBE?: R2Bucket;
  BODY_PHOTOS?: R2Bucket;
  TRYON?: R2Bucket;
  TRYON_QUEUE?: Queue<TryOnQueueMessage>;

  // ---- vars
  ENV?: string;
  DEMO_MODE?: string;
  CORS_ORIGINS?: string;
  PUBLIC_BASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_JWT_AUDIENCE?: string;
  GEMINI_MODEL?: string;
  BACKGROUND_REMOVAL?: string;
  TRYON_PROVIDER?: string;
  LEFFA_SPACE?: string;
  LEFFA_MODEL_TYPE?: string;
  LEFFA_STEPS?: string;

  // ---- secrets
  SUPABASE_JWT_SECRET?: string;
  FILE_URL_SECRET?: string;
  GEMINI_API_KEY?: string;
  REMOVE_BG_API_KEY?: string;
  HF_TOKEN?: string;
};

export type TryOnQueueMessage = { jobId: string; userId: string };

export type Settings = {
  env: string;
  demoMode: boolean;
  corsOrigins: string[];
  publicBaseUrl: string;
  supabaseUrl: string;
  supabaseJwtSecret: string;
  supabaseJwtAudience: string;
  fileUrlSecret: string;
  geminiApiKey: string;
  geminiModel: string;
  backgroundRemoval: "none" | "removebg";
  removeBgApiKey: string;
  tryonProvider: "mock" | "leffa";
  leffaSpace: string;
  leffaModelType: "viton_hd" | "dress_code";
  leffaSteps: number;
  hfToken: string;
  maxImageBytes: number;
  allowedImageTypes: string[];
};

export function settingsFrom(env: Env): Settings {
  const demoMode = (env.DEMO_MODE ?? "false").toLowerCase() === "true";
  return {
    env: env.ENV ?? "development",
    demoMode,
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? "http://localhost:8000").replace(/\/$/, ""),
    supabaseUrl: (env.SUPABASE_URL ?? "").replace(/\/$/, ""),
    supabaseJwtSecret: env.SUPABASE_JWT_SECRET ?? "",
    supabaseJwtAudience: env.SUPABASE_JWT_AUDIENCE ?? "authenticated",
    // Demo mode gets a fixed secret so local URLs are stable; production must set one.
    fileUrlSecret: env.FILE_URL_SECRET || (demoMode ? "demo-file-url-secret" : ""),
    geminiApiKey: env.GEMINI_API_KEY ?? "",
    geminiModel: env.GEMINI_MODEL ?? "gemini-2.5-flash",
    backgroundRemoval: env.BACKGROUND_REMOVAL === "removebg" ? "removebg" : "none",
    removeBgApiKey: env.REMOVE_BG_API_KEY ?? "",
    tryonProvider: env.TRYON_PROVIDER === "leffa" ? "leffa" : "mock",
    leffaSpace: env.LEFFA_SPACE ?? "franciszzj/Leffa",
    leffaModelType: env.LEFFA_MODEL_TYPE === "dress_code" ? "dress_code" : "viton_hd",
    leffaSteps: Number(env.LEFFA_STEPS ?? 30) || 30,
    hfToken: env.HF_TOKEN ?? "",
    maxImageBytes: 10 * 1024 * 1024,
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  };
}
