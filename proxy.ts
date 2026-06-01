import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifyTenantSession,
} from "@/lib/session";

/**
 * Next.js 16 auth proxy (was called `middleware` pre-16; renamed to `proxy`
 * to clarify its role as a network-edge router. Runs on Node runtime —
 * Edge runtime is NOT supported in `proxy`).
 *
 * Redirects unauthenticated browser traffic to /login, preserving the
 * original URL as `?next=`. Pages that should always be accessible — /login
 * itself, public assets, API routes (which carry their own auth) — are
 * excluded via the `matcher` config below.
 */
export async function proxy(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const tenant = await verifyTenantSession(cookie);
  if (tenant) return NextResponse.next();

  const url = req.nextUrl.clone();
  const next = url.pathname + (url.search || "");
  const loginUrl = new URL("/login", req.url);
  if (next && next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

/**
 * What the proxy protects:
 *   - All app pages EXCEPT /login, /api/*, /_next/*, /tenants/*, /leaders/*,
 *     /favicon.ico, and other static assets.
 *
 * Why /api/* is excluded: API endpoints have their own per-route auth
 * (checkAdmin / etc.). The session cookie is for browser sessions only.
 */
export const config = {
  matcher: [
    "/((?!api/|_next/|tenants/|leaders/|login|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
