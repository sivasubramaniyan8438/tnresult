/**
 * Sanity checks for manual round entries. We WARN, never block — operator
 * decides. Counting day has weird real cases (recounts, corrections) that look
 * like errors but are valid; blocking entry would be worse than a wrong number
 * for 30 seconds.
 */
import { getDb } from "./db";

export type ValidationWarning = {
  level: "warn" | "info";
  candidateId?: number;
  message: string;
};

type CandidateUpdate = {
  candidateId: number;
  votes: number;
};

const BIG_JUMP_FACTOR = 5; // votes after / votes before > 5x → warn
const BIG_DELTA_ABS = 50_000; // absolute jump > 50k votes per round → warn

export function validateUpdate(
  constituencyId: number,
  round: number,
  candidates: CandidateUpdate[],
): ValidationWarning[] {
  const db = getDb();
  const warnings: ValidationWarning[] = [];

  // 1. round skip detection
  const stateRow = db
    .prepare("SELECT round, total_rounds FROM constituency_state WHERE constituency_id = ?")
    .get(constituencyId) as { round: number; total_rounds: number } | undefined;

  if (stateRow) {
    if (round > stateRow.round + 1 && stateRow.round > 0) {
      warnings.push({
        level: "warn",
        message: `Skipping round ${stateRow.round + 1}…${round - 1} — round was ${stateRow.round}, you set ${round}.`,
      });
    }
    if (round < stateRow.round) {
      warnings.push({
        level: "info",
        message: `Round ${round} is BEFORE the current round ${stateRow.round} — recount or correction?`,
      });
    }
    if (round > stateRow.total_rounds) {
      warnings.push({
        level: "warn",
        message: `Round ${round} exceeds total_rounds ${stateRow.total_rounds} for this AC.`,
      });
    }
  }

  // 2. per-candidate sanity vs current votes
  const cands = db
    .prepare(
      "SELECT c.id, c.name, r.votes FROM candidates c JOIN results r ON r.candidate_id = c.id WHERE c.constituency_id = ?",
    )
    .all(constituencyId) as Array<{ id: number; name: string; votes: number }>;

  const currentById = new Map(cands.map((c) => [c.id, c]));

  for (const update of candidates) {
    const current = currentById.get(update.candidateId);
    if (!current) continue;

    if (update.votes < current.votes && round >= (stateRow?.round ?? 0)) {
      warnings.push({
        level: "warn",
        candidateId: update.candidateId,
        message: `${current.name}: votes DECREASED from ${current.votes.toLocaleString()} → ${update.votes.toLocaleString()}.`,
      });
    }

    const delta = update.votes - current.votes;
    if (current.votes > 0 && update.votes / current.votes > BIG_JUMP_FACTOR) {
      warnings.push({
        level: "warn",
        candidateId: update.candidateId,
        message: `${current.name}: ${BIG_JUMP_FACTOR}× jump (${current.votes.toLocaleString()} → ${update.votes.toLocaleString()}). Typo?`,
      });
    }
    if (Math.abs(delta) > BIG_DELTA_ABS) {
      warnings.push({
        level: "warn",
        candidateId: update.candidateId,
        message: `${current.name}: huge delta of ${delta > 0 ? "+" : ""}${delta.toLocaleString()} votes in one round.`,
      });
    }
    if (update.votes < 0) {
      warnings.push({
        level: "warn",
        candidateId: update.candidateId,
        message: `${current.name}: negative vote count (${update.votes}).`,
      });
    }
  }

  // 3. unrealistic totals
  const totalAfter = candidates.reduce((s, c) => s + c.votes, 0);
  if (totalAfter > 5_000_000) {
    warnings.push({
      level: "warn",
      message: `Total votes ${totalAfter.toLocaleString()} exceeds plausible single-AC turnout. Check decimal places.`,
    });
  }

  return warnings;
}
