import { getDb } from "./db";
import { applyRoundUpdate } from "./writer";
import { clearChyron } from "./chyron";
import { clearStorylines } from "./storylines";

type Candidate = {
  id: number;
  constituency_id: number;
  party_id: string;
  sequence: number;
};

type ConstituencyMeta = {
  id: number;
  total_rounds: number;
};

// Per-party "strength" — drives which candidate wins each constituency.
// Tweak these to model different scenarios. MDMK is intentionally omitted
// (contests on DMK's symbol → counted as DMK).
const PARTY_STRENGTH: Record<string, number> = {
  DMK: 0.42,
  AIADMK: 0.36,
  TVK: 0.18,
  BJP: 0.08,
  INC: 0.05,
  NTK: 0.03,
  VCK: 0.04,
  PMK: 0.04,
  AMMK: 0.03,
  TMC: 0.02,
  KMDK: 0.015,
  IUML: 0.015,
  DMDK: 0.02,
  CPI: 0.015,
  CPM: 0.015,
  IND: 0.02,
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

// Major parties always contesting in 2026 — INDIA (DMK+) vs NDA (AIADMK+)
// vs TVK vs NTK. The MyNeta ingest tagged ~2,100 candidates as "IND" who
// either had no party label or whose party didn't match our taxonomy. For a
// realistic broadcast simulation we want winners from the actual race, so
// skip IND/OTH/NOTA when picking the winner — they never call a seat in the
// simulator. (On real counting day, ECI data lands via the writer with the
// correct party_id; the map then shows IND wherever an Independent actually
// wins.)
const NON_RACE_PARTIES = new Set(["IND", "OTH", "NOTA"]);

function pickWinner(candidates: Candidate[], constituencyId: number): number {
  // Weighted by party strength, biased by seed for stability across rounds
  const r = rng(constituencyId * 13);
  const inRace = candidates
    .map((c, i) => ({ i, c }))
    .filter(({ c }) => !NON_RACE_PARTIES.has(c.party_id));
  const pool = inRace.length > 0 ? inRace : candidates.map((c, i) => ({ i, c }));
  const weights = pool.map(({ c }) => {
    const base = PARTY_STRENGTH[c.party_id] ?? 0.01;
    // Add per-constituency variability so it's not always the strongest party
    const noise = 0.5 + r() * 1.5;
    return base * noise;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = r() * total;
  for (let j = 0; j < pool.length; j++) {
    pick -= weights[j];
    if (pick <= 0) return pool[j].i;
  }
  return pool[0].i;
}

export type SimulatorState = {
  running: boolean;
  intervalMs: number;
  currentTick: number;
  startedAt: number | null;
};

const g = globalThis as unknown as { __tnSim?: { state: SimulatorState; timer: NodeJS.Timeout | null } };
if (!g.__tnSim) g.__tnSim = { state: { running: false, intervalMs: 1500, currentTick: 0, startedAt: null }, timer: null };

export function getSimulatorState(): SimulatorState {
  return g.__tnSim!.state;
}

export function startSimulator(intervalMs = 1500) {
  const sim = g.__tnSim!;
  if (sim.state.running) return;
  sim.state = { running: true, intervalMs, currentTick: 0, startedAt: Date.now() };

  const db = getDb();
  const constituencies = db
    .prepare("SELECT constituency_id AS id, total_rounds FROM constituency_state ORDER BY constituency_id")
    .all() as ConstituencyMeta[];
  const candidatesByConstituency = new Map<number, Candidate[]>();
  const all = db
    .prepare("SELECT id, constituency_id, party_id, sequence FROM candidates ORDER BY constituency_id, sequence")
    .all() as Candidate[];
  for (const c of all) {
    if (!candidatesByConstituency.has(c.constituency_id))
      candidatesByConstituency.set(c.constituency_id, []);
    candidatesByConstituency.get(c.constituency_id)!.push(c);
  }

  const constituencyState = new Map<
    number,
    { round: number; totalRounds: number; winnerIdx: number; baseVotes: number[]; declared: boolean }
  >();
  for (const c of constituencies) {
    const cands = candidatesByConstituency.get(c.id) ?? [];
    const winnerIdx = pickWinner(cands, c.id);
    const r = rng(c.id * 31 + 11);
    // Each candidate gets a base "true vote share" 0..1
    const totalVoters = 180000 + Math.floor(r() * 120000); // 180k-300k turnout per AC
    const shares = cands.map((cand, idx) => {
      if (idx === winnerIdx) return 0.32 + r() * 0.18; // winner gets 32-50%
      const base = (PARTY_STRENGTH[cand.party_id] ?? 0.01) * (0.5 + r());
      return base;
    });
    const sumShares = shares.reduce((a, b) => a + b, 0);
    const baseVotes = shares.map((s) => Math.floor((s / sumShares) * totalVoters));

    constituencyState.set(c.id, {
      round: 0,
      totalRounds: c.total_rounds,
      winnerIdx,
      baseVotes,
      declared: false,
    });
  }

  const tick = () => {
    if (!sim.state.running) return;
    sim.state.currentTick++;

    // Each tick, advance ~10-25 random constituencies by 1 round
    const ids = Array.from(constituencyState.keys()).filter(
      (id) => !constituencyState.get(id)!.declared,
    );
    if (ids.length === 0) {
      stopSimulator();
      return;
    }

    // Stagger start: only ~30% of constituencies are "counting" at any time early on
    const earliness = Math.min(1, sim.state.currentTick / 30);
    const concurrent = Math.max(8, Math.floor(ids.length * (0.15 + earliness * 0.4)));
    const eligible: number[] = [];
    const r = rng(sim.state.currentTick * 17 + 3);
    for (let i = 0; i < ids.length; i++) {
      if (r() < concurrent / ids.length) eligible.push(ids[i]);
    }
    const advanceCount = Math.min(eligible.length, 12 + Math.floor(r() * 12));
    for (let i = 0; i < advanceCount; i++) {
      const id = eligible[Math.floor(r() * eligible.length)];
      const state = constituencyState.get(id)!;
      if (state.declared) continue;
      state.round++;
      const declared = state.round >= state.totalRounds;

      const cands = candidatesByConstituency.get(id)!;
      const progress = state.round / state.totalRounds;
      const candidates = cands.map((c, idx) => {
        const target = state.baseVotes[idx];
        // Add some round-to-round noise
        const noise = 0.95 + rng(id * 1000 + state.round * 7 + idx).call(null) * 0.1;
        return { candidateId: c.id, votes: Math.floor(target * progress * noise) };
      });

      applyRoundUpdate({
        constituencyId: id,
        round: state.round,
        totalRounds: state.totalRounds,
        status: declared ? "won" : "leading",
        candidates,
      });

      if (declared) state.declared = true;
    }

    sim.timer = setTimeout(tick, sim.state.intervalMs);
  };

  sim.timer = setTimeout(tick, sim.state.intervalMs);
}

export function stopSimulator() {
  const sim = g.__tnSim!;
  sim.state.running = false;
  if (sim.timer) {
    clearTimeout(sim.timer);
    sim.timer = null;
  }
}

export function resetSimulator() {
  stopSimulator();
  const db = getDb();
  db.exec("DELETE FROM round_history");
  db.prepare("UPDATE results SET votes = 0, round = 0, updated_at = 0").run();
  db.prepare("UPDATE constituency_state SET status = 'pending', round = 0, total_votes = 0, updated_at = 0").run();
  // Wipe in-memory storyline + chyron caches so old "FIRST RESULT", "TVK
  // OPENS ACCOUNT", "STUNNER: STALIN LOSES KOLATHUR" etc. don't keep
  // re-firing or showing on screen after a fresh sim run.
  clearStorylines();
  clearChyron();
  g.__tnSim!.state = { running: false, intervalMs: 1500, currentTick: 0, startedAt: null };
}
