/**
 * Supabase JWT verification. The web app forwards the user's access token as
 * `Authorization: Bearer <jwt>`; we verify it locally (JWKS for ES256/RS256, the
 * legacy secret for HS256) and never trust a user id from a request body.
 */

import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, type JWTPayload } from "jose";

import { DEMO_USER_ID } from "./db/memory";
import type { Settings } from "./env";
import { notConfigured, unauthorized } from "./errors";

export type CurrentUser = { id: string; email: string | null; role: string; displayName: string | null };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(url: string) {
  let set = jwksCache.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, set);
  }
  return set;
}

function toUser(payload: JWTPayload): CurrentUser {
  const sub = payload.sub;
  if (!sub) throw unauthorized("Token has no subject.");
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : "authenticated",
    displayName: typeof meta.display_name === "string" ? meta.display_name : typeof meta.full_name === "string" ? meta.full_name : null,
  };
}

export async function verifySupabaseJwt(token: string, settings: Settings): Promise<CurrentUser> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw unauthorized("Malformed token.");
  }
  try {
    if (alg === "HS256") {
      if (!settings.supabaseJwtSecret) throw notConfigured("SUPABASE_JWT_SECRET is required to verify HS256 tokens.");
      const { payload } = await jwtVerify(token, new TextEncoder().encode(settings.supabaseJwtSecret), { audience: settings.supabaseJwtAudience, algorithms: ["HS256"] });
      return toUser(payload);
    }
    if (alg === "ES256" || alg === "RS256") {
      if (!settings.supabaseUrl) throw notConfigured("SUPABASE_URL is required to fetch the JWKS for token verification.");
      const { payload } = await jwtVerify(token, jwks(`${settings.supabaseUrl}/auth/v1/.well-known/jwks.json`), { audience: settings.supabaseJwtAudience, algorithms: ["ES256", "RS256"] });
      return toUser(payload);
    }
    throw unauthorized(`Unsupported token algorithm: ${alg}.`);
  } catch (e) {
    if (e instanceof Error && e.name === "AppError") throw e;
    const code = (e as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED") throw unauthorized("Session expired. Please sign in again.");
    throw unauthorized("Invalid token.");
  }
}

export async function currentUserFromHeader(authorization: string | undefined, settings: Settings): Promise<CurrentUser> {
  if (settings.demoMode) {
    // DEMO MODE: every request acts as the sample user. Never enable in production.
    return { id: DEMO_USER_ID, email: "demo@outfit.app", role: "demo", displayName: "Demo User" };
  }
  const [scheme, token] = (authorization ?? "").split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") throw unauthorized();
  return verifySupabaseJwt(token, settings);
}
