/**
 * AP-style race-call engine.
 *
 * Decision rule:
 *   1. If trailing #2's votes + remaining_estimated < #1's votes, the race is
 *      mathematically decided -> CALLED.
 *   2. If #1's lead exceeds (remaining_estimated * 0.6) AND lead > 5% of
 *      counted, the race is LIKELY (high confidence but not yet mathematical).
 *   3. If lead > 2% of counted votes -> LEANING.
 *   4. Otherwise UNCALLED / TOO CLOSE.
 *
 * Estimated turnout per AC: pulled from constituency_state.total_votes once
 * counting starts (we extrapolate the per-round average to the remaining
 * rounds). Before any rounds: assume 220k turnout (TN AC average).
 */
import type { ConstituencySummary } from "./schema";

export type CallStatus = "uncalled" | "leaning" | "likely" | "called";

const ASSUMED_TURNOUT = 220_000;

export type CallDecision = {
  status: CallStatus;
  confidence: number; // 0..1
  remainingEstimated: number;
  reason: string;
};

export function decideCall(c: ConstituencySummary): CallDecision {
  if (c.status === "won") {
    return {
      status: "called",
      confidence: 1,
      remainingEstimated: 0,
      reason: "Final result declared",
    };
  }
  if (c.round === 0 || c.totalRounds === 0 || !c.leadingCandidate) {
    return {
      status: "uncalled",
      confidence: 0,
      remainingEstimated: ASSUMED_TURNOUT,
      reason: "Counting has not started",
    };
  }

  const counted = c.totalVotes;
  const projected =
    counted > 0 && c.round > 0
      ? Math.max(counted, (counted / c.round) * c.totalRounds)
      : ASSUMED_TURNOUT;
  const remaining = Math.max(0, projected - counted);

  const margin = c.leadingCandidate.margin;
  const leadPct = counted > 0 ? margin / counted : 0;

  // Mathematical certainty: even if every remaining vote went to #2, #1 still wins
  if (margin > remaining + 1) {
    return {
      status: "called",
      confidence: 1,
      remainingEstimated: remaining,
      reason: `Lead ${margin.toLocaleString("en-IN")} > remaining estimated ${Math.round(remaining).toLocaleString("en-IN")}`,
    };
  }

  // Likely: lead is large vs remaining, plus comfortable margin %
  if (margin > remaining * 0.6 && leadPct > 0.05) {
    return {
      status: "likely",
      confidence: 0.85,
      remainingEstimated: remaining,
      reason: `Lead at ${(leadPct * 100).toFixed(1)}% with ~${Math.round(remaining / 1000)}k votes left`,
    };
  }

  // Leaning: comfortable enough %
  if (leadPct > 0.02) {
    return {
      status: "leaning",
      confidence: 0.6,
      remainingEstimated: remaining,
      reason: `Lead ${(leadPct * 100).toFixed(1)}% of counted votes`,
    };
  }

  return {
    status: "uncalled",
    confidence: 0.3,
    remainingEstimated: remaining,
    reason: "Too close to call",
  };
}

export type CallRollup = {
  called: number;
  likely: number;
  leaning: number;
  uncalled: number;
  byParty: Record<string, { called: number; likely: number; leaning: number; total: number }>;
};

export function rollupCalls(
  constituencies: ConstituencySummary[],
): { decisions: Map<number, CallDecision>; rollup: CallRollup } {
  const decisions = new Map<number, CallDecision>();
  const rollup: CallRollup = {
    called: 0,
    likely: 0,
    leaning: 0,
    uncalled: 0,
    byParty: {},
  };
  for (const c of constituencies) {
    const decision = decideCall(c);
    decisions.set(c.constituencyId, decision);
    rollup[decision.status]++;
    const partyId = c.leadingCandidate?.partyId;
    if (!partyId) continue;
    if (!rollup.byParty[partyId]) {
      rollup.byParty[partyId] = { called: 0, likely: 0, leaning: 0, total: 0 };
    }
    if (decision.status === "called") rollup.byParty[partyId].called++;
    else if (decision.status === "likely") rollup.byParty[partyId].likely++;
    else if (decision.status === "leaning") rollup.byParty[partyId].leaning++;
    rollup.byParty[partyId].total++;
  }
  return { decisions, rollup };
}
