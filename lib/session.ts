/**
 * Cookie-session helpers for tenant login.
 *
 * Cookie format: `<tenantId>.<base64url(HMAC-SHA256(tenantId))>`
 * Signed with `SESSION_SECRET` (env var) so editing the cookie to switch
 * tenants is detected. Falls back to a hard-coded dev secret locally; in
 * production set SESSION_SECRET to a long random string.
 *
 * Uses Web Crypto so this works in BOTH the Edge runtime (middleware) and
 * the Node runtime (API routes / server components).
 */
import { isValidTenantId } from "./tenants";

const SESSION_COOKIE = "tenant-session";
const DEV_FALLBACK_SECRET =
  "naadhas-dev-secret-change-in-prod-via-SESSION_SECRET-env-2026";

const enc = new TextEncoder();

function getSecret(): string {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SECRET;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToB64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const padded =
    s.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((s.length + 3) % 4);
  const raw = atob(padded);
  // Allocate over a plain ArrayBuffer (not SharedArrayBuffer) so that
  // crypto.subtle.verify accepts this as BufferSource under the strict
  // TS lib.dom.d.ts in Next.js 16 / lib es2024.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function signTenantSession(tenantId: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(tenantId));
  return `${tenantId}.${bytesToB64Url(sig)}`;
}

export async function verifyTenantSession(
  value: string | undefined | null,
): Promise<string | null> {
  if (!value) return null;
  const dotIdx = value.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const tenantId = value.slice(0, dotIdx);
  if (!isValidTenantId(tenantId)) return null;
  const sigB64 = value.slice(dotIdx + 1);
  try {
    const key = await getKey();
    const sigBytes = b64UrlToBytes(sigB64);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(tenantId),
    );
    return ok ? tenantId : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/** Cookie options for `next.cookies().set(...)`. Secure flag is set in
 *  production by default (browsers reject Secure cookies over plain HTTP),
 *  so any deployment behind HTTP only — e.g. an EC2 box without an ALB /
 *  Cloudflare cert — needs to opt out by setting INSECURE_COOKIES=1.
 *  Don't ship that flag to a real production environment with real users. */
export function sessionCookieOptions(maxAgeSec = 60 * 60 * 24 * 7) {
  const secure =
    process.env.NODE_ENV === "production" &&
    process.env.INSECURE_COOKIES !== "1";
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSec,
  };
}

/**
 * Server-side password check. Reads per-tenant env var first, then falls back
 * to a dev default so local dev works out of the box.
 *
 * Env var name pattern: `AUTH_<ID_UPPER>_PASSWORD`. Example: `AUTH_NAADHAS_PASSWORD=...`
 */
export function checkTenantPassword(
  tenantId: string,
  password: string,
): boolean {
  if (!isValidTenantId(tenantId)) return false;
  const envName = `AUTH_${tenantId.toUpperCase()}_PASSWORD`;
  const expected = process.env[envName] ?? DEV_PASSWORD_FALLBACKS[tenantId];
  if (!expected) return false;
  // Constant-time compare to avoid trivial timing attacks
  return constantTimeEqual(expected, password);
}

const DEV_PASSWORD_FALLBACKS: Record<string, string> = {
  naadhas: "naadhas-dev-2026",
  aadhan: "aadhan-dev-2026",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
