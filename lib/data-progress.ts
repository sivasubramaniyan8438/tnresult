/**
 * Single source of truth for "how mature is the counting?"
 *
 * Every UI component that has thin-data behaviour (vote-share donut,
 * swingometer projection, vs-2021 seat delta, bellwether storylines, etc.)
 * pulls from these flags so we keep our gating consistent.
 */
import type { StateSummary } from "./schema";

export type DataProgress = {
  /** Fraction of ACs with any vote data (0..1). */
  acsReportingPct: number;
  /** Fraction of total expected ROUNDS counted across all 234 ACs (0..1). */
  roundsCountedPct: number;
  /** Average completion across reporting ACs (0..1). */
  avgRoundCompletion: number;
  /** Quick boolean buckets used by display gates */
  isVeryThin: boolean; //  < 5% reporting → suppress projections + statewide vote-share %
  isThin: boolean; //     < 15% reporting → mute big extrapolations
  isMature: boolean; //   ≥ 40% reporting → seat deltas vs 2021 become meaningful
};

const TOTAL = 234;
// Rough average rounds per AC across TN — actual range 18–23, midpoint ~20
const ASSUMED_ROUNDS_PER_AC = 20;

export function computeProgress(state: StateSummary): DataProgress {
  const reporting = state.declared + state.counting;
  const acsReportingPct = reporting / TOTAL;

  const totalExpectedRounds = TOTAL * ASSUMED_ROUNDS_PER_AC;
  const roundsCountedPct = state.totalRoundsCompleted / totalExpectedRounds;

  const avgRoundCompletion =
    reporting > 0 ? state.totalRoundsCompleted / reporting / ASSUMED_ROUNDS_PER_AC : 0;

  return {
    acsReportingPct,
    roundsCountedPct,
    avgRoundCompletion,
    isVeryThin: acsReportingPct < 0.05,
    isThin: acsReportingPct < 0.15,
    isMature: acsReportingPct >= 0.4,
  };
}
