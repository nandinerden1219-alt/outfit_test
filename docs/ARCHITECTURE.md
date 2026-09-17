# Outfit AI — Architecture

> Upload → organise → today's looks → swipe → see it on you → swap → save. All on 2D photos, all on Cloudflare.

## 1. System overview

```
┌──────────────────────────────┐        ┌──────────────────────────────────────┐
│  apps/web  (Next.js 16)      │        │  apps/api  (Cloudflare Worker, Hono)  │
│  ─ Workers via OpenNext      │  JWT   │  ─ /me /wardrobe /outfits /try-on     │
│  ─ Supabase SSR auth         │ ─────▶ │    /body /uploads /files /weather     │
│  ─ server actions → apiFetch │        │  ─ D1 repos · R2 storage · Queue jobs │
│  ─ swipe deck, job polling   │        │  ─ providers behind interfaces        │
└──────────────────────────────┘        └───────┬──────────┬──────────┬────────┘
                                                │          │          │
                                          D1 (SQLite)   R2 (3 private   Queue
                                                          buckets)    outfit-tryon
                                                │
                       ┌────────────────────────┼─────────────────────────┐
                       ▼                        ▼                         ▼
                  Gemini API             remove.bg API             Leffa (HF Space,
             analysis + naming        background removal          Gradio HTTP API)
```

| Concern | Where | Why |
|---|---|---|
| Identity | Supabase Auth in the web app; the Worker verifies the JWT (JWKS or legacy HS256) with `jose` | Cookies stay HTTP-only; the Worker never trusts a user id from a body. First authenticated request creates the `users` row in D1. |
| Data | D1 through repository interfaces (`apps/api/src/db`) | `d1.ts` for production, `memory.ts` for demo mode and tests — same interface. |
| Images | R2 through `Storage` (`apps/api/src/storage`) | Buckets are private. Links are `GET /files/<bucket>/<key>?exp=&sig=` signed with HMAC-SHA256 (`FILE_URL_SECRET`), 1 h TTL, served by the Worker. |
| Long work | Cloudflare Queue `outfit-tryon` | A try-on takes 20–60 s; the queue consumer (same Worker, `queue()` export) runs it. Without the binding (local dev) it runs in `waitUntil`. |
| Web on Cloudflare | OpenNext (`apps/web/open-next.config.ts`, `wrangler.toml`) | Cloudflare's supported path for Next.js 15/16 (Workers + static assets); `@cloudflare/next-on-pages` is deprecated. |

## 2. Repository layout (Nx)

```
apps/web/                 Next.js app · Jest (next/jest, jsdom)
apps/api/                 Worker · migrations/0001_init.sql · wrangler.toml · Jest (ESM)
  src/index.ts            Hono app, routes, queue consumer
  src/auth.ts             Supabase JWT verification
  src/db/                 repositories.ts (interfaces) · d1.ts · memory.ts
  src/storage/storage.ts  R2Storage · MemoryStorage · UrlSigner
  src/services/           container.ts (wiring) · wardrobe · outfits · tryon · providers
packages/engine/          pure TS: taxonomy, rules, weather context, engine, analysis vocab, naming · Jest
packages/shared/          API contract types
nx.json                   cached targets: build · build:cf · test · typecheck · lint
```

`nx run-many -t test` runs the three Jest projects; `nx graph` shows web → shared, api → engine → shared.

## 3. Pipelines

### Wardrobe ingest — `POST /wardrobe/ingest`

```
original photo ──▶ R2 wardrobe/<user>/<uuid>.<ext>
      ▼  BackgroundRemover (remove.bg | none)      → R2 …-cutout.png, background_removed
      ▼  ClothingAnalyzer (Gemini, one call)        → null for anything uncertain
      ▼  engineFields()  (packages/engine/analysis) → warmth / formality / occasions, deterministic
wardrobe_items row   (needs_review when confidence is low or analysis unavailable)
```

The browser runs batches with `CONCURRENCY = 5`; one failure never fails the batch. One image = one analysis, ever.

### Outfit generation — `POST /outfits/generate`

```
available wardrobe + { occasion, temperature_c, weather, style, count, exclude }
   ↓ manualSnapshot → buildContext (bands, wind, rain, snow, layering)
   ↓ rankCandidates: weather / season / occasion / compatibility filters → candidates → scoring
   ↓ diversify (≥ 2 pieces different) → count (3–12)
   ↓ names: one optional Gemini call over candidate IDs, else deterministic; descriptiveReasons
outfits + outfit_items rows
```

The engine is pure and lives in `packages/engine`; the LLM never chooses items and nothing is called "best". `exclude` lets the swipe deck ask for looks it has not shown.

