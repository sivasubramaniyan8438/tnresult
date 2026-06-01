import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/candidates/search?q=stalin&limit=20
 * Fuzzy-ish substring match across candidate name + AC name + party id.
 * Used by the admin VIP-add typeahead.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);

  if (!q) return NextResponse.json({ ok: true, results: [] });

  const db = getDb();
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.party_id,
              con.id AS constituency_id, con.name AS constituency_name, con.district
         FROM candidates c
         JOIN constituencies con ON con.id = c.constituency_id
        WHERE c.name LIKE ? COLLATE NOCASE
           OR con.name LIKE ? COLLATE NOCASE
           OR c.party_id = UPPER(?)
        ORDER BY
          CASE WHEN c.name LIKE ? COLLATE NOCASE THEN 0
               WHEN con.name LIKE ? COLLATE NOCASE THEN 1
               ELSE 2 END,
          c.name COLLATE NOCASE
        LIMIT ?`,
    )
    .all(like, like, q, like, like, limit) as Array<{
    id: number;
    name: string;
    party_id: string;
    constituency_id: number;
    constituency_name: string;
    district: string;
  }>;

  return NextResponse.json({ ok: true, results: rows });
}
