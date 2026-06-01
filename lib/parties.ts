export type Party = {
  id: string;
  name: string;
  shortName: string;
  fullName: string;
  color: string;
  textColor: string;
  alliance: "INDIA" | "NDA" | "TVK" | "NTK" | "OTHERS" | "IND";
  allianceLabel: string;
  leader?: string;
};

export const PARTIES: Party[] = [
  {
    id: "DMK",
    name: "DMK",
    shortName: "DMK",
    fullName: "Dravida Munnetra Kazhagam",
    color: "#dc2626",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "M. K. Stalin",
  },
  {
    id: "AIADMK",
    name: "AIADMK",
    shortName: "AIADMK",
    fullName: "All India Anna Dravida Munnetra Kazhagam",
    color: "#16a34a",
    textColor: "#ffffff",
    alliance: "NDA",
    allianceLabel: "NDA Alliance",
    leader: "Edappadi K. Palaniswami",
  },
  {
    id: "BJP",
    name: "BJP",
    shortName: "BJP",
    fullName: "Bharatiya Janata Party",
    color: "#f97316",
    textColor: "#ffffff",
    alliance: "NDA",
    allianceLabel: "NDA Alliance",
    leader: "Nainar Nagenthran",
  },
  {
    id: "INC",
    name: "INC",
    shortName: "INC",
    fullName: "Indian National Congress",
    color: "#2563eb",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "K. Selvaperunthagai",
  },
  {
    id: "TVK",
    name: "TVK",
    shortName: "TVK",
    fullName: "Tamilaga Vettri Kazhagam",
    color: "#eab308",
    textColor: "#000000",
    alliance: "TVK",
    allianceLabel: "Independent",
    leader: "Joseph Vijay",
  },
  {
    id: "NTK",
    name: "NTK",
    shortName: "NTK",
    fullName: "Naam Tamilar Katchi",
    color: "#a855f7",
    textColor: "#ffffff",
    alliance: "NTK",
    allianceLabel: "Independent",
    leader: "Senthamizhan Seeman",
  },
  {
    id: "VCK",
    name: "VCK",
    shortName: "VCK",
    fullName: "Viduthalai Chiruthaigal Katchi",
    color: "#0891b2",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "Thol. Thirumavalavan",
  },
  {
    id: "PMK",
    name: "PMK",
    shortName: "PMK",
    fullName: "Pattali Makkal Katchi",
    color: "#facc15",
    textColor: "#000000",
    alliance: "NDA",
    allianceLabel: "NDA Alliance",
    leader: "Anbumani Ramadoss",
  },
  {
    id: "AMMK",
    name: "AMMK",
    shortName: "AMMK",
    fullName: "Amma Makkal Munnetra Kazhagam",
    // Distinct from AIADMK green so dual-AIADMK-faction races are readable.
    color: "#0d9488",
    textColor: "#ffffff",
    alliance: "NDA",
    allianceLabel: "NDA Alliance",
    leader: "T. T. V. Dhinakaran",
  },
  {
    id: "TMC",
    name: "TMC(M)",
    shortName: "TMC",
    fullName: "Tamil Maanila Congress (Moopanar)",
    color: "#f59e0b",
    textColor: "#000000",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "G. K. Vasan",
  },
  {
    id: "KMDK",
    name: "KMDK",
    shortName: "KMDK",
    fullName: "Kongunadu Makkal Desia Katchi",
    color: "#a16207",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "E. R. Eswaran",
  },
  {
    id: "IUML",
    name: "IUML",
    shortName: "IUML",
    fullName: "Indian Union Muslim League",
    color: "#047857",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "K. M. Kader Mohideen",
  },
  {
    id: "DMDK",
    name: "DMDK",
    shortName: "DMDK",
    fullName: "Desiya Murpokku Dravida Kazhagam",
    color: "#a855f7",
    textColor: "#ffffff",
    alliance: "OTHERS",
    allianceLabel: "Others",
    leader: "Premalatha Vijayakanth",
  },
  // MDMK is contesting on DMK's symbol in TN 2026 — votes / seats are
  // counted under DMK directly. We keep no separate MDMK party row;
  // partyById("MDMK") aliases to DMK below so any historical / external
  // reference still resolves.
  {
    id: "CPI",
    name: "CPI",
    shortName: "CPI",
    fullName: "Communist Party of India",
    color: "#b91c1c",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "R. Mutharasan",
  },
  {
    id: "CPM",
    name: "CPI(M)",
    shortName: "CPM",
    fullName: "Communist Party of India (Marxist)",
    color: "#991b1b",
    textColor: "#ffffff",
    alliance: "INDIA",
    allianceLabel: "Secular Progressive Alliance",
    leader: "K. Balakrishnan",
  },
  {
    id: "IND",
    name: "IND",
    shortName: "IND",
    fullName: "Independent",
    color: "#64748b",
    textColor: "#ffffff",
    alliance: "IND",
    allianceLabel: "Independent",
  },
  {
    id: "OTH",
    name: "Others",
    shortName: "OTH",
    fullName: "Others",
    color: "#475569",
    textColor: "#ffffff",
    alliance: "OTHERS",
    allianceLabel: "Others",
  },
  {
    id: "NOTA",
    name: "NOTA",
    shortName: "NOTA",
    fullName: "None of the Above",
    color: "#1e293b",
    textColor: "#94a3b8",
    alliance: "OTHERS",
    allianceLabel: "NOTA",
  },
];

