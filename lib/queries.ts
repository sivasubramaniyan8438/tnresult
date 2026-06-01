import { getDb } from "./db";
import { PARTIES, ALLIANCES, MAJORITY_MARK, TOTAL_SEATS, partyById } from "./parties";
import type { ConstituencySummary, PartyTally, StateSummary } from "./schema";

type CandidateResultRow = {
  candidate_id: number;
  candidate_name: string;
  party_id: string;
  votes: number;
  constituency_id: number;
  constituency_name: string;
  district: string;
  status: string;
  round: number;
  total_rounds: number;
  total_votes: number;
  updated_at: number;
};

const QUERY_ALL_RESULTS = `
  SELECT
    c.id AS candidate_id,
    c.name AS candidate_name,
    c.party_id,
    COALESCE(r.votes, 0) AS votes,
    con.id AS constituency_id,
    con.name AS constituency_name,
    con.district,
    COALESCE(s.status, 'pending') AS status,
    COALESCE(s.round, 0) AS round,
    COALESCE(s.total_rounds, 20) AS total_rounds,
    COALESCE(s.total_votes, 0) AS total_votes,
    COALESCE(s.updated_at, 0) AS updated_at
  FROM candidates c
  JOIN constituencies con ON con.id = c.constituency_id
  LEFT JOIN results r ON r.candidate_id = c.id
  LEFT JOIN constituency_state s ON s.constituency_id = con.id
  ORDER BY con.id, r.votes DESC
`;

export function getStateSummary(): StateSummary {
  const db = getDb();
  const rows = db.prepare(QUERY_ALL_RESULTS).all() as CandidateResultRow[];

  const byConstituency = new Map<number, CandidateResultRow[]>();
  for (const r of rows) {
    if (!byConstituency.has(r.constituency_id)) byConstituency.set(r.constituency_id, []);
    byConstituency.get(r.constituency_id)!.push(r);
  }

  const partyMap = new Map<string, PartyTally>();
  for (const p of PARTIES) {
    partyMap.set(p.id, { partyId: p.id, leading: 0, won: 0, total: 0, voteShare: 0 });
  }

  let declared = 0;
  let counting = 0;
  let pending = 0;
  let totalRoundsCompleted = 0;
  let totalVotesAcrossState = 0;
  let lastUpdate = 0;
  const partyVotes = new Map<string, number>();

  for (const [, candidates] of byConstituency) {
    candidates.sort((a, b) => b.votes - a.votes);
    // NOTA can never win a seat — exclude it from seat tally even if it has
    // the highest count (rare but possible at the start of counting).
    const seatCandidates = candidates.filter((c) => c.party_id !== "NOTA");
    const top = seatCandidates[0];
    if (!top) continue;

    if (top.status === "won") declared++;
    else if (top.status === "counting" || top.status === "leading") counting++;
    else pending++;

    totalRoundsCompleted += top.round;
    if (top.updated_at > lastUpdate) lastUpdate = top.updated_at;

    // Vote share INCLUDES NOTA — broadcast viewers care about NOTA share.
    // Sum candidate-level votes (authoritative) rather than constituency_state.
    // total_votes which can drift if updates pass partial candidate lists.
    for (const c of candidates) {
      partyVotes.set(c.party_id, (partyVotes.get(c.party_id) ?? 0) + c.votes);
      totalVotesAcrossState += c.votes;
    }

    if (top.status !== "pending") {
      const partyTally = partyMap.get(top.party_id) ?? partyMap.get("OTH")!;
      if (top.status === "won") {
        partyTally.won += 1;
        partyTally.total += 1;
      } else {
        partyTally.leading += 1;
        partyTally.total += 1;
      }
    }
  }

  for (const [partyId, votes] of partyVotes) {
    const tally = partyMap.get(partyId) ?? partyMap.get("OTH")!;
    tally.voteShare = totalVotesAcrossState > 0 ? (votes / totalVotesAcrossState) * 100 : 0;
  }

  const parties: PartyTally[] = Array.from(partyMap.values()).sort((a, b) => b.total - a.total);

  const allianceTotals = Object.values(ALLIANCES).map((a) => {
    let total = 0;
    let voteShareSum = 0;
    for (const partyId of a.parties) {
      const t = partyMap.get(partyId);
      if (t) {
        total += t.total;
        voteShareSum += t.voteShare;
      }
    }
    return { id: a.id, total, voteShare: voteShareSum };
  });

  return {
    totalConstituencies: TOTAL_SEATS,
    declared,
    counting,
    pending,
    totalRoundsCompleted,
    parties,
    alliances: allianceTotals,
    lastUpdate,
    countingStartedAt: lastUpdate > 0 ? lastUpdate : null,
  };
}

