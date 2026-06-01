import { NextResponse } from "next/server";
import { applyRoundUpdate } from "@/lib/writer";
import { checkAdmin } from "@/lib/auth";
import { validateUpdate } from "@/lib/validation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Agentic vote update endpoint.
 *
 * Designed for autonomous agents (other Claudes, scripts, integrations) to
 * push round updates programmatically. Same writer contract as /api/admin/update,
 * but:
 *   - source is tagged 'agent' in the audit log (so manual + agent writes
 *     stay distinguishable post-hoc)
 *   - Idempotency-Key header support: replays return the cached result
 *     instead of double-writing
 *   - Accepts a richer body shape: candidates can be referenced by partyId
 *     instead of candidateId
 *
 * REQUEST
 *   POST /api/agent/update
 *   Headers:
 *     Content-Type: application/json
 *     x-actor: agent:my-bot-name           (recommended; ends up in audit log)
 *     Idempotency-Key: <uuid-or-hash>      (optional but encouraged)
 *     Authorization: Bearer <ADMIN_TOKEN>  (only if env var set on server)
 *   Body:
 *     {
 *       "constituencyId": 13,
 *       "round": 5,
 *       "totalRounds": 22,                                    // optional
 *       "status": "leading",                                  // optional
 *       "candidates": [
 *         { "partyId": "DMK",     "votes": 14523 },           // by partyId
 *         { "candidateId": 239,   "votes": 11890 },           // OR candidateId
 *         { "partyId": "TVK",     "votes": 2341 }
 *       ],
 *       "dryRun": false                                       // optional
 *     }
 *
 * RESPONSE 200
 *     { "ok": true, "applied": true, "warnings": [...] }
 * RESPONSE 200 (idempotent replay)
 *     { "ok": true, "applied": <prior>, "replayed": true }
 * RESPONSE 409 (rejected — see reason)
 *     { "ok": false, "applied": false, "reason": "locked"|"stale-round"|"won-sticky"|"no-change"|"negative-votes" }
 */

// In-memory idempotency cache. 24-hour TTL. Resets on process restart, which
// is fine — counting day is a single boot.
const IDEMP_CACHE = new Map<
  string,
  { ts: number; status: number; body: unknown }
>();
const IDEMP_TTL_MS = 24 * 60 * 60 * 1000;

function pruneIdemp() {
  const cutoff = Date.now() - IDEMP_TTL_MS;
  for (const [k, v] of IDEMP_CACHE) if (v.ts < cutoff) IDEMP_CACHE.delete(k);
}

type AgentCandidate = {
  candidateId?: number;
  partyId?: string;
  votes: number;
};

function resolve(constituencyId: number, candidates: AgentCandidate[]) {
  const db = getDb();
  const ourCands = db
    .prepare("SELECT id, party_id FROM candidates WHERE constituency_id = ?")
    .all(constituencyId) as Array<{ id: number; party_id: string }>;
  if (!ourCands.length) {
    return { ok: false as const, error: `AC#${constituencyId} has no candidates seeded` };
  }
  const byParty = new Map<string, number>();
  // First match wins — slate ordered by sequence at seed time
  for (const c of ourCands) if (!byParty.has(c.party_id)) byParty.set(c.party_id, c.id);

  const out: Array<{ candidateId: number; votes: number }> = [];
  for (const c of candidates) {
    if (!Number.isFinite(c.votes)) {
      return { ok: false as const, error: `votes must be a number` };
    }
    if (Number.isFinite(c.candidateId)) {
      out.push({ candidateId: c.candidateId as number, votes: c.votes });
    } else if (c.partyId) {
      const id = byParty.get(c.partyId.toUpperCase());
      if (!id) {
        return {
          ok: false as const,
          error: `no ${c.partyId} candidate seeded for AC#${constituencyId}`,
        };
      }
      out.push({ candidateId: id, votes: c.votes });
    } else {
      return {
        ok: false as const,
        error: "each candidate row needs candidateId or partyId",
      };
    }
  }
  return { ok: true as const, resolved: out };
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  pruneIdemp();
  const idempKey = req.headers.get("idempotency-key");
  if (idempKey && IDEMP_CACHE.has(idempKey)) {
    const cached = IDEMP_CACHE.get(idempKey)!;
    return NextResponse.json(
      { ...(cached.body as object), replayed: true },
      { status: cached.status },
    );
  }

  const body = await req.json().catch(() => ({}));
  if (!body.constituencyId || !Array.isArray(body.candidates) || !body.candidates.length) {
    return NextResponse.json(
      { ok: false, error: "constituencyId + non-empty candidates required" },
      { status: 400 },
    );
  }

  const r = resolve(body.constituencyId, body.candidates);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }

  const round = Number(body.round) || 0;
  const warnings = validateUpdate(body.constituencyId, round, r.resolved);

  if (body.dryRun === true) {
    const respBody = { ok: true, applied: false, warnings };
    if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 200, body: respBody });
    return NextResponse.json(respBody);
  }

  const result = applyRoundUpdate({
    constituencyId: body.constituencyId,
    round,
    totalRounds: body.totalRounds,
    status: body.status,
    candidates: r.resolved,
    actor: auth.actor.startsWith("agent:") ? auth.actor : `agent:${auth.actor}`,
    source: "agent",
    ip: auth.ip,
  });

  if (!result.applied) {
    const respBody = { ok: false, applied: false, reason: result.reason, warnings };
    if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 409, body: respBody });
    return NextResponse.json(respBody, { status: 409 });
  }
  const respBody = { ok: true, applied: true, warnings };
  if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 200, body: respBody });
  return NextResponse.json(respBody);
}