export const ALLIANCES = {
  INDIA: {
    id: "INDIA",
    // Display name = "Secular Progressive Alliance" (SPA) — the actual
    // 2026 TN coalition name. Internal id stays "INDIA" so older code
    // references don't break.
    name: "Secular Progressive Alliance",
    shortName: "SPA",
    color: "#dc2626",
    parties: ["DMK", "INC", "VCK", "CPI", "CPM", "TMC", "KMDK", "IUML"],
  },
  NDA: {
    id: "NDA",
    name: "NDA Alliance",
    color: "#16a34a",
    parties: ["AIADMK", "BJP", "PMK", "AMMK"],
  },
  TVK: { id: "TVK", name: "TVK", color: "#eab308", parties: ["TVK"] },
  NTK: { id: "NTK", name: "NTK", color: "#a855f7", parties: ["NTK"] },
  OTHERS: { id: "OTHERS", name: "Others", color: "#475569", parties: ["DMDK", "OTH", "NOTA"] },
  IND: { id: "IND", name: "Independent", color: "#64748b", parties: ["IND"] },
} as const;

/**
 * The 4 broadcast "blocs" that get the big leader cards. Each bloc maps an
 * alliance to its anchor party (for color + leader figure on the card). The
 * bloc total = sum of all member parties' totals, so an INC win shows as a
 * DMK-alliance seat in the hero card and the SwingMap.
 */
export const FOCUS_BLOCS: Array<{
  id: string;
  anchorPartyId: string;
  members: readonly string[];
  /** Full alliance name as it appears on broadcast chrome */
  label: string;
  /** Short tag — "SPA", "NDA", "TVK", "NTK" — for tight cells */
  shortLabel: string;
}> = [
  {
    id: "INDIA",
    anchorPartyId: "DMK",
    // MDMK contests on DMK's symbol → counted as DMK, not a separate row.
    // TMC(M), KMDK, IUML are SPA partners contesting on their own symbols.
    members: ["DMK", "INC", "VCK", "CPI", "CPM", "TMC", "KMDK", "IUML"],
    label: "Secular Progressive Alliance",
    shortLabel: "SPA",
  },
  {
    id: "NDA",
    anchorPartyId: "AIADMK",
    members: ["AIADMK", "BJP", "PMK", "AMMK", "DMDK"],
    label: "NDA Alliance",
    shortLabel: "NDA",
  },
  { id: "TVK", anchorPartyId: "TVK", members: ["TVK"], label: "TVK", shortLabel: "TVK" },
  { id: "NTK", anchorPartyId: "NTK", members: ["NTK"], label: "NTK", shortLabel: "NTK" },
];

/** Anchor party id for a bloc — used to color party hexes by alliance.
 *  Resolves aliases first (MDMK → DMK → SPA bloc) so legacy data flows
 *  through the same bucket as the canonical party. */
export function blocOf(partyId: string): string | null {
  const canon = PARTY_ALIAS[partyId] ?? partyId;
  for (const b of FOCUS_BLOCS) {
    if (b.members.includes(canon)) return b.anchorPartyId;
  }
  return null;
}

export const MAJORITY_MARK = 118;
export const TOTAL_SEATS = 234;

// Aliases — when an upstream id has been merged or renamed but the data
// might still surface the old id. Lookup falls through to PARTIES.
const PARTY_ALIAS: Record<string, string> = {
  // MDMK contests on DMK's symbol in TN 2026, so any "MDMK" candidate row
  // is treated as DMK across the dashboard.
  MDMK: "DMK",
};

export const partyById = (id: string): Party => {
  const resolved = PARTY_ALIAS[id] ?? id;
  return PARTIES.find((p) => p.id === resolved) ?? PARTIES.find((p) => p.id === "OTH")!;
};

/** Resolve a possibly-aliased party id to its canonical id (e.g. MDMK → DMK). */
export const canonicalPartyId = (id: string): string => PARTY_ALIAS[id] ?? id;