export function getConstituencySummaries(): ConstituencySummary[] {
  const db = getDb();
  const rows = db.prepare(QUERY_ALL_RESULTS).all() as CandidateResultRow[];

  const byConstituency = new Map<number, CandidateResultRow[]>();
  for (const r of rows) {
    if (!byConstituency.has(r.constituency_id)) byConstituency.set(r.constituency_id, []);
    byConstituency.get(r.constituency_id)!.push(r);
  }

  const summaries: ConstituencySummary[] = [];
  for (const [, candidates] of byConstituency) {
    candidates.sort((a, b) => b.votes - a.votes);
    // NOTA is never the leading or trailing candidate in a seat race.
    const seatCandidates = candidates.filter((c) => c.party_id !== "NOTA");
    const top = seatCandidates[0];
    const second = seatCandidates[1];
    if (!top) continue;

    summaries.push({
      constituencyId: top.constituency_id,
      constituencyName: top.constituency_name,
      district: top.district,
      status: top.status as ConstituencySummary["status"],
      round: top.round,
      totalRounds: top.total_rounds,
      totalVotes: top.total_votes,
      leadingCandidate:
        top.votes > 0
          ? {
              id: top.candidate_id,
              name: top.candidate_name,
              partyId: top.party_id,
              votes: top.votes,
              margin: second ? top.votes - second.votes : top.votes,
            }
          : undefined,
      trailingCandidate: second
        ? {
            id: second.candidate_id,
            name: second.candidate_name,
            partyId: second.party_id,
            votes: second.votes,
          }
        : undefined,
      updatedAt: top.updated_at,
    });
  }

  return summaries.sort((a, b) => a.constituencyId - b.constituencyId);
}

export function getConstituencyDetail(id: number) {
  const db = getDb();
  const constituency = db
    .prepare("SELECT id, name, district, reservation FROM constituencies WHERE id = ?")
    .get(id) as
    | { id: number; name: string; district: string; reservation: string }
    | undefined;
  if (!constituency) return null;

  const state = db
    .prepare(
      "SELECT status, round, total_rounds, total_votes, updated_at FROM constituency_state WHERE constituency_id = ?",
    )
    .get(id) as
    | {
        status: string;
        round: number;
        total_rounds: number;
        total_votes: number;
        updated_at: number;
      }
    | undefined;

  const candidates = db
    .prepare(
      `SELECT c.id, c.name, c.party_id, c.sequence, COALESCE(r.votes, 0) AS votes
       FROM candidates c
       LEFT JOIN results r ON r.candidate_id = c.id
       WHERE c.constituency_id = ?
       ORDER BY votes DESC, c.sequence ASC`,
    )
    .all(id) as Array<{
    id: number;
    name: string;
    party_id: string;
    sequence: number;
    votes: number;
  }>;

  const rounds = db
    .prepare(
      `SELECT round, candidate_id, votes
       FROM round_history
       WHERE constituency_id = ?
       ORDER BY round ASC, candidate_id ASC`,
    )
    .all(id) as Array<{ round: number; candidate_id: number; votes: number }>;

  const roundsByNumber = new Map<number, Map<number, number>>();
  for (const r of rounds) {
    if (!roundsByNumber.has(r.round)) roundsByNumber.set(r.round, new Map());
    roundsByNumber.get(r.round)!.set(r.candidate_id, r.votes);
  }

  return {
    constituency,
    state: state ?? {
      status: "pending",
      round: 0,
      total_rounds: 20,
      total_votes: 0,
      updated_at: 0,
    },
    candidates: candidates.map((c) => ({ ...c, party: partyById(c.party_id) })),
    rounds: Array.from(roundsByNumber.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, votesByCandidate]) => ({
        round,
        votes: Object.fromEntries(votesByCandidate),
      })),
  };
}

export function getMajorityMark() {
  return MAJORITY_MARK;
}

export function getTotalSeats() {
  return TOTAL_SEATS;
}
