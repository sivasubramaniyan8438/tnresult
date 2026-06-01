import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  checkTenantPassword,
  signTenantSession,
  sessionCookieOptions,
} from "@/lib/session";
import { isValidTenantId } from "@/lib/tenants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { tenant?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tenant = (body.tenant ?? "").trim();
  const password = (body.password ?? "").trim();
  if (!isValidTenantId(tenant)) {
    return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }
  if (!checkTenantPassword(tenant, password)) {
    return NextResponse.json(
      { error: "Wrong channel or password" },
      { status: 401 },
    );
  }
  const cookieValue = await signTenantSession(tenant);
  const opts = sessionCookieOptions();
  const store = await cookies();
  store.set({ ...opts, value: cookieValue });
  return NextResponse.json({ ok: true, tenant });
}
