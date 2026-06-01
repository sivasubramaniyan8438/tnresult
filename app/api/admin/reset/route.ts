import { NextResponse } from "next/server";
import { resetConstituency } from "@/lib/writer";
import { checkAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Emergency reset for a single AC. Wipes round/votes/state back to pending
 * and clears any manual lock so the scraper can take over again. Audit log
 * is preserved (the reset itself is logged with source='reset').
 *
 * Body: { constituencyId: number, confirm: "RESET" }
 */
export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const id = Number(body.constituencyId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "constituencyId required" }, { status: 400 });
  }
  if (body.confirm !== "RESET") {
    return NextResponse.json(
      { error: "Pass confirm: 'RESET' to acknowledge wipe" },
      { status: 400 },
    );
  }

  resetConstituency(id, auth.actor, auth.ip);
  return NextResponse.json({ ok: true, constituencyId: id });
}
