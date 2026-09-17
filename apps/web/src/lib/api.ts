import { isDemoMode } from "@/lib/demo";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ApiError, ApiResponse } from "@/types/api";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }

  /** True when the FastAPI server itself could not be reached. */
  get unreachable(): boolean {
    return this.code === "backend_unreachable";
  }
}

export const BACKEND_UNREACHABLE_MESSAGE =
  "The API server is not running. Start it with `uvicorn app.main:app --reload --port 8000` in backend/.";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Multipart uploads pass a FormData; JSON is used otherwise. */
  formData?: FormData;
  signal?: AbortSignal;
  /** Milliseconds before giving up (AI calls can be slow). */
  timeoutMs?: number;
};

/**
 * Server-side client for the FastAPI backend.
 *
 * Attaches the current user's Supabase access token so the backend can verify
 * identity. Only call this from Server Components / Server Actions / Route
 * Handlers — never from the browser (the backend URL may be internal).
 * In demo mode no token is sent; the backend's DEMO_MODE accepts that.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (!isDemoMode) {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  options.signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new ApiClientError(0, {
      code: timedOut ? "backend_timeout" : "backend_unreachable",
      message: timedOut ? "The API took too long to respond." : BACKEND_UNREACHABLE_MESSAGE,
    });
  } finally {
    clearTimeout(timer);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON body (e.g. gateway error) — handled below.
  }

  if (!payload) {
    throw new ApiClientError(response.status, {
      code: "invalid_response",
      message: `Backend returned ${response.status} without a JSON body`,
    });
  }

  if (!payload.success) {
    throw new ApiClientError(response.status, payload.error);
  }

  return payload.data;
}

/** Normalises any thrown value into a user-facing message. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
