import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import {
  listOtherStates,
  upsertOtherState,
  deleteOtherState,
  type OtherState,
} from "@/lib/states";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin endpoints for non-TN states.
 *
 *   GET    → list (same as /api/states; here mirrored for the admin page)
 *   POST   → upsert one state. Body: full OtherState shape (see lib/states.ts)
 *   DELETE → ?id=KL  remove a state
 */
export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ states: listOtherStates() });
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as Partial<OtherState> | null;
  if (!body || !body.id || !body.name || !Number.isFinite(body.totalSeats)) {
    return NextResponse.json(
      { error: "id, name, totalSeats required" },
      { status: 400 },
    );
  }
  const parties = Array.isArray(body.parties) ? body.parties : [];
  for (const p of parties) {
    if (typeof p.partyId !== "string" || typeof p.label !== "string") {
      return NextResponse.json(
        { error: "each party row needs partyId + label" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(p.total)) p.total = 0;
    if (!Number.isFinite(p.delta)) p.delta = 0;
  }

  upsertOtherState({
    id: body.id.toUpperCase(),
    name: body.name,
    totalSeats: Math.max(1, Number(body.totalSeats)),
    reportingSeats: Math.max(0, Number(body.reportingSeats ?? 0)),
    parties,
    sequence: Number(body.sequence ?? 99),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  deleteOtherState(id.toUpperCase());
  return NextResponse.json({ ok: true });
}
