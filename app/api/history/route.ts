import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT created_at, party_id, total, vote_share FROM state_history ORDER BY created_at ASC, party_id ASC",
    )
    .all() as Array<{ created_at: number; party_id: string; total: number; vote_share: number }>;

  // Group by created_at into snapshots
  const snapshotMap = new Map<number, Record<string, { total: number; voteShare: number }>>();
  for (const r of rows) {
    if (!snapshotMap.has(r.created_at)) snapshotMap.set(r.created_at, {});
    snapshotMap.get(r.created_at)![r.party_id] = {
      total: r.total,
      voteShare: r.vote_share,
    };
  }

  const snapshots = Array.from(snapshotMap.entries()).map(([t, parties]) => ({
    t,
    parties,
  }));

  return NextResponse.json({ snapshots });
}
