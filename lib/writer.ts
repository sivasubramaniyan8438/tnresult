import { getDb } from "./db";
import { publish } from "./events";
import { getStateSummary, getConstituencySummaries } from "./queries";
import { detectStorylines } from "./storylines";

export type WriteSource = "manual" | "scraper" | "simulator" | "bulk" | "agent";

export type RoundUpdate = {
  constituencyId: number;
  round: number;
  totalRounds?: number;
  status?: "pending" | "counting" | "leading" | "won";
  candidates: Array<{ candidateId: number; votes: number }>;
  actor?: string;
  source?: WriteSource;
  ip?: string;
  /**
   * Manual writes set this true to extend the manual-lock window so subsequent
   * scraper polls don't overwrite the human correction. Defaults to true for
   * source='manual'/'bulk'.
   */
  extendLock?: boolean;
};

export type ApplyResult =
  | { applied: true; reason?: undefined }
  | { applied: false; reason: "locked" | "stale-round" | "won-sticky" | "no-change" | "negative-votes" };

// Scraper writes are blocked if a manual write happened within this window.
// Counting day operators correct numbers in real time — the scraper should
// not undo their corrections by re-reading the (still-wrong) ECI feed.
const MANUAL_LOCK_MS = 5 * 60 * 1000; // 5 minutes

let lastBroadcast = 0;
let pendingBroadcast: NodeJS.Timeout | null = null;
let lastSnapshotTake = 0;

function scheduleBroadcast() {
  // Coalesce updates: at most one full snapshot every 200ms
  const now = Date.now();
  const elapsed = now - lastBroadcast;
  const delay = elapsed > 200 ? 0 : 200 - elapsed;
  if (pendingBroadcast) return;
  pendingBroadcast = setTimeout(() => {
    pendingBroadcast = null;
    lastBroadcast = Date.now();
    try {
      const state = getStateSummary();
      // Snapshot history every 30s for the trend chart
      if (lastBroadcast - lastSnapshotTake > 30000) {
        lastSnapshotTake = lastBroadcast;
        try {
          const db = getDb();
          const insert = db.prepare(
            "INSERT INTO state_history(created_at, party_id, total, vote_share) VALUES (?, ?, ?, ?)",
          );
          const tx = db.transaction(() => {
            for (const p of state.parties) {
              if (p.total > 0 || p.voteShare > 0) {
                insert.run(lastBroadcast, p.partyId, p.total, p.voteShare);
              }
            }
          });
          tx();
        } catch (err) {
          console.error("history snapshot failed:", err);
        }
      }
      const constituencies = getConstituencySummaries();
      const newStorylines = detectStorylines(state, constituencies);
      for (const s of newStorylines) {
        publish("storyline", s);
      }
      publish("update", { state, constituencies });
    } catch (err) {
      console.error("broadcast failed:", err);
    }
  }, delay);
}

