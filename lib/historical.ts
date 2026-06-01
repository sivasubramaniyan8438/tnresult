// 2021 Tamil Nadu Legislative Assembly Election results.
// Used for "vs 2021" comparisons in the dashboard.
// Source: Election Commission of India.

export type HistoricalParty = {
  partyId: string;
  seats: number;
  voteShare: number; // percentage
};

export const HISTORICAL_2021: HistoricalParty[] = [
  { partyId: "DMK", seats: 133, voteShare: 37.7 },
  { partyId: "AIADMK", seats: 66, voteShare: 33.29 },
  { partyId: "INC", seats: 18, voteShare: 4.27 },
  { partyId: "PMK", seats: 5, voteShare: 4.13 },
  { partyId: "VCK", seats: 4, voteShare: 0.85 },
  { partyId: "BJP", seats: 4, voteShare: 2.62 },
  { partyId: "CPI", seats: 2, voteShare: 0.83 },
  { partyId: "CPM", seats: 2, voteShare: 0.83 },
  { partyId: "MDMK", seats: 0, voteShare: 0.45 },
  { partyId: "NTK", seats: 0, voteShare: 6.55 },
  { partyId: "DMDK", seats: 0, voteShare: 0.43 },
  { partyId: "IND", seats: 0, voteShare: 0.62 },
];

export const HISTORICAL_YEAR = 2021;

export function historicalFor(partyId: string): HistoricalParty | undefined {
  return HISTORICAL_2021.find((h) => h.partyId === partyId);
}

export type Comparison = {
  partyId: string;
  seatsThen: number;
  seatsNow: number;
  seatDelta: number;
  voteShareThen: number;
  voteShareNow: number;
  voteShareDelta: number;
};

export function buildComparisons(
  current: { partyId: string; total: number; voteShare: number }[],
): Comparison[] {
  const ids = new Set<string>();
  for (const c of current) ids.add(c.partyId);
  for (const h of HISTORICAL_2021) ids.add(h.partyId);

  const result: Comparison[] = [];
  for (const id of ids) {
    const cur = current.find((c) => c.partyId === id);
    const hist = historicalFor(id);
    const seatsThen = hist?.seats ?? 0;
    const seatsNow = cur?.total ?? 0;
    const voteShareThen = hist?.voteShare ?? 0;
    const voteShareNow = cur?.voteShare ?? 0;
    if (seatsThen === 0 && seatsNow === 0 && voteShareThen === 0 && voteShareNow === 0) continue;
    result.push({
      partyId: id,
      seatsThen,
      seatsNow,
      seatDelta: seatsNow - seatsThen,
      voteShareThen,
      voteShareNow,
      voteShareDelta: voteShareNow - voteShareThen,
    });
  }

  // Sort by current seats desc, then by 2021 seats desc
  return result.sort((a, b) => b.seatsNow - a.seatsNow || b.seatsThen - a.seatsThen);
}
