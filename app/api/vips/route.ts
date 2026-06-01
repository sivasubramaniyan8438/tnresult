import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { checkAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StaticVip = {
  name: string;
  role: string;
  constituencyId: number;
  expectedParty: string;
  initials: string;
};

type Vip = StaticVip & { id?: string; source: "static" | "runtime" };

function staticVips(): StaticVip[] {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "vips.json"), "utf-8"),
    );
  } catch {
    return [];
  }
}

function runtimeVips() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT v.id, v.role, v.created_at, v.created_by,
              c.id AS candidate_id, c.name, c.party_id, c.constituency_id
         FROM vip_overrides v
         JOIN candidates c ON c.id = v.candidate_id
        ORDER BY v.created_at DESC`,
    )
    .all() as Array<{
    id: number;
    role: string;
    created_at: number;
    created_by: string | null;
    candidate_id: number;
    name: string;
    party_id: string;
    constituency_id: number;
  }>;
  return rows;
}

function makeInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** GET — merged list (static + runtime). Runtime entries take precedence on candidate dedup. */
export async function GET() {
  const out: Vip[] = [];
  const seenCandidateIds = new Set<number>();

  for (const r of runtimeVips()) {
    out.push({
      id: `r:${r.id}`,
      name: r.name,
      role: r.role,
      constituencyId: r.constituency_id,
      expectedParty: r.party_id,
      initials: makeInitials(r.name),
      source: "runtime",
    });
    seenCandidateIds.add(r.candidate_id);
  }

  for (const s of staticVips()) {
    out.push({ ...s, source: "static" });
  }

  return NextResponse.json({ ok: true, vips: out });
}

/** POST — add a runtime VIP. Body: { candidateId: number, role?: string } */
export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const candidateId = Number(body.candidateId);
  const role = (body.role ?? "Marquee race").toString().slice(0, 80);

  if (!Number.isFinite(candidateId)) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const db = getDb();
  const cand = db
    .prepare("SELECT id, name FROM candidates WHERE id = ?")
    .get(candidateId) as { id: number; name: string } | undefined;
  if (!cand) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }

  try {
    db.prepare(
      "INSERT INTO vip_overrides(candidate_id, role, created_at, created_by) VALUES (?, ?, ?, ?)",
    ).run(candidateId, role, Date.now(), auth.actor);
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ error: "candidate already a VIP" }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, name: cand.name });
}

/** DELETE — remove a runtime VIP by overrides id. */
export async function DELETE(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }
  const db = getDb();
  const info = db.prepare("DELETE FROM vip_overrides WHERE id = ?").run(id);
  return NextResponse.json({ ok: true, removed: info.changes });
}
