import { NextResponse } from "next/server";
import { applyRoundUpdate } from "@/lib/writer";
import { checkAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolveAc } from "@/lib/resolve-ac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Declare a winner — the "race-call" moment for an AC.
 *
 * Sets status='won', optionally bumps the winning candidate's vote count,
 * and locks the call so the scraper can no longer flip it back.
 *
 * REQUEST
 *   POST /api/agent/winner
 *   Headers (optional):
 *     x-actor: agent:bot         (or a human's name)
 *     Idempotency-Key: <uuid>
 *   Body:
 *     {
 *       "ac": "Kolathur",        // name or id
 *       "winner": "DMK",         // DMK / ADMK / AIADMK / TVK / NTK / BJP / INC / VCK / PMK / IND
 *       "votes": 80000,          // optional final vote count for the winner
 *       "round": 22              // optional final round number
 *     }
 *
 * RESPONSE 200
 *   { "ok": true, "applied": true, "ac": { "id": 13, "name": "Kolathur" },
 *     "winner": { "name": "M. K. Stalin", "partyId": "DMK", "votes": 80000 } }
 * RESPONSE 409
 *   { "ok": false, "applied": false, "reason": "..." }
 *
 * Behavior:
 *   - The named party's seeded candidate in this AC is marked as winner.
 *   - status is forced to 'won'. After this, only /api/admin/reset can
 *     un-call the seat (the won-sticky guard kicks in).
 *   - If the named party isn't currently leading in vote count and you
 *     didn't pass a "votes" override, you get a soft warning — the call
 *     still applies (you may know something the data hasn't caught up to).
 */

const PARTY_ALIASES: Record<string, string> = {
  ADMK: "AIADMK",
  ANNADMK: "AIADMK",
  CONGRESS: "INC",
};

const IDEMP_CACHE = new Map<string, { ts: number; status: number; body: unknown }>();
const IDEMP_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;

  const idempKey = req.headers.get("idempotency-key");
  if (idempKey && IDEMP_CACHE.has(idempKey)) {
    const cached = IDEMP_CACHE.get(idempKey)!;
    return NextResponse.json(
      { ...(cached.body as object), replayed: true },
      { status: cached.status },
    );
  }

  const body = await req.json().catch(() => ({}));

  const acRes = resolveAc(body.ac ?? body.constituencyId ?? body.constituency);
  if (!acRes.ok) {
    return NextResponse.json(
      { ok: false, error: acRes.error, suggestions: acRes.suggestions },
      { status: 400 },
    );
  }
  const ac = acRes.ac;

  const rawWinner = String(body.winner ?? body.party ?? "").toUpperCase().trim();
  if (!rawWinner) {
    return NextResponse.json({ ok: false, error: "winner (party) required" }, { status: 400 });
  }
  const winnerParty = PARTY_ALIASES[rawWinner] ?? rawWinner;

  const db = getDb();
  const winnerCandidate = db
    .prepare(
      "SELECT id, name, party_id FROM candidates WHERE constituency_id = ? AND party_id = ? ORDER BY sequence ASC, id ASC LIMIT 1",
    )
    .get(ac.id, winnerParty) as { id: number; name: string; party_id: string } | undefined;

  if (!winnerCandidate) {
    return NextResponse.json(
      {
        ok: false,
        error: `AC#${ac.id} ${ac.name} has no ${winnerParty} candidate seeded. Use /api/agent/update with explicit candidateId, or check the party slug.`,
      },
      { status: 400 },
    );
  }

  // Round is OPTIONAL — defaults to keep prior round, or total_rounds when winning.
  let round = Number(body.round);
  if (!Number.isFinite(round) || round <= 0) {
    const priorRow = db
      .prepare("SELECT round, total_rounds FROM constituency_state WHERE constituency_id = ?")
      .get(ac.id) as { round: number; total_rounds: number } | undefined;
    round = priorRow?.round && priorRow.round > 0 ? priorRow.round : (priorRow?.total_rounds ?? 1);
  }

  const overrideVotes = body.votes != null ? Number(body.votes) : null;
  if (overrideVotes != null && (!Number.isFinite(overrideVotes) || overrideVotes < 0)) {
    return NextResponse.json({ ok: false, error: "votes must be a non-negative number" }, { status: 400 });
  }

  // If no votes override, look up current value so we can re-set status='won'
  // without modifying the count. applyRoundUpdate's no-change detector would
  // otherwise reject the write — so we always need at least one candidate row.
  const currentVotes =
    overrideVotes ??
    ((db
      .prepare("SELECT votes FROM results WHERE candidate_id = ?")
      .get(winnerCandidate.id) as { votes: number } | undefined)?.votes ??
      0);

  // Pass the candidate row(s) with current values when no override given.
  // The writer's no-change detector now permits status-only changes
  // (votesUnchanged && statusUnchanged → skip), so passing matching votes
  // with status='won' still flows through to update the AC state.
  const candidates =
    overrideVotes != null
      ? [{ candidateId: winnerCandidate.id, votes: overrideVotes }]
      : [{ candidateId: winnerCandidate.id, votes: currentVotes }];

  const result = applyRoundUpdate({
    constituencyId: ac.id,
    round,
    status: "won",
    candidates,
    actor: auth.actor.startsWith("agent:") ? auth.actor : `agent:${auth.actor}`,
    source: "agent",
    ip: auth.ip,
  });

  if (!result.applied) {
    const respBody = {
      ok: false,
      applied: false,
      reason: result.reason,
    };
    if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 409, body: respBody });
    return NextResponse.json(respBody, { status: 409 });
  }

  // Sanity warning: was the winner actually leading?
  const leadingNow = db
    .prepare(
      `SELECT c.party_id, c.name, r.votes
         FROM results r JOIN candidates c ON c.id = r.candidate_id
        WHERE r.constituency_id = ?
        ORDER BY r.votes DESC LIMIT 1`,
    )
    .get(ac.id) as { party_id: string; name: string; votes: number } | undefined;
  const warnings: string[] = [];
  if (leadingNow && leadingNow.party_id !== winnerParty) {
    warnings.push(
      `Heads-up: ${leadingNow.name} (${leadingNow.party_id}) currently has more votes than ${winnerCandidate.name}. The call applied but vote totals don't yet reflect it.`,
    );
  }

  const respBody = {
    ok: true,
    applied: true,
    ac: { id: ac.id, name: ac.name },
    winner: {
      name: winnerCandidate.name,
      partyId: winnerCandidate.party_id,
      votes: overrideVotes ?? currentVotes,
    },
    warnings,
  };
  if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 200, body: respBody });
  return NextResponse.json(respBody);
}
