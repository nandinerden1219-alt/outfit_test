/**
 * Image storage behind one small interface.
 *   R2Storage     — private R2 buckets; URLs are time-limited HMAC links served by GET /files/…
 *   MemoryStorage — DEMO_MODE / tests: bytes kept in the isolate, same URL scheme.
 */

import { AppError, notFound } from "../errors";

export type Bucket = "wardrobe" | "body-photos" | "try-on";
export const BUCKETS: readonly Bucket[] = ["wardrobe", "body-photos", "try-on"];
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type StoredBytes = { data: ArrayBuffer; contentType: string };

export interface Storage {
  download(bucket: Bucket, path: string): Promise<StoredBytes>;
  upload(bucket: Bucket, path: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<void>;
  delete(bucket: Bucket, path: string): Promise<void>;
  /** Time-limited URL the browser can load; null when the object cannot be linked. */
  signedUrl(bucket: Bucket, path: string): Promise<string | null>;
  /** Checks the signature on a /files/… link. */
  verifyUrl(bucket: Bucket, path: string, exp: string | undefined, sig: string | undefined): Promise<boolean>;
}

export function assertBucket(bucket: string): asserts bucket is Bucket {
  if (!(BUCKETS as readonly string[]).includes(bucket)) throw notFound("Unknown bucket.");
}

// ---------------------------------------------------------------- signing

const enc = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class UrlSigner {
  constructor(
    private baseUrl: string,
    private secret: string,
  ) {}

  async sign(bucket: Bucket, path: string, ttl = SIGNED_URL_TTL_SECONDS): Promise<string | null> {
    if (!this.secret) return null;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = await hmac(this.secret, `${bucket}/${path}:${exp}`);
    return `${this.baseUrl}/files/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}?exp=${exp}&sig=${sig}`;
  }

  async verify(bucket: Bucket, path: string, exp: string | undefined, sig: string | undefined): Promise<boolean> {
    if (!this.secret || !exp || !sig) return false;
    const expires = Number(exp);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
    const expected = await hmac(this.secret, `${bucket}/${path}:${expires}`);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  }
}

// ---------------------------------------------------------------- R2

export class R2Storage implements Storage {
  constructor(
    private buckets: Record<Bucket, R2Bucket>,
    private signer: UrlSigner,
  ) {}

  async download(bucket: Bucket, path: string): Promise<StoredBytes> {
    const obj = await this.buckets[bucket].get(path);
    if (!obj) throw new AppError("storage_error", "The file could not be found.", 502);
    return { data: await obj.arrayBuffer(), contentType: obj.httpMetadata?.contentType ?? "application/octet-stream" };
  }
  async upload(bucket: Bucket, path: string, data: ArrayBuffer | Uint8Array, contentType: string) {
    await this.buckets[bucket].put(path, data, { httpMetadata: { contentType } });
  }
  async delete(bucket: Bucket, path: string) {
    await this.buckets[bucket].delete(path);
  }
  signedUrl(bucket: Bucket, path: string) {
    return this.signer.sign(bucket, path);
  }
  verifyUrl(bucket: Bucket, path: string, exp: string | undefined, sig: string | undefined) {
    return this.signer.verify(bucket, path, exp, sig);
  }
}

// ---------------------------------------------------------------- memory

export class MemoryStorage implements Storage {
  private objects = new Map<string, StoredBytes>();
  constructor(private signer: UrlSigner) {}

  get(bucket: Bucket, path: string): StoredBytes | null {
    return this.objects.get(`${bucket}/${path}`) ?? null;
  }
  async download(bucket: Bucket, path: string): Promise<StoredBytes> {
    const obj = this.get(bucket, path);
    if (!obj) throw new AppError("storage_error", "The file could not be found.", 502);
    return obj;
  }
  async upload(bucket: Bucket, path: string, data: ArrayBuffer | Uint8Array, contentType: string) {
    const buf = data instanceof Uint8Array ? data.slice().buffer : data.slice(0);
    this.objects.set(`${bucket}/${path}`, { data: buf as ArrayBuffer, contentType });
  }
  async delete(bucket: Bucket, path: string) {
    this.objects.delete(`${bucket}/${path}`);
  }
  /** Demo parity with private buckets: no object, no link (the UI shows a swatch). */
  async signedUrl(bucket: Bucket, path: string) {
    return this.get(bucket, path) ? this.signer.sign(bucket, path) : null;
  }
  verifyUrl(bucket: Bucket, path: string, exp: string | undefined, sig: string | undefined) {
    return this.signer.verify(bucket, path, exp, sig);
  }
}

export const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const mimeForPath = (path: string) => (path.toLowerCase().endsWith(".png") ? "image/png" : path.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg");
