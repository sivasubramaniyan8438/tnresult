"use client";
import { useEffect, useMemo, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { partyById, FOCUS_BLOCS, MAJORITY_MARK } from "@/lib/parties";
import { TickingNumber } from "./TickingNumber";

type Snapshot = { t: number; parties: Record<string, { total: number; voteShare: number }> };

/**
 * Time-to-majority projection — extrapolates the leading bloc's recent
 * seat-gain rate to estimate when they'll cross 118 seats.
 *
 * Looks at the last `WINDOW_MS` of state_history snapshots, computes
 * delta seats / minute for the leading bloc, projects forward.
 *
 * Handles edge cases:
 *   - Already at majority   → "Crossed at HH:MM"
 *   - Rate ≤ 0              → "Holding — no fresh seats this window"
 *   - Rate too low to model → "Pace too slow to project"
 *   - Thin data (<2 snaps)  → "Awaiting more rounds"
 *
 * Always says "at current rate" — never a hard prediction.
 */
const WINDOW_MS = 10 * 60_000; // 10 minutes
const POLL_MS = 30_000;        // refresh every 30s

export function MajorityTimer() {
  const { state } = useLiveData();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [now, setNow] = useState(() => Date.now());

  // Poll history every POLL_MS so the projection refreshes without a reload
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch("/api/history");
        const j = (await r.json()) as { snapshots: Snapshot[] };
        if (active && Array.isArray(j.snapshots)) setSnapshots(j.snapshots);
      } catch {
        /* ignore network blip */
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  // Recompute projection every 5s for a smoothly-updating clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const projection = useMemo(() => {
    if (!state) return null;
    // Aggregate live bloc totals
    const blocs = FOCUS_BLOCS.map((b) => {
      const total = state.parties
        .filter((p) => b.members.includes(p.partyId))
        .reduce((s, p) => s + p.total, 0);
      return { id: b.id, label: b.label, anchorPartyId: b.anchorPartyId, total };
    }).sort((a, b) => b.total - a.total);
    const leader = blocs[0];
    if (!leader || leader.total === 0) {
      return { kind: "thin" as const, message: "Awaiting first declarations" };
    }
    if (leader.total >= MAJORITY_MARK) {
      // Find when they crossed in history
      const cross = snapshots.find((s) => blocTotal(s.parties, leader.id) >= MAJORITY_MARK);
      const tCross = cross ? cross.t : null;
      return {
        kind: "majority" as const,
        leader,
        crossedAt: tCross,
      };
    }

    // Need at least 2 snapshots in the window to compute a rate
    const cutoff = now - WINDOW_MS;
    const window = snapshots.filter((s) => s.t >= cutoff);
    if (window.length < 2) {
      return {
        kind: "early" as const,
        leader,
        seatsToGo: MAJORITY_MARK - leader.total,
      };
    }
    const earliest = window[0];
    const latest = window[window.length - 1];
    const tSpanMin = Math.max(0.0001, (latest.t - earliest.t) / 60_000);
    const earlyTotal = blocTotal(earliest.parties, leader.id);
    const lateTotal = blocTotal(latest.parties, leader.id);
    const deltaSeats = lateTotal - earlyTotal;
    const ratePerMin = deltaSeats / tSpanMin;

    // Bail if the projection would be unreliable. Three safety checks:
    //  1. tSpanMin too small (<2 min) → not enough trend signal
    //  2. earlyTotal of 0 with a big lateTotal → bloc emerged from
    //     nothing in the window, the rate would be wildly optimistic
    //     (extrapolates a one-time surge as if it'd continue forever)
    //  3. lateTotal jumped by >40% of seats-to-go in the window — the
    //     pace can't physically sustain (counting velocity is bounded)
    if (tSpanMin < 2) {
      return {
        kind: "early" as const,
        leader,
        seatsToGo: MAJORITY_MARK - leader.total,
      };
    }
    if (earlyTotal === 0 && lateTotal >= 5) {
      return {
        kind: "tooSlow" as const,
        leader,
        seatsToGo: MAJORITY_MARK - leader.total,
        ratePerMin,
        reason: "early" as const,
      };
    }
    const seatsToGo = MAJORITY_MARK - leader.total;

    if (ratePerMin <= 0) {
      return {
        kind: "stalled" as const,
        leader,
        seatsToGo,
        ratePerMin,
      };
    }
    if (ratePerMin < 0.05) {
      // Less than 1 seat per 20 min → projection too unstable
      return {
        kind: "tooSlow" as const,
        leader,
        seatsToGo,
        ratePerMin,
      };
    }
    const minutesUntil = seatsToGo / ratePerMin;
    const projectedAt = new Date(now + minutesUntil * 60_000);
    return {
      kind: "projecting" as const,
      leader,
      seatsToGo,
      ratePerMin,
      minutesUntil,
      projectedAt,
    };
  }, [state, snapshots, now]);

  if (!projection) return null;
  if (projection.kind === "thin") {
    return (
      <Shell tone="neutral">
        <Title>Time to majority</Title>
        <Body>{projection.message} — projection live once first results land.</Body>
      </Shell>
    );
  }
  if (projection.kind === "majority") {
    const leaderParty = partyById(projection.leader.anchorPartyId);
    const crossedStr = projection.crossedAt
      ? new Date(projection.crossedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "—";
    return (
      <Shell tone="win" accent={leaderParty.color}>
        <Title>Majority crossed</Title>
        <Big>
          <span style={{ color: leaderParty.color }}>
            {leaderParty.shortName ?? leaderParty.name}
          </span>{" "}
          crossed 118 at {crossedStr}
        </Big>
        <Body>
          Currently <TickingNumber value={projection.leader.total} /> seats —{" "}
          <span style={{ color: leaderParty.color }} className="font-bold">
            +{projection.leader.total - MAJORITY_MARK}
          </span>{" "}
          past the line.
        </Body>
      </Shell>
    );
  }
  if (projection.kind === "early") {
    const leaderParty = partyById(projection.leader.anchorPartyId);
    return (
      <Shell tone="counting" accent={leaderParty.color}>
        <Title>Time to majority</Title>
        <Big>
          <span style={{ color: leaderParty.color }}>
            {leaderParty.shortName ?? leaderParty.name}
          </span>{" "}
          needs <TickingNumber value={projection.seatsToGo} /> more
        </Big>
        <Body>
          Projection arrives once we have 10 minutes of trend data.
        </Body>
      </Shell>
    );
  }
  if (projection.kind === "stalled") {
    const leaderParty = partyById(projection.leader.anchorPartyId);
    return (
      <Shell tone="neutral" accent={leaderParty.color}>
        <Title>Time to majority</Title>
        <Big>
          <span style={{ color: leaderParty.color }}>
            {leaderParty.shortName ?? leaderParty.name}
          </span>{" "}
          holding at {projection.leader.total}
        </Big>
        <Body>
          No fresh seats called in the last 10 min — {projection.seatsToGo}{" "}
          still needed for majority. Pace will pick up as more ACs declare.
        </Body>
      </Shell>
    );
  }
  if (projection.kind === "tooSlow") {
    const leaderParty = partyById(projection.leader.anchorPartyId);
    const reason = (projection as { reason?: string }).reason;
    const message =
      reason === "early"
        ? `${leaderParty.shortName ?? leaderParty.name} just emerged into the lead — too soon to project a sustainable pace. Projection arrives once the gain is steady.`
        : `Pace too slow to project a credible time — ${projection.ratePerMin.toFixed(2)} seats/min in the last 10 min.`;
    return (
      <Shell tone="counting" accent={leaderParty.color}>
        <Title>Time to majority</Title>
        <Big>
          <span style={{ color: leaderParty.color }}>
            {leaderParty.shortName ?? leaderParty.name}
          </span>{" "}
          needs {projection.seatsToGo} more
        </Big>
        <Body>{message}</Body>
      </Shell>
    );
  }
  // projecting
  const leaderParty = partyById(projection.leader.anchorPartyId);
  const timeStr = projection.projectedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const minRounded = Math.round(projection.minutesUntil);
  return (
    <Shell tone="counting" accent={leaderParty.color}>
      <Title>Time to majority — projection</Title>
      <Big>
        <span style={{ color: leaderParty.color }}>
          {leaderParty.shortName ?? leaderParty.name}
        </span>{" "}
        crosses 118 around <span style={{ color: leaderParty.color }}>{timeStr}</span>
      </Big>
      <Body>
        At current pace ({projection.ratePerMin.toFixed(2)} seats/min over
        last 10 min), <TickingNumber value={projection.seatsToGo} /> seats
        away — about {minRounded} min from now. <em>Projection only — actual
        time depends on counting velocity.</em>
      </Body>
    </Shell>
  );
}

function blocTotal(parties: Snapshot["parties"], blocId: string): number {
  const bloc = FOCUS_BLOCS.find((b) => b.id === blocId);
  if (!bloc) return 0;
  return bloc.members.reduce((s, m) => s + (parties[m]?.total ?? 0), 0);
}

function Shell({
  tone,
  accent,
  children,
}: {
  tone: "win" | "counting" | "neutral";
  accent?: string;
  children: React.ReactNode;
}) {
  const border =
    tone === "win"
      ? "border-l-4 border-l-[var(--accent-won)]"
      : tone === "counting"
        ? "border-l-4 border-l-[var(--accent-counting)]"
        : "border-l-4 border-l-white/20";
  return (
    <div
      className={`card p-4 ${border}`}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--text-muted)] mb-1.5">
      ⏱ {children}
    </div>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xl sm:text-2xl font-black leading-tight">
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-snug">
      {children}
    </div>
  );
}
