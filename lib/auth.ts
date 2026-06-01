/**
 * Auth for admin/agent API endpoints. Two paths in:
 *
 *   1. Bearer ADMIN_TOKEN — for off-broadcast scripts (the ECI scraper on
 *      the DigitalOcean droplet, ad-hoc agents, ops curl).
 *   2. Tenant session cookie — for browser users who already signed in via
 *      /login. The data-entry team driving the simulator + manual updates
 *      from the /admin UI sit here. They never see the token.
 *
 * If ADMIN_TOKEN is unset (e.g. local dev), auth is open — same legacy
 * behaviour as before.
 *
 * Audit log still records the x-actor header verbatim so wrong entries
 * stay traceable regardless of how the request authenticated.
 */
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifyTenantSession,
} from "./session";
import { DEFAULT_TENANT_ID } from "./tenants";

export type AuthCheck =
  | { ok: true; actor: string; ip: string; tenantId: string }
  | { ok: false; response: NextResponse };

/**
 * Read the signed tenant session cookie (if any) and return the verified
 * tenant id. Returns null when no session cookie is present or when the
 * signature doesn't validate. Used by anonymous read endpoints (the live
 * OBS tab) to scope responses without forcing them through admin auth.
 */
export async function getTenantFromRequest(req: Request): Promise<string | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(
    new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`),
  );
  if (!m) return null;
  const tenantId = await verifyTenantSession(decodeURIComponent(m[1]));
  return tenantId;
}

/**
 * Like getTenantFromRequest but never returns null — falls back to the
 * default tenant when no session is present (open dev mode).
 */
export async function resolveTenant(req: Request): Promise<string> {
  return (await getTenantFromRequest(req)) ?? DEFAULT_TENANT_ID;
}

export async function checkAdmin(req: Request): Promise<AuthCheck> {
  const expected = process.env.ADMIN_TOKEN;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const actor = req.headers.get("x-actor")?.slice(0, 64) || "anonymous";

  // Resolve tenant from cookie regardless of which auth path matched —
  // tenant-scoped resources (slot mixer) need it for both Bearer scripts
  // and browser sessions. Bearer scripts can target a specific tenant via
  // x-tenant header; otherwise default tenant.
  const cookieTenant = await getTenantFromRequest(req);
  const headerTenant = req.headers.get("x-tenant");

  // Open auth — local dev / pre-token mode.
  if (!expected) {
    return {
      ok: true,
      actor,
      ip,
      tenantId: cookieTenant ?? headerTenant ?? DEFAULT_TENANT_ID,
    };
  }

  // Path 1 — Bearer ADMIN_TOKEN (scripts).
  const auth = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/.exec(auth);
  if (match && match[1] === expected) {
    return {
      ok: true,
      actor,
      ip,
      tenantId: headerTenant ?? cookieTenant ?? DEFAULT_TENANT_ID,
    };
  }

  // Path 2 — signed tenant session cookie (browser user already logged in).
  if (cookieTenant) {
    const tagged = actor === "anonymous" ? `tenant:${cookieTenant}` : actor;
    return { ok: true, actor: tagged, ip, tenantId: cookieTenant };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

export function isAuthConfigured(): boolean {
  return !!process.env.ADMIN_TOKEN;
}
