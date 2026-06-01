"use client";
import { useEffect, useMemo, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { partyById, blocOf } from "@/lib/parties";
import type { ConstituencySummary } from "@/lib/schema";

const PENDING_COLOR = "rgba(180,200,225,0.32)";
const STALE_COLOR = "rgba(255,255,255,0.06)";
const STROKE = "rgba(255,255,255,0.18)";

type TnMapData = {
  shapes: Array<{ acId: number; d: string; cx: number; cy: number }>;
  width: number;
  height: number;
};

/**
 * "Last rounds" map — the same TN polygons as TnMap, but coloured by
 * RECENCY of update so the anchor can see which seats just moved.
 *
 * Three visual tiers, oldest to freshest:
 *   - STALE  (no update in last RECENT_WINDOW_MS): dim grey, viewer
 *            can still see the TN outline but it's clearly background.
 *   - WARM   (changed in window, current round still in progress):
 *            full alliance colour, no animation.
 *   - HOT    (declared OR changed in last HOT_WINDOW_MS): full alliance
 *            colour + pulsing white outline glow. "Look at this seat."
 *
 * Default windows are tuned for counting day where rounds tick every
 * few minutes statewide.
 */
const RECENT_WINDOW_MS = 8 * 60_000;  // 8 min — anything older is "stale"
const HOT_WINDOW_MS = 90_000;         // 90s — fresh enough to call out

export function RecentChangesMap({ variant = "scene" }: { variant?: "card" | "scene" }) {
  const [data, setData] = useState<TnMapData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    fetch("/api/tn-map").then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  // Tick every 5s so the recency colouring updates without a reload —
  // an AC that was HOT 2 min ago drifts to WARM, then STALE.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const { constituencies } = useLiveData();
  const stateByAc = useMemo(() => {
    const m = new Map<number, ConstituencySummary>();
    for (const c of constituencies) m.set(c.constituencyId, c);
    return m;
  }, [constituencies]);

  // Counts for the header chips
  const counts = useMemo(() => {
    let hot = 0;
    let warm = 0;
    let stale = 0;
    let pending = 0;
    for (const c of constituencies) {
      const tier = recencyTier(c, now);
      if (tier === "pending") pending++;
      else if (tier === "hot") hot++;
      else if (tier === "warm") warm++;
      else stale++;
    }
    return { hot, warm, stale, pending };
  }, [constituencies, now]);

  if (!data) {
    return (
      <div className="card p-6 h-full grid place-items-center">
        <div className="text-[var(--text-muted)] text-sm">Loading TN map…</div>
      </div>
    );
  }

  return (
    <div className={variant === "scene" ? "card p-3 h-full flex flex-col" : "card p-4"}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2 shrink-0">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
          🔥 Last-rounds activity
        </h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <Chip label="Hot" count={counts.hot} color="#ef4444" pulse />
          <Chip label="Warm" count={counts.warm} color="#f97316" />
          <Chip label="Stale" count={counts.stale} color="#94a3b8" />
          <Chip label="Pending" count={counts.pending} color="#475569" />
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <svg
          viewBox={`0 0 ${data.width} ${data.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          <defs>
            <filter id="hot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Pulse animation — opacity wobble for HOT shapes. */}
            <style>{`
              @keyframes recentPulse {
                0%   { opacity: 0.55; }
                50%  { opacity: 1; }
                100% { opacity: 0.55; }
              }
              .pulse-hot { animation: recentPulse 1.1s ease-in-out infinite; }
            `}</style>
          </defs>
          {data.shapes.map((shape) => {
            const ac = stateByAc.get(shape.acId);
            const tier = ac ? recencyTier(ac, now) : "pending";
            const fill = colorForTier(tier, ac);
            return (
              <g key={shape.acId}>
                <path
                  d={shape.d}
                  fill={fill}
                  stroke={STROKE}
                  strokeWidth={0.4}
                  fillOpacity={tier === "hot" ? 0.95 : tier === "warm" ? 0.85 : 0.5}
                />
                {tier === "hot" && (
                  <path
                    d={shape.d}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="pulse-hot"
                    filter="url(#hot-glow)"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-[var(--text-muted)] mt-2 text-center shrink-0">
        🔥 Hot = updated in last 90s · 🟧 Warm = within 8 min · ⬜ Stale =
        called earlier · pending = no result yet
      </div>
    </div>
  );
}

type Tier = "pending" | "hot" | "warm" | "stale";

function recencyTier(c: ConstituencySummary, now: number): Tier {
  if (c.status === "pending" || !c.updatedAt) return "pending";
  const age = now - c.updatedAt;
  if (age <= HOT_WINDOW_MS) return "hot";
  if (age <= RECENT_WINDOW_MS) return "warm";
  return "stale";
}

function colorForTier(tier: Tier, ac?: ConstituencySummary): string {
  if (tier === "pending") return PENDING_COLOR;
  if (tier === "stale") {
    // Still show the alliance color but very dim
    if (!ac?.leadingCandidate) return STALE_COLOR;
    const blocId = blocOf(ac.leadingCandidate.partyId);
    if (!blocId) return STALE_COLOR;
    return partyById(blocId).color;
  }
  // hot / warm — full alliance color
  if (!ac?.leadingCandidate) return PENDING_COLOR;
  const blocId = blocOf(ac.leadingCandidate.partyId);
  if (!blocId) return "#94a3b8";
  return partyById(blocId).color;
}

function Chip({
  label,
  count,
  color,
  pulse = false,
}: {
  label: string;
  count: number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={"px-2 py-0.5 rounded-md font-bold tabular " + (pulse && count > 0 ? "animate-pulse" : "")}
      style={{
        background: `${color}20`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {label} {count}
    </div>
  );
}
