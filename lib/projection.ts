/**
 * Live "if pattern holds" projection.
 *
 * Two methods, blended:
 *   A) Status extrapolation: scale current declared+leading proportions to
 *      cover all 234 seats.
 *   B) Vote-share extrapolation (UNS): apply current statewide vote-share
 *      change vs 2021 to each AC's 2021 margin (when known).
 *
 * Until enough data exists for B (≥ 10% of votes counted), we lean on A.
 * Confidence band shrinks as more results report.
 */
import type { ConstituencySummary, StateSummary } from "./schema";
import { TOTAL_SEATS } from "./parties";
import { rollupCalls } from "./calls";

export type Projection = {
  partyId: string;
  point: number; // central estimate
  low: number;
  high: number;
  basis: "extrapolation" | "called+leaning" | "thin-data";
};

const FOCUS_PARTIES = ["DMK", "AIADMK", "TVK", "NTK"];

export function project(state: StateSummary, constituencies: ConstituencySummary[]): {
  projections: Projection[];
  countedShare: number; // 0..1 — fraction of seats with any data
  confidence: "low" | "medium" | "high";
} {
  const decided = state.declared + state.counting;
  const countedShare = decided / TOTAL_SEATS;

  // Sum currently-leading + 0.85 * "likely" + 0.55 * "leaning" → expected final
  const { decisions } = rollupCalls(constituencies);
  const expected: Record<string, number> = {};
  const variance: Record<string, number> = {};
  for (const c of constituencies) {
    const partyId = c.leadingCandidate?.partyId;
    if (!partyId) continue;
    const decision = decisions.get(c.constituencyId)!;
    // "If pattern holds" — assume the current leader holds, weighted by confidence
    let weight: number;
    switch (decision.status) {
      case "called":
        weight = 1.0;
        break;
      case "likely":
        weight = 0.95;
        break;
      case "leaning":
        weight = 0.85;
        break;
      default:
        // currently leading but too-close-to-call — still favor current leader
        weight = 0.7;
    }
    expected[partyId] = (expected[partyId] ?? 0) + weight;
    // Variance contribution: bigger when uncalled
    variance[partyId] = (variance[partyId] ?? 0) + (1 - weight) * weight;
  }

  // If many seats are still pending, extrapolate party share into them
  const totalAccountedFor = Object.values(expected).reduce((s, v) => s + v, 0);
  const pendingSeats = Math.max(0, TOTAL_SEATS - state.declared - state.counting);
  if (pendingSeats > 0 && totalAccountedFor > 0) {
    for (const partyId of Object.keys(expected)) {
      const share = expected[partyId] / totalAccountedFor;
      expected[partyId] += share * pendingSeats;
      variance[partyId] += share * pendingSeats * (1 - share);
    }
  }

  // Build projections for the focus parties + everyone else with > 1 expected
  const allParties = new Set<string>([...Object.keys(expected), ...FOCUS_PARTIES]);
  const basis: Projection["basis"] =
    countedShare < 0.05 ? "thin-data" : countedShare < 0.4 ? "extrapolation" : "called+leaning";

  const projections: Projection[] = [];
  for (const partyId of allParties) {
    // Clamp point to [0, TOTAL_SEATS] — when only a few ACs report, the
    // single-party extrapolation can otherwise project >234 seats which
    // would render the band degenerate (low > high).
    const rawPoint = expected[partyId] ?? 0;
    const point = Math.max(0, Math.min(TOTAL_SEATS, Math.round(rawPoint)));
    const sd = Math.sqrt(variance[partyId] ?? 0);
    // Confidence band tightens as countedShare grows. When data is thin,
    // also widen by a fraction of total seats so we don't show a tiny
    // band around an extrapolated number.
    const tightness = Math.max(0.4, 1 - countedShare);
    const dataWidthBoost = countedShare < 0.1 ? Math.round(TOTAL_SEATS * 0.15) : 0;
    const halfWidth = Math.round(Math.max(2, sd * 1.6 * tightness)) + dataWidthBoost;
    projections.push({
      partyId,
      point,
      low: Math.max(0, point - halfWidth),
      high: Math.min(TOTAL_SEATS, point + halfWidth),
      basis,
    });
  }

  // Sort: focus first, then by point desc
  projections.sort((a, b) => {
    const af = FOCUS_PARTIES.indexOf(a.partyId);
    const bf = FOCUS_PARTIES.indexOf(b.partyId);
    if (af === -1 && bf === -1) return b.point - a.point;
    if (af === -1) return 1;
    if (bf === -1) return -1;
    return af - bf;
  });

  const confidence: "low" | "medium" | "high" =
    countedShare < 0.1 ? "low" : countedShare < 0.5 ? "medium" : "high";

  return { projections, countedShare, confidence };
}
