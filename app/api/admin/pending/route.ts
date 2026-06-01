import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  constituency_id: number;
  name: string;
  district: string;
  status: string;
  round: number;
  total_rounds: number;
  updated_at: number;
  last_actor: string | null;
  last_source: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minutes = parseInt(url.searchParams.get("staleMinutes") ?? "10", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 234);
  const cutoff = Date.now() - minutes * 60_000;

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cs.constituency_id, c.name, c.district,
              cs.status, cs.round, cs.total_rounds, cs.updated_at,
              cs.last_actor, cs.last_source
         FROM constituency_state cs
         JOIN constituencies c ON c.id = cs.constituency_id
        WHERE cs.status NOT IN ('won')
          AND (cs.updated_at = 0 OR cs.updated_at < ?)
        ORDER BY cs.updated_at ASC
        LIMIT ?`,
    )
    .all(cutoff, limit) as Row[];

  const recentlyTouched = db
    .prepare(
      `SELECT cs.constituency_id, c.name, c.district,
              cs.status, cs.round, cs.total_rounds, cs.updated_at,
              cs.last_actor, cs.last_source
         FROM constituency_state cs
         JOIN constituencies c ON c.id = cs.constituency_id
        WHERE cs.updated_at >= ?
        ORDER BY cs.updated_at DESC
        LIMIT 20`,
    )
    .all(cutoff) as Row[];

  return NextResponse.json({
    ok: true,
    staleMinutes: minutes,
    pending: rows,
    recentlyTouched,
    serverTime: Date.now(),
  });
}
