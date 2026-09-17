# FitWeather Web (Next.js)

> Know what to wear, every day.

## Run locally

```bash
# from the repo root
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase URL + publishable key
npm run web                                    # http://localhost:3000
```

Before the first run, apply the database schema to your Supabase project and start the FastAPI backend — see the root README. For a no-setup look, put `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` and run the backend with `DEMO_MODE=true`.

## Scripts

| Command | What it does |
|---|---|
| `npm run web` | `next dev` |
| `npm run build --workspace apps/web` | production build |
| `npm run typecheck --workspace apps/web` | `tsc --noEmit` (run `npx next typegen` first on a fresh checkout) |
| `npm run lint --workspace apps/web` | ESLint (Next + React hooks rules) |

## Structure

```
src/
  app/
    page.tsx                 landing (signed-out)
    (auth)/                  login, signup, forgot/reset password + server actions
    auth/callback, signout   route handlers
    onboarding/              5-step profile wizard + server actions
    (app)/                   protected shell: home, today, wardrobe (+ new, [id]), avatar, try-on, outfits, history, profile
    (app)/actions.ts         server actions wrapping every backend call (token never reaches the browser)
  components/
    ui/                      shadcn primitives (touch-sized)
    layout/                  app shell, sidebar + bottom nav, user menu
    wardrobe/                item tile, grid + filters, upload flow (photo → AI → edit → save), editor
    outfit/                  occasion picker, outfit card (score ring, reasons, feedback), recommendation view
    weather/                 weather card
    avatar/                  R3F body (MakeHuman CC0 mesh, morphed), viewer (rotate/zoom/reset), body photo slots
    tryon/                   Clueless-style closet (◀ ▶ per slot, live MATCH / MIS-MATCH), photo try-on
    auth/ onboarding/ profile/ shared/
  lib/
    supabase/                browser, server and proxy clients
    api.ts                   typed FastAPI client (server-side, forwards the user JWT, demo-aware)
    storage.ts               browser upload to private buckets (paths are <user_id>/<uuid>)
    env.ts demo.ts           public env access, demo mode
    constants/               fashion vocab, slots, weather codes, navigation
    validation/              zod schemas
  services/                  server-only access: profile (Supabase), wardrobe/weather/recommendation/body/tryon (API)
  types/                     database.ts (Supabase rows), api-models.ts (backend responses)
  proxy.ts                   session refresh + route protection (Next 16)
```

## Body model assets

`public/body/` holds the MakeHuman base mesh and macro morph targets (CC0) as compact binaries (~1.2 MB).
Regenerate with `python scripts/build-body-model.py` (downloads from GitHub, or pass `--source <dir>`).

## Design tokens

Light theme only. Warm off-white ground, white cards, near-black ink, and a single muted clay accent (`--brand`). Tokens live in `src/app/globals.css`.
