import { NextResponse } from "next/server";
import { listSlots, listPresets } from "@/lib/broadcast-slots";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public read endpoint — the OBS browser source (live tab) needs this
 * with no admin auth, but slots are SCOPED PER TENANT, so we read the
 * signed session cookie to figure out which channel's mixer to return.
 * Falls back to the default tenant when no session is present
 * (e.g. local dev without login).
 */
export async function GET(req: Request) {
  const tenantId = await resolveTenant(req);
  return NextResponse.json({
    tenantId,
    slots: listSlots(tenantId),
    presets: listPresets(tenantId),
  });
}
