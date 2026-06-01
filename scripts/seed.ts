import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db";
import { PARTIES } from "../lib/parties";

type ConstituencyJson = {
  id: number;
  name: string;
  district: string;
  reservation: "GEN" | "SC" | "ST";
};

const CONSTITUENCIES_PATH = path.join(process.cwd(), "data", "constituencies.json");
const REAL_CANDIDATES_PATH = path.join(process.cwd(), "data", "candidates-real.json");

type RealCandidate = { name: string; party_id: string; party_raw?: string };
type RealAcEntry = {
  officialId: number;
  officialName: string;
  candidates: RealCandidate[];
};

function loadRealCandidates(): Map<number, RealCandidate[]> {
  const m = new Map<number, RealCandidate[]>();
  if (!fs.existsSync(REAL_CANDIDATES_PATH)) return m;
  try {
    const raw = JSON.parse(fs.readFileSync(REAL_CANDIDATES_PATH, "utf-8")) as RealAcEntry[];
    for (const e of raw) {
      if (e.candidates && e.candidates.length) m.set(e.officialId, e.candidates);
    }
    console.log(`📥 Loaded real candidates for ${m.size} ACs from candidates-real.json`);
  } catch (err) {
    console.warn("⚠️  Failed to load candidates-real.json:", err);
  }
  return m;
}

// Sample candidate names — replace with real candidates after ECI publishes the list.
// For each constituency we generate a slate from major parties so the UI is realistic.
const SAMPLE_FIRST_NAMES = [
  "M.", "S.", "K.", "R.", "P.", "V.", "T.", "N.", "C.", "A.",
  "G.", "B.", "D.", "J.", "L.",
];
const SAMPLE_SURNAMES = [
  "Murugan", "Selvam", "Kumar", "Rajan", "Subramanian", "Pandian", "Ravi",
  "Karthik", "Saravanan", "Mohan", "Anbu", "Velu", "Krishnan", "Raja",
  "Stalin", "Annadurai", "Manoharan", "Sundaram", "Palaniswami", "Periyasamy",
  "Vijayan", "Senthil", "Prabakaran", "Arumugam", "Dhanasekaran",
];

function pseudoRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function makeName(rng: () => number, salt: number): string {
  const f = SAMPLE_FIRST_NAMES[Math.floor(rng() * SAMPLE_FIRST_NAMES.length)];
  const s = SAMPLE_SURNAMES[Math.floor(rng() * SAMPLE_SURNAMES.length)];
  return `${f} ${s}`;
}

// Slate per constituency — major parties always present, plus some IND
const CORE_PARTIES = ["DMK", "AIADMK", "BJP", "INC", "TVK", "NTK", "VCK", "PMK"];

function buildSlate(rng: () => number): string[] {
  // DMK and AIADMK always run; TVK contests all from 2026; mix others
  const slate = new Set<string>(["DMK", "AIADMK", "TVK", "NTK"]);
  // Alliance partners contest a subset
  if (rng() > 0.5) slate.add("BJP");
  if (rng() > 0.6) slate.add("INC");
  if (rng() > 0.7) slate.add("VCK");
  if (rng() > 0.7) slate.add("PMK");
  if (rng() > 0.85) slate.add("DMDK");
  if (rng() > 0.9) slate.add("MDMK");
  // 1-3 independents
  const indCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < indCount; i++) slate.add(`IND_${i}`);
  return Array.from(slate);
}

function main() {
  const db = getDb();

  const raw = fs.readFileSync(CONSTITUENCIES_PATH, "utf-8");
  const constituencies = JSON.parse(raw) as ConstituencyJson[];
  const realByAc = loadRealCandidates();

  console.log(`Seeding ${constituencies.length} constituencies...`);

  const insertConstituency = db.prepare(
    "INSERT OR REPLACE INTO constituencies(id, name, district, reservation) VALUES (?, ?, ?, ?)",
  );
  const insertCandidate = db.prepare(
    "INSERT INTO candidates(constituency_id, name, party_id, sequence) VALUES (?, ?, ?, ?)",
  );
  const insertResult = db.prepare(
    "INSERT OR REPLACE INTO results(candidate_id, constituency_id, votes, round, updated_at) VALUES (?, ?, 0, 0, 0)",
  );
  const insertState = db.prepare(
    "INSERT OR REPLACE INTO constituency_state(constituency_id, status, round, total_rounds, total_votes, updated_at) VALUES (?, 'pending', 0, ?, 0, 0)",
  );

  const tx = db.transaction((items: ConstituencyJson[]) => {
    db.exec("DELETE FROM round_history");
    db.exec("DELETE FROM results");
    db.exec("DELETE FROM constituency_state");
    db.exec("DELETE FROM candidates");
    db.exec("DELETE FROM constituencies");

    for (const c of items) {
      insertConstituency.run(c.id, c.name, c.district, c.reservation);
      const totalRounds = 18 + Math.floor((c.id * 7) % 6); // 18-23 rounds
      insertState.run(c.id, totalRounds);

      const real = realByAc.get(c.id);
      if (real && real.length) {
        // Use real candidates, but keep the seed's ordering: major parties first
        const order = ["DMK", "AIADMK", "TVK", "NTK", "BJP", "INC", "VCK", "PMK", "DMDK", "MDMK", "CPI", "CPM"];
        const sorted = [...real].sort((a, b) => {
          const ia = order.indexOf(a.party_id);
          const ib = order.indexOf(b.party_id);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        let seq = 0;
        for (const cand of sorted) {
          seq++;
          const partyId = ["DMK", "AIADMK", "TVK", "NTK", "BJP", "INC", "VCK", "PMK", "DMDK", "MDMK", "CPI", "CPM", "IND"].includes(cand.party_id)
            ? cand.party_id
            : "OTH";
          const info = insertCandidate.run(c.id, cand.name, partyId, seq);
          const candidateId = info.lastInsertRowid as number;
          insertResult.run(candidateId, c.id);
        }
      } else {
        // Procedural fallback for unscraped ACs
        const rng = pseudoRandom(c.id * 31 + 7);
        const slate = buildSlate(rng);
        let seq = 0;
        for (const partyKey of slate) {
          seq++;
          const isInd = partyKey.startsWith("IND");
          const partyId = isInd ? "IND" : partyKey;
          const name = makeName(rng, seq);
          const info = insertCandidate.run(c.id, name, partyId, seq);
          const candidateId = info.lastInsertRowid as number;
          insertResult.run(candidateId, c.id);
        }
      }
    }
  });

  tx(constituencies);

  const candidateCount = db.prepare("SELECT COUNT(*) as n FROM candidates").get() as { n: number };
  console.log(`✅ Seeded ${constituencies.length} constituencies with ${candidateCount.n} candidates.`);
  console.log(`   ${realByAc.size} ACs use REAL candidate data (from MyNeta), ${constituencies.length - realByAc.size} use procedural fallback.`);
  console.log(`   ${PARTIES.length} parties tracked.`);
}

main();
