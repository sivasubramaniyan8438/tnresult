import { NextResponse } from "next/server";
import { applyRoundUpdate } from "@/lib/writer";
import { checkAdmin } from "@/lib/auth";
import { validateUpdate } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (
    !body.constituencyId ||
    !Array.isArray(body.candidates) ||
    body.candidates.length === 0
  ) {
    return NextResponse.json(
      { error: "constituencyId + non-empty candidates required" },
      { status: 400 },
    );
  }

  const round = Number(body.round) || 0;
  const warnings = validateUpdate(body.constituencyId, round, body.candidates);

  // Honor `?dryRun=1` — return validation only, do NOT mutate
  const url = new URL(req.url);
  if (url.searchParams.get("dryRun") === "1" || body.dryRun === true) {
    return NextResponse.json({ ok: true, warnings, applied: false });
  }

  const result = applyRoundUpdate({
    constituencyId: body.constituencyId,
    round,
    totalRounds: body.totalRounds,
    status: body.status,
    candidates: body.candidates,
    actor: auth.actor,
    source: "manual",
    ip: auth.ip,
  });

  if (!result.applied) {
    return NextResponse.json(
      { ok: false, applied: false, reason: result.reason, warnings },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, applied: true, warnings });
}