### Virtual try-on jobs — `POST /try-on/jobs` → queue → `GET /try-on/jobs/{id}`

```
queued → processing (Preparing your outfit… → AI is dressing you… → Generating image…) → completed | failed
```

* `cache_key = sha256(person_image_path + sorted item ids)`: identical requests return the existing job; swapping a piece changes the key and only the try-on runs again. `POST /try-on/cached` looks up many outfits at once (deck, saved list).
* `planGarments`: a dress alone, otherwise upper then lower; shoes/bags/accessories are reported as `skipped`.
* Leffa is called over Gradio's HTTP API (`/gradio_api/upload` → `/call/leffa_predict_vt` → SSE result); every exit path is terminal and user-safe.

## 4. Data model (D1)

`users`, `profiles` (JSON columns for string arrays), `wardrobe_items` (7-category taxonomy, original/processed paths, AI fields), `weather_logs` (cached snapshots), `outfits` + `outfit_items`, `body_profiles` (photo paths), `try_on_jobs`. See `apps/api/migrations/0001_init.sql`. All rows carry `user_id`; every query is scoped by the verified subject.

## 5. Provider interfaces (`apps/api/src/services/providers.ts`)

| Interface | Implementations | Selected by |
|---|---|---|
| `JsonModel` / `ClothingAnalyzer` | `GeminiClient` (REST, structured JSON) / `GeminiClothingAnalyzer` | `GEMINI_API_KEY` |
| `BackgroundRemover` | `RemoveBgBackgroundRemover` · `NoopBackgroundRemover` | `BACKGROUND_REMOVAL` |
| `VirtualTryOnService` | `LeffaSpaceVirtualTryOnService` · `MockVirtualTryOnService` | `TRYON_PROVIDER` |
| `WeatherProvider` | `OpenMeteoProvider` | — |

Tests inject fakes through `createApp(overrides)`; demo mode swaps in memory repositories + storage.

## 6. Frontend routes

`/` landing · `/login` `/signup` `/forgot-password` `/reset-password` `/auth/callback` · `/onboarding` (photo first) · `/home` (Today deck) · `/wardrobe`, `/wardrobe/add`, `/wardrobe/[id]` · `/outfits` (feed) · `/try-on` · `/saved-outfits` · `/profile`.

Navigation: desktop sidebar Today · Wardrobe · Outfits · Try-On · Saved · Profile; mobile bottom bar Today · Wardrobe · Saved · Try-On · Profile.

## 7. Configuration

Worker vars live in `apps/api/wrangler.toml` `[vars]`; secrets via `wrangler secret put` (`FILE_URL_SECRET`, `SUPABASE_URL`/`SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`, `HF_TOKEN`, `REMOVE_BG_API_KEY`). Local dev reads `apps/api/.dev.vars` (git-ignored). The web app needs only `NEXT_PUBLIC_*` values (`apps/web/.env.example`, `apps/web/wrangler.toml`).

## 8. Third-party models & licensing (checked 2026-09; re-verify before launch)

| Component | Candidate | License | Commercial OK? | Decision |
|---|---|---|---|---|
| Background removal | remove.bg | Commercial API | ✅ | `BACKGROUND_REMOVAL=removebg` (rembg is not available on Workers) |
| Clothing analysis / naming | Gemini API | Google API ToS (paid tier) | ✅ | Use |
| Weather | Open-Meteo | Free non-commercial; commercial plan otherwise | ⚠️ | Pre-fills conditions only; license or swap before launch |
| Virtual try-on (open) | **Leffa** | Code + weights MIT; DensePose weights CC BY-NC 4.0; research-only training data | ⚠️ legal review | `TRYON_PROVIDER=leffa` via the public HF Space for development; self-host or license for production |
| Virtual try-on (hosted) | Google Vertex AI Virtual Try-On, FASHN | Commercial API terms | ✅ | Slot in behind `VirtualTryOnService` |

## 9. Security checklist

* Secrets exist only as Worker secrets / `.dev.vars`; the browser gets `NEXT_PUBLIC_*` only.
* JWT verified on every request; user id always from the token; object paths forced to `<user_id>/…`.
* Uploads: MIME + size + non-empty checks; R2 private; links HMAC-signed and time-limited.
* Job responses expose status, step, progress, URLs and applied/skipped labels — never cache keys, provider names, parameters or raw errors.

## 10. Remaining production work

Supabase Auth end-to-end with real accounts against a deployed Worker, licensed try-on provider (or self-hosted Leffa), rate limiting on ingest / try-on, R2 lifecycle rules for old try-on results, and OpenNext incremental cache (R2) if pages start using ISR.
