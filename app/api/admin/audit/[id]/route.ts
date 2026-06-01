import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditRow = {
  id: number;
  created_at: number;
  constituency_id: number;
  candidate_id: number;
  candidate_name: string;
  party_id: string;
  round: number;
  votes_before: number;
  votes_after: number;
  delta: number;
  status_before: string | null;
  status_after: string | null;
  actor: string;
  source: string;
  ip: string | null;
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const acId = parseInt(id, 10);
  if (!Number.isFinite(acId))
    return NextResponse.json({ error: "bad id" }, { status: 400 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 1000);

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, a.created_at, a.constituency_id, a.candidate_id,
              c.name AS candidate_name, c.party_id,
              a.round, a.votes_before, a.votes_after, a.delta,
              a.status_before, a.status_after, a.actor, a.source, a.ip
         FROM vote_audit a
         JOIN candidates c ON c.id = a.candidate_id
        WHERE a.constituency_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?`,
    )
    .all(acId, limit) as AuditRow[];

  return NextResponse.json({ ok: true, rows });
}
