import { NextResponse } from "next/server";
import { applyRoundUpdate } from "@/lib/writer";
import { checkAdmin } from "@/lib/auth";
import { validateUpdate } from "@/lib/validation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkRow = {
  constituencyId: number;
  round: number;
  status?: "pending" | "counting" | "leading" | "won";
  totalRounds?: number;
  candidates: Array<{ candidateId?: number; partyId?: string; votes: number }>;
};

/**
 * Resolve a row's candidate IDs. Caller may supply candidateId directly OR
 * partyId, in which case we look up the candidate for that AC.
 */
function resolveRow(row: BulkRow): {
  ok: boolean;
  resolved: Array<{ candidateId: number; votes: number }>;
  error?: string;
} {
  const db = getDb();
  const cands = db
    .prepare("SELECT id, party_id FROM candidates WHERE constituency_id = ?")
    .all(row.constituencyId) as Array<{ id: number; party_id: string }>;

  if (!cands.length) {
    return { ok: false, resolved: [], error: `AC#${row.constituencyId} has no candidates` };
  }

  const byParty = new Map<string, number>();
  for (const c of cands) byParty.set(c.party_id, c.id);

  const resolved: Array<{ candidateId: number; votes: number }> = [];
  for (const c of row.candidates) {
    if (Number.isFinite(c.candidateId)) {
      resolved.push({ candidateId: c.candidateId as number, votes: c.votes });
    } else if (c.partyId) {
      const id = byParty.get(c.partyId.toUpperCase());
      if (!id)
        return {
          ok: false,
          resolved: [],
          error: `AC#${row.constituencyId}: no ${c.partyId} candidate`,
        };
      resolved.push({ candidateId: id, votes: c.votes });
    } else {
      return {
        ok: false,
        resolved: [],
        error: "candidate row needs candidateId or partyId",
      };
    }
  }
  return { ok: true, resolved };
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const results: Array<{
    constituencyId: number;
    round: number;
    ok: boolean;
    error?: string;
    warnings?: ReturnType<typeof validateUpdate>;
  }> = [];

  for (const row of body.rows as BulkRow[]) {
    if (!row.constituencyId || !Number.isFinite(row.round)) {
      results.push({
        constituencyId: row.constituencyId ?? 0,
        round: row.round ?? 0,
        ok: false,
        error: "constituencyId + round required",
      });
      continue;
    }

    const r = resolveRow(row);
    if (!r.ok) {
      results.push({
        constituencyId: row.constituencyId,
        round: row.round,
        ok: false,
        error: r.error,
      });
      continue;
    }

    const warnings = validateUpdate(row.constituencyId, row.round, r.resolved);
    let applyResult: { applied: boolean; reason?: string } = { applied: false };
    if (!dryRun) {
      applyResult = applyRoundUpdate({
        constituencyId: row.constituencyId,
        round: row.round,
        totalRounds: row.totalRounds,
        status: row.status,
        candidates: r.resolved,
        actor: auth.actor,
        source: "bulk",
        ip: auth.ip,
      });
    }
    results.push({
      constituencyId: row.constituencyId,
      round: row.round,
      ok: dryRun ? true : applyResult.applied,
      error: !applyResult.applied && !dryRun ? applyResult.reason : undefined,
      warnings: warnings.length ? warnings : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    applied: !dryRun,
    rowCount: results.length,
    results,
  });
}
