export type ConstituencyStatus = "pending" | "counting" | "leading" | "won";

export type Constituency = {
  id: number; // 1..234
  name: string;
  district: string;
  reservation: "GEN" | "SC" | "ST";
};

export type Candidate = {
  id: number;
  constituencyId: number;
  name: string;
  partyId: string;
  isAlliancePartner?: boolean;
};

export type Result = {
  constituencyId: number;
  candidateId: number;
  votes: number;
  round: number; // current round
  updatedAt: number; // unix ms
};

export type ConstituencySummary = {
  constituencyId: number;
  constituencyName: string;
  district: string;
  status: ConstituencyStatus;
  round: number;
  totalRounds: number;
  totalVotes: number;
  leadingCandidate?: {
    id: number;
    name: string;
    partyId: string;
    votes: number;
    margin: number;
  };
  trailingCandidate?: {
    id: number;
    name: string;
    partyId: string;
    votes: number;
  };
  updatedAt: number;
};

export type PartyTally = {
  partyId: string;
  leading: number;
  won: number;
  total: number;
  voteShare: number;
};

export type StateSummary = {
  totalConstituencies: number;
  declared: number;
  counting: number;
  pending: number;
  totalRoundsCompleted: number;
  parties: PartyTally[];
  alliances: { id: string; total: number; voteShare: number }[];
  lastUpdate: number;
  countingStartedAt: number | null;
};
