import { NextResponse } from "next/server";
import { applyRoundUpdate } from "@/lib/writer";
import { checkAdmin } from "@/lib/auth";
import { validateUpdate } from "@/lib/validation";
import { getDb } from "@/lib/db";
import { resolveAc } from "@/lib/resolve-ac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Quick-write endpoint — flat 5-bucket payload, optimized for the live
 * broadcast use case where you only care about DMK / ADMK / TVK / NTK / OTHERS.
 *
 * REQUEST
 *   POST /api/agent/quick
 *   Headers (optional):
 *     x-actor: agent:my-bot
 *     Idempotency-Key: <uuid>
 *   Body:
 *     {
 *       "ac": "Kolathur",        // constituency NAME (recommended) or ID number
 *       "round": 5,
 *       "DMK": 14523,
 *       "ADMK": 11890,           // ADMK and AIADMK both accepted
 *       "TVK": 2341,
 *       "NTK": 480,
 *       "OTHERS": 1200,          // single lump sum for everyone else
 *       "status": "leading",     // optional — "counting" | "leading" | "won"
 *       "totalRounds": 22        // optional
 *     }
 *
 * Name resolution rules for "ac":
 *   - Exact match (case-insensitive): "Kolathur" / "kolathur" / "KOLATHUR" all work
 *   - Punctuation/spaces ignored: "T.Nagar" / "T Nagar" / "Thiyagarayanagar"
 *     all map to AC#24
 *   - Numbers still work: ac=13 OR ac="13" both map to AC#13
 *   - Ambiguous (e.g. "Tiruppattur" matches AC#50 and AC#185) → 400 with
 *     suggestions list. Add district to disambiguate: "Tiruppattur, Sivaganga"
 *
 * RESPONSE 200
 *   { "ok": true, "applied": true, "ac": { "id": 13, "name": "Kolathur" }, "warnings": [] }
 * RESPONSE 409
 *   { "ok": false, "applied": false, "reason": "<see API.md>" }
 * RESPONSE 400 (name not found)
 *   { "ok": false, "error": "no AC matched 'kolathr'", "suggestions": ["Kolathur", "Mylapore"] }
 *
 * Behavior:
 *   - DMK/ADMK/TVK/NTK each go to the first seeded candidate of that party.
 *   - OTHERS sums onto the first non-major candidate (BJP/INC/etc.). Other
 *     minor candidates keep their existing values.
 *   - Any of the 5 keys can be omitted.
 */

// Idempotency cache shared with /api/agent/update would be nice but each
// route has its own; for v1 keep them separate.
const IDEMP_CACHE = new Map<string, { ts: number; status: number; body: unknown }>();
const IDEMP_TTL_MS = 24 * 60 * 60 * 1000;
function pruneIdemp() {
  const cutoff = Date.now() - IDEMP_TTL_MS;
  for (const [k, v] of IDEMP_CACHE) if (v.ts < cutoff) IDEMP_CACHE.delete(k);
}

const OTHERS_FALLBACK_PRIORITY = ["BJP", "INC", "VCK", "PMK", "DMDK", "MDMK", "CPI", "CPM", "OTH", "IND"];

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

  // Resolve "ac" — accepts a name OR an id
  const acInput = body.ac ?? body.constituencyId ?? body.constituency;
  const resolved = resolveAc(acInput);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error, suggestions: resolved.suggestions },
      { status: 400 },
    );
  }
  const ac = resolved.ac.id;
  const acName = resolved.ac.name;

  // Round is OPTIONAL. Default: keep the AC's current round (so you can
  // update vote totals without bumping the round counter). If no prior
  // state, default to 1. Pass an explicit round to advance it (e.g. when
  // ECI announces "Round 5 completed").
  let round = Number(body.round);
  if (!Number.isFinite(round) || round <= 0) {
    const priorRoundRow = getDb()
      .prepare("SELECT round FROM constituency_state WHERE constituency_id = ?")
      .get(ac) as { round: number } | undefined;
    round = priorRoundRow?.round && priorRoundRow.round > 0 ? priorRoundRow.round : 1;
  }

  // Allow either DMK/ADMK/TVK/NTK/OTHERS keys; ADMK is an alias for AIADMK
  const inputs: Record<string, number> = {};
  for (const k of ["DMK", "ADMK", "AIADMK", "TVK", "NTK", "OTHERS"]) {
    const v = body[k];
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ ok: false, error: `${k} must be a number` }, { status: 400 });
    }
    if (n < 0) {
      return NextResponse.json({ ok: false, error: `${k} negative not allowed` }, { status: 400 });
    }
    if (k === "ADMK") inputs.AIADMK = n;
    else inputs[k] = n;
  }

  if (Object.keys(inputs).length === 0) {
    return NextResponse.json(
      { ok: false, error: "at least one of DMK/ADMK/TVK/NTK/OTHERS required" },
      { status: 400 },
    );
  }

  // Resolve party → candidate
  const db = getDb();
  const cands = db
    .prepare("SELECT id, party_id FROM candidates WHERE constituency_id = ? ORDER BY sequence ASC, id ASC")
    .all(ac) as Array<{ id: number; party_id: string }>;
  if (!cands.length) {
    return NextResponse.json(
      { ok: false, error: `AC#${ac} has no candidates seeded yet` },
      { status: 400 },
    );
  }
  const firstByParty = new Map<string, number>();
  for (const c of cands) if (!firstByParty.has(c.party_id)) firstByParty.set(c.party_id, c.id);

  const candidateRows: Array<{ candidateId: number; votes: number }> = [];
  for (const partyId of ["DMK", "AIADMK", "TVK", "NTK"]) {
    if (inputs[partyId] == null) continue;
    const cid = firstByParty.get(partyId);
    if (!cid) {
      return NextResponse.json(
        { ok: false, error: `AC#${ac}: no ${partyId} candidate seeded` },
        { status: 400 },
      );
    }
    candidateRows.push({ candidateId: cid, votes: inputs[partyId] });
  }

  // OTHERS — assign to the first non-major candidate (BJP/INC/etc.)
  if (inputs.OTHERS != null) {
    let othersCandidate: number | undefined;
    for (const fallbackParty of OTHERS_FALLBACK_PRIORITY) {
      const cid = firstByParty.get(fallbackParty);
      if (cid) {
        othersCandidate = cid;
        break;
      }
    }
    if (!othersCandidate) {
      return NextResponse.json(
        {
          ok: false,
          error: `AC#${ac}: no non-major candidate to attach OTHERS to. Drop OTHERS or use /api/agent/update.`,
        },
        { status: 400 },
      );
    }
    candidateRows.push({ candidateId: othersCandidate, votes: inputs.OTHERS });
  }

  const warnings = validateUpdate(ac, round, candidateRows);

  const result = applyRoundUpdate({
    constituencyId: ac,
    round,
    totalRounds: body.totalRounds,
    status: body.status,
    candidates: candidateRows,
    actor: auth.actor.startsWith("agent:") ? auth.actor : `agent:${auth.actor}`,
    source: "agent",
    ip: auth.ip,
  });

  if (!result.applied) {
    const respBody = { ok: false, applied: false, reason: result.reason, warnings };
    if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 409, body: respBody });
    return NextResponse.json(respBody, { status: 409 });
  }
  const respBody = {
    ok: true,
    applied: true,
    ac: { id: ac, name: acName },
    warnings,
  };
  if (idempKey) IDEMP_CACHE.set(idempKey, { ts: Date.now(), status: 200, body: respBody });
  return NextResponse.json(respBody);
}
