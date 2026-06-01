/**
 * Other-state aggregated totals (Kerala, West Bengal, Puducherry, Assam, etc.)
 * for the multi-state broadcast scene. TN is rendered live from constituency
 * data; everything else is manually maintained via /admin/states.
 *
 * No live counting → no audit log, no idempotency, no scraper interaction.
 * It's just "what number to show on the chyron" for each non-TN state.
 */
import { getDb } from "./db";

export type OtherStatePartyRow = {
  partyId: string;     // 'LDF' | 'UDF' | 'NDA' | 'TMC' | 'BJP' | ...
  label: string;       // 'LDF+', 'UDF+', 'NDA+'
  total: number;       // current leads/wins
  delta: number;       // change vs the prior election (negative = loss)
  color?: string;      // hex; falls back to bloc inference if absent
};

export type OtherState = {
  id: string;          // 'KL', 'WB', 'PY', 'AS'
  name: string;
  totalSeats: number;
  reportingSeats: number;
  parties: OtherStatePartyRow[];
  sequence: number;
  updatedAt: number;
};

const PRESETS: Array<Omit<OtherState, "updatedAt"> & { updatedAt?: number }> = [
  {
    id: "KL",
    name: "Kerala",
    totalSeats: 140,
    reportingSeats: 0,
    sequence: 1,
    parties: [
      { partyId: "LDF", label: "LDF+", total: 0, delta: 0, color: "#dc2626" },
      { partyId: "UDF", label: "UDF+", total: 0, delta: 0, color: "#0891b2" },
      { partyId: "NDA", label: "NDA+", total: 0, delta: 0, color: "#f97316" },
      { partyId: "OTH", label: "OTH",  total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "WB",
    name: "West Bengal",
    totalSeats: 294,
    reportingSeats: 0,
    sequence: 2,
    parties: [
      { partyId: "TMC", label: "TMC",   total: 0, delta: 0, color: "#16a34a" },
      { partyId: "BJP", label: "BJP+",  total: 0, delta: 0, color: "#f97316" },
      { partyId: "LEFT", label: "LEFT+", total: 0, delta: 0, color: "#dc2626" },
      { partyId: "OTH", label: "OTH",   total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "PY",
    name: "Puducherry",
    totalSeats: 30,
    reportingSeats: 0,
    sequence: 3,
    parties: [
      { partyId: "NDA", label: "NDA+",  total: 0, delta: 0, color: "#f97316" },
      { partyId: "INC", label: "INC+",  total: 0, delta: 0, color: "#2563eb" },
      { partyId: "OTH", label: "OTH",   total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "AS",
    name: "Assam",
    totalSeats: 126,
    reportingSeats: 0,
    sequence: 4,
    parties: [
      { partyId: "BJP", label: "BJP+",  total: 0, delta: 0, color: "#f97316" },
      { partyId: "INC", label: "INC+",  total: 0, delta: 0, color: "#2563eb" },
      { partyId: "OTH", label: "OTH",   total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
];

/** Idempotently seed the four common non-TN states. Existing rows are kept. */
export function seedOtherStatesIfEmpty() {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM other_states").get() as { n: number }).n;
  if (count > 0) return;
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO other_states (id, name, total_seats, reporting_seats, parties_json, sequence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of PRESETS) {
    insert.run(s.id, s.name, s.totalSeats, s.reportingSeats, JSON.stringify(s.parties), s.sequence, now);
  }
}

export function listOtherStates(): OtherState[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, name, total_seats, reporting_seats, parties_json, sequence, updated_at FROM other_states ORDER BY sequence, name",
    )
    .all() as Array<{
      id: string;
      name: string;
      total_seats: number;
      reporting_seats: number;
      parties_json: string;
      sequence: number;
      updated_at: number;
    }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    totalSeats: r.total_seats,
    reportingSeats: r.reporting_seats,
    parties: safeParseParties(r.parties_json),
    sequence: r.sequence,
    updatedAt: r.updated_at,
  }));
}

function safeParseParties(json: string): OtherStatePartyRow[] {
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v as OtherStatePartyRow[];
  } catch {
    /* ignore */
  }
  return [];
}

export function upsertOtherState(s: Omit<OtherState, "updatedAt">) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO other_states (id, name, total_seats, reporting_seats, parties_json, sequence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       total_seats = excluded.total_seats,
       reporting_seats = excluded.reporting_seats,
       parties_json = excluded.parties_json,
       sequence = excluded.sequence,
       updated_at = excluded.updated_at`,
  ).run(s.id, s.name, s.totalSeats, s.reportingSeats, JSON.stringify(s.parties), s.sequence, now);
}

export function deleteOtherState(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM other_states WHERE id = ?").run(id);
}
