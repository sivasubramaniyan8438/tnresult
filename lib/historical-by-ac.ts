/**
 * 2021 Tamil Nadu Assembly Election — winner per constituency.
 *
 * Source: data/historical-2021.json (234 records, parsed 2026-05-02 from
 * Wikipedia's results table). Party totals match the canonical 2021 result:
 * DMK 132, AIADMK 66, INC 18, PMK 5, VCK 4, BJP 4, CPI 2, CPM 2, KMDK 1.
 *
 * The swingometer, swing-map, race-call code, storyline detector, and
 * VipTracker context line all read this. Map flip-detection compares
 * 2021 winner.bloc to 2026 leader.bloc.
 *
 * `marginPct` here is winner% − runner% (i.e. percentage-points lead).
 * `voteSharePct` is the winner's share of valid votes.
 */
import historical2021 from "@/data/historical-2021.json";

export type Historical2021AC = {
  acId: number;
  acName: string;
  district?: string;
  winner: string; // party id
  winnerName: string;
  winnerSharePct: number;
  runner: string; // party id
  runnerName: string;
  runnerSharePct: number;
  marginPct: number; // winner% − runner%
};

type RawRecord = {
  ac_no: number;
  ac_name: string;
  district?: string;
  winner_party: string;
  winner_name: string;
  winner_share_pct: number;
  runner_party: string;
  runner_name: string;
  runner_share_pct: number;
  margin_pct: number;
};

const RAW = historical2021 as { results: RawRecord[] };

const KNOWN_INDEX = new Map<number, Historical2021AC>();
for (const r of RAW.results) {
  KNOWN_INDEX.set(r.ac_no, {
    acId: r.ac_no,
    acName: r.ac_name,
    district: r.district,
    winner: r.winner_party,
    winnerName: r.winner_name,
    winnerSharePct: r.winner_share_pct,
    runner: r.runner_party,
    runnerName: r.runner_name,
    runnerSharePct: r.runner_share_pct,
    marginPct: r.margin_pct,
  });
}

/**
 * Compact lookup used by maps and storyline detection. Falls through to a
 * safe default only for AC ids outside 1..234, which shouldn't happen.
 */
export function get2021ForAc(
  acId: number,
  district?: string,
): { winner: string; marginPct: number; voteSharePct?: number; isKnown: boolean } {
  void district;
  const known = KNOWN_INDEX.get(acId);
  if (known) {
    return {
      winner: known.winner,
      marginPct: known.marginPct,
      voteSharePct: known.winnerSharePct,
      isKnown: true,
    };
  }
  return { winner: "DMK", marginPct: 2, isKnown: false };
}

/** Full 2021 record for an AC — winner + runner names, shares, margin. */
export function getFull2021ForAc(acId: number): Historical2021AC | null {
  return KNOWN_INDEX.get(acId) ?? null;
}

export const KNOWN_2021_COUNT = KNOWN_INDEX.size;
