"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { partyById, blocOf } from "@/lib/parties";
import { TickingNumber } from "./TickingNumber";

const PENDING_COLOR = "rgba(180,200,225,0.32)";
const STROKE = "rgba(255,255,255,0.18)";

type TnMapData = {
  shapes: Array<{ acId: number; d: string; cx: number; cy: number }>;
  width: number;
  height: number;
};

type FlipEvent = {
  acId: number;
  fromBlocId: string | null; // null = was pending
  toBlocId: string | null;   // null = went pending (rare; shouldn't happen)
  fromColor: string;
  toColor: string;
  at: number;
};

const FLIP_WINDOW_MS = 10 * 60_000; // 10 min

/**
 * Leader-flip map — highlights ACs that have CHANGED THEIR LEADING
 * BLOC in the last 10 minutes. Different from RecentChangesMap (which
 * shows activity / vote-count updates) — this only fires when the
 * actual winner / leader has shifted from one alliance to another,
 * the wave-detection signal.
 *
 * Tracks per-AC bloc history in a useRef so flips persist for the
 * lifetime of the browser tab. First 10 min of a fresh session shows
 * no flips (no history yet) — that's expected.
 */
export function LeaderFlipMap({ variant = "scene" }: { variant?: "scene" | "card" }) {
  const [mapData, setMapData] = useState<TnMapData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { constituencies } = useLiveData();
  // acId → current leader bloc + flip history (last 10 min)
  const leaderRef = useRef<Map<number, string | null>>(new Map());
  const flipsRef = useRef<FlipEvent[]>([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    fetch("/api/tn-map").then((r) => r.json()).then(setMapData).catch(() => {});
  }, []);

  // Tick every 5s so flips age out + re-render colors
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  // Detect flips on every constituencies update.
  // Records flip events when the leading bloc changes for an AC.
  useEffect(() => {
    const t = Date.now();
    const prev = leaderRef.current;
    const newFlips: FlipEvent[] = [];
    for (const c of constituencies) {
      const currentBloc = c.leadingCandidate ? blocOf(c.leadingCandidate.partyId) : null;
      const prevBloc = prev.has(c.constituencyId) ? prev.get(c.constituencyId)! : undefined;
      if (prevBloc === undefined) {
        // First time we see this AC — record its current bloc, don't
        // count as a flip (going from "no data" to "leader X" is not
        // a flip in the political sense).
        prev.set(c.constituencyId, currentBloc);
        continue;
      }
      if (
        prevBloc !== null &&
        currentBloc !== null &&
        prevBloc !== currentBloc
      ) {
        // GENUINE political flip: was led by bloc X (not pending),
        // now led by bloc Y (also not pending), Y != X. The "first
        // ever leader" case (null → bloc) is intentionally NOT a flip.
        const fromColor = partyById(prevBloc).color;
        const toColor = partyById(currentBloc).color;
        newFlips.push({
          acId: c.constituencyId,
          fromBlocId: prevBloc,
          toBlocId: currentBloc,
          fromColor,
          toColor,
          at: t,
        });
        prev.set(c.constituencyId, currentBloc);
      } else if (prevBloc !== currentBloc) {
        // Quietly update prev when transitioning involves null
        // (first-ever leader, or recount nullified) — don't count.
        prev.set(c.constituencyId, currentBloc);
      }
    }
    if (newFlips.length > 0) {
      flipsRef.current = [...flipsRef.current, ...newFlips];
      forceRender((x) => x + 1);
    }
  }, [constituencies]);

  // Active flips = those within FLIP_WINDOW_MS of now
  const activeFlips = useMemo(() => {
    const cutoff = now - FLIP_WINDOW_MS;
    return flipsRef.current.filter((f) => f.at >= cutoff);
  }, [now, flipsRef.current.length]); // length triggers when new flips push

  // Build per-AC summary: most recent flip per AC, sort by recency
  const flipByAc = useMemo(() => {
    const m = new Map<number, FlipEvent>();
    for (const f of activeFlips) {
      // Latest flip wins (overwrite any earlier flip for same AC)
      m.set(f.acId, f);
    }
    return m;
  }, [activeFlips]);

  // Direction breakdown for the header chip — most common from→to pair
  const directionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of flipByAc.values()) {
      const key = `${f.fromBlocId ?? "—"} → ${f.toBlocId ?? "—"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [flipByAc]);

  if (!mapData) {
    return (
      <div className="card p-6 h-full grid place-items-center">
        <div className="text-[var(--text-muted)] text-sm">Loading TN map…</div>
      </div>
    );
  }

  const totalFlips = flipByAc.size;
  return (
    <div className={variant === "scene" ? "card p-3 h-full flex flex-col" : "card p-4"}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2 shrink-0">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
          🔄 Leader-flip map · last 10 min
        </h3>
        <div className="flex items-center gap-2">
          <div
            className="px-2 py-0.5 rounded font-bold text-[11px] uppercase tracking-wider"
            style={{
              background: totalFlips > 0 ? "#ef444425" : "rgba(255,255,255,0.05)",
              color: totalFlips > 0 ? "#fca5a5" : "rgba(255,255,255,0.5)",
              border: `1px solid ${totalFlips > 0 ? "#ef444466" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <TickingNumber value={totalFlips} /> flipped
          </div>
        </div>
      </div>

      {/* Direction breakdown — "DMK → AIADMK 6 · AIADMK → TVK 2" */}
      {directionCounts.length > 0 && (
        <div className="mb-2 flex items-center gap-3 flex-wrap text-[11px] shrink-0">
          {directionCounts.slice(0, 4).map(([key, count]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="font-mono uppercase tracking-wider text-white/55">
                {key}
              </span>
              <span className="font-black tabular text-amber-300">{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <svg
          viewBox={`0 0 ${mapData.width} ${mapData.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          <defs>
            <filter id="flip-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <style>{`
              @keyframes flipPulse {
                0%   { stroke-opacity: 0.55; stroke-width: 1.5; }
                50%  { stroke-opacity: 1;    stroke-width: 2.8; }
                100% { stroke-opacity: 0.55; stroke-width: 1.5; }
              }
              .pulse-flip { animation: flipPulse 1.4s ease-in-out infinite; }
            `}</style>
          </defs>
          {/* Pass 1: ALL polygons rendered in neutral grey as faint
              geographic context. The eye reads "Tamil Nadu shape" but
              not "this AC is for X party" — so coloured flips pop. */}
          {mapData.shapes.map((shape) => (
            <path
              key={`base-${shape.acId}`}
              d={shape.d}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={0.3}
            />
          ))}
          {/* Pass 2: ONLY flipped ACs, drawn on top with strong fill +
              pulsing colored outline. Anchor's eye lands here. */}
          {mapData.shapes.map((shape) => {
            const flip = flipByAc.get(shape.acId);
            if (!flip) return null;
            return (
              <g key={`flip-${shape.acId}`}>
                {/* Strong fill in the NEW (current) leader colour */}
                <path
                  d={shape.d}
                  fill={flip.toColor}
                  fillOpacity={0.92}
                  stroke={flip.toColor}
                  strokeWidth={1.5}
                  filter="url(#flip-glow)"
                />
                {/* Pulsing outline reinforces the change */}
                <path
                  d={shape.d}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  className="pulse-flip"
                  opacity={0.9}
                />
                {/* Centroid marker — small dot in the FROM bloc colour
                    so the viewer sees the colour change at a glance.
                    Inner dot = old; outer ring = new. */}
                <circle cx={shape.cx} cy={shape.cy} r={4.5} fill={flip.toColor} stroke="#ffffff" strokeWidth={1} />
                <circle cx={shape.cx} cy={shape.cy} r={2} fill={flip.fromColor} />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-[10px] text-[var(--text-muted)] mt-2 text-center shrink-0 leading-snug">
        Coloured polygons = ACs whose leading bloc changed in the last 10 min ·
        centroid dot shows old → new (inner old colour, outer ring new colour) ·
        rest of map dimmed to grey for context.
        First 10 min of any session shows nothing — flips need history to detect.
      </div>
    </div>
  );
}