export function applyRoundUpdate(update: RoundUpdate): ApplyResult {
  const db = getDb();
  const now = Date.now();
  const actor = (update.actor ?? "system").slice(0, 64);
  const source: WriteSource = update.source ?? "manual";
  const ip = update.ip ?? null;

  // Reject obviously bad data — negative votes are never valid.
  if (update.candidates.some((c) => c.votes < 0)) {
    return { applied: false, reason: "negative-votes" };
  }

  // Snapshot prior state — needed for conflict checks AND audit
  const priorState = db
    .prepare(
      "SELECT status, round, last_source, last_manual_at, locked_until FROM constituency_state WHERE constituency_id = ?",
    )
    .get(update.constituencyId) as
    | {
        status: string;
        round: number;
        last_source: string | null;
        last_manual_at: number;
        locked_until: number;
      }
    | undefined;

  const priorStatus = priorState?.status ?? "pending";
  const priorRound = priorState?.round ?? 0;
  const lastManualAt = priorState?.last_manual_at ?? 0;
  const lockedUntil = priorState?.locked_until ?? 0;

  // === CONFLICT RESOLUTION ===
  // PRIMARY sources (always win):  manual, bulk, agent
  // SECONDARY sources (defer):     scraper, simulator
  const isPrimary = source === "manual" || source === "bulk" || source === "agent";

  // 1. Secondary sources cannot overwrite a recent primary correction.
  if (!isPrimary) {
    const recentlyPrimary = now - lastManualAt < MANUAL_LOCK_MS;
    const explicitlyLocked = now < lockedUntil;
    if (recentlyPrimary || explicitlyLocked) {
      return { applied: false, reason: "locked" };
    }
    // Don't let scraper roll back a round (network blip serving stale page)
    if (update.round > 0 && update.round < priorRound) {
      return { applied: false, reason: "stale-round" };
    }
  }

  // 2. 'won' is sticky — once an AC is called, only an explicit reset can
  //    un-call it. Stops scraper from flipping a declared seat back.
  if (priorStatus === "won" && !isPrimary) {
    return { applied: false, reason: "won-sticky" };
  }

  // 3. No-op detection — if every candidate's votes match prior values AND
  //    round hasn't moved AND status isn't changing, skip the write. Avoids
  //    audit-log spam from a scraper polling a stalled ECI page. A status-
  //    only change (e.g. winner endpoint setting status='won' on existing
  //    vote totals) still flows through.
  const priorRows = db
    .prepare("SELECT candidate_id, votes FROM results WHERE constituency_id = ?")
    .all(update.constituencyId) as Array<{ candidate_id: number; votes: number }>;
  const priorById = new Map(priorRows.map((r) => [r.candidate_id, r.votes]));
  if (priorState && update.round === priorRound) {
    const votesUnchanged = update.candidates.every(
      (c) => priorById.get(c.candidateId) === c.votes,
    );
    const statusUnchanged = !update.status || update.status === priorStatus;
    if (votesUnchanged && statusUnchanged) return { applied: false, reason: "no-change" };
  }

  const totalVotes = update.candidates.reduce((sum, c) => sum + c.votes, 0);

  // Status auto-rule (operator override wins via update.status)
  // - 'won' takes priority forever (already returned above if prior was won)
  // - if explicit status passed → use it
  // - else infer from rounds
  const inferredStatus =
    update.totalRounds && update.round >= update.totalRounds
      ? "won"
      : update.round > 0
        ? "leading"
        : "counting";
  const status = update.status ?? inferredStatus;

  // Primary writes extend the lock so the scraper backs off
  const extendLock =
    update.extendLock !== undefined ? update.extendLock : isPrimary;
  const newManualAt = extendLock && isPrimary ? now : lastManualAt;
  const newLockedUntil =
    extendLock && isPrimary ? Math.max(lockedUntil, now + MANUAL_LOCK_MS) : lockedUntil;

  const tx = db.transaction(() => {
    const updateResult = db.prepare(
      "UPDATE results SET votes = ?, round = ?, updated_at = ? WHERE candidate_id = ?",
    );
    const insertHistory = db.prepare(
      "INSERT INTO round_history(constituency_id, candidate_id, round, votes, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const insertAudit = db.prepare(
      `INSERT INTO vote_audit(created_at, constituency_id, candidate_id, round, votes_before, votes_after, delta, status_before, status_after, actor, source, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const c of update.candidates) {
      const before = priorById.get(c.candidateId) ?? 0;
      updateResult.run(c.votes, update.round, now, c.candidateId);
      insertHistory.run(update.constituencyId, c.candidateId, update.round, c.votes, now);
      insertAudit.run(
        now,
        update.constituencyId,
        c.candidateId,
        update.round,
        before,
        c.votes,
        c.votes - before,
        priorStatus,
        status,
        actor,
        source,
        ip,
      );
    }

    db.prepare(
      `INSERT INTO constituency_state(constituency_id, status, round, total_rounds, total_votes, updated_at, last_actor, last_source, last_manual_at, locked_until)
       VALUES (?, ?, ?, COALESCE(?, 20), ?, ?, ?, ?, ?, ?)
       ON CONFLICT(constituency_id) DO UPDATE SET
         status = excluded.status,
         round = excluded.round,
         total_rounds = COALESCE(?, total_rounds),
         total_votes = excluded.total_votes,
         updated_at = excluded.updated_at,
         last_actor = excluded.last_actor,
         last_source = excluded.last_source,
         last_manual_at = excluded.last_manual_at,
         locked_until = excluded.locked_until`,
    ).run(
      update.constituencyId,
      status,
      update.round,
      update.totalRounds ?? null,
      totalVotes,
      now,
      actor,
      source,
      newManualAt,
      newLockedUntil,
      update.totalRounds ?? null,
    );
  });

  tx();
  scheduleBroadcast();
  return { applied: true };
}

/**
 * Emergency reset — wipes votes/rounds/state for a single AC and clears any
 * manual lock. Use only when you need to undo a botched data-entry session
 * for an AC. Audit log is preserved.
 */
export function resetConstituency(
  constituencyId: number,
  actor = "system",
  ip: string | null = null,
): { applied: boolean } {
  const db = getDb();
  const now = Date.now();

  const tx = db.transaction(() => {
    // Snapshot current candidate votes for the audit row
    const cur = db
      .prepare("SELECT candidate_id, votes FROM results WHERE constituency_id = ?")
      .all(constituencyId) as Array<{ candidate_id: number; votes: number }>;

    const insertAudit = db.prepare(
      `INSERT INTO vote_audit(created_at, constituency_id, candidate_id, round, votes_before, votes_after, delta, status_before, status_after, actor, source, ip)
       VALUES (?, ?, ?, 0, ?, 0, ?, ?, 'pending', ?, 'reset', ?)`,
    );
    const priorStateRow = db
      .prepare("SELECT status FROM constituency_state WHERE constituency_id = ?")
      .get(constituencyId) as { status: string } | undefined;
    for (const c of cur) {
      insertAudit.run(
        now,
        constituencyId,
        c.candidate_id,
        c.votes,
        -c.votes,
        priorStateRow?.status ?? null,
        actor,
        ip,
      );
    }

    db.prepare("UPDATE results SET votes = 0, round = 0, updated_at = ? WHERE constituency_id = ?")
      .run(now, constituencyId);
    db.prepare("DELETE FROM round_history WHERE constituency_id = ?").run(constituencyId);
    db.prepare(
      `UPDATE constituency_state
         SET status = 'pending', round = 0, total_votes = 0, updated_at = ?,
             last_actor = ?, last_source = 'reset',
             last_manual_at = 0, locked_until = 0
       WHERE constituency_id = ?`,
    ).run(now, actor, constituencyId);
  });

  tx();
  scheduleBroadcast();
  return { applied: true };
}
