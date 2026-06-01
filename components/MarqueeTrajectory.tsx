"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { partyById } from "@/lib/parties";
import { useLiveData } from "./LiveDataProvider";
import { formatIndian } from "@/lib/cn";

type RoundSnapshot = {
  round: number;
  votes: Record<string, number>;
};

type Detail = {
  constituency: { id: number; name: string; district: string };
  candidates: Array<{
    id: number;
    name: string;
    party_id: string;
    sequence: number;
    votes: number;
  }>;
  rounds: RoundSnapshot[];
};

type VipRow = {
  name: string;
  role: string;
  constituencyId: number;
  expectedParty: string;
};

/**
 * Marquee trajectory — round-by-round vote totals for the top VIP seats
 * (Stalin / EPS / Udhayanidhi / Vijay / Seeman / etc.). Lets the anchor
 * narrate "watch how Vijay's lead shrank from 32k to 8k between rounds
 * 6 and 12" — a story you can't tell with the headline number alone.
 *
 * Data path: GET /api/constituencies/{id} — already returns the
 * per-round vote counts via the round_history table.
 */
const POLL_MS = 8_000;

export function MarqueeTrajectory({ variant = "scene" }: { variant?: "scene" | "card" }) {
  const [vips, setVips] = useState<VipRow[]>([]);
  const [details, setDetails] = useState<Map<number, Detail>>(new Map());
  const [loading, setLoading] = useState(true);
  const { constituencies } = useLiveData();

  // Pull the marquee list from /api/vips, then poll details for each
  useEffect(() => {
    let active = true;
    fetch("/api/vips")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const list: VipRow[] = Array.isArray(j.vips)
          ? j.vips.slice(0, 8)
          : Array.isArray(j)
            ? j.slice(0, 8)
            : [];
        setVips(list);
      })
      .catch(() => setVips([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (vips.length === 0) return;
    let active = true;
    async function loadAll() {
      const next = new Map<number, Detail>();
      await Promise.all(
        vips.map(async (v) => {
          try {
            const r = await fetch(`/api/constituencies/${v.constituencyId}`);
            if (!r.ok) return;
            const d = (await r.json()) as Detail;
            next.set(v.constituencyId, d);
          } catch {
            /* skip */
          }
        }),
      );
      if (active) {
        setDetails(next);
        setLoading(false);
      }
    }
    loadAll();
    const t = setInterval(loadAll, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [vips]);

  const tiles = useMemo(
    () =>
      vips
        .map((v) => ({ vip: v, detail: details.get(v.constituencyId) }))
        .filter((x): x is { vip: VipRow; detail: Detail } => !!x.detail),
    [vips, details],
  );

  if (loading) {
    return (
      <div className="card p-6 grid place-items-center h-full">
        <div className="text-[var(--text-muted)] text-sm">Loading marquee races…</div>
      </div>
    );
  }

  return (
    <div className={variant === "scene" ? "card p-3 h-full overflow-hidden flex flex-col" : "card p-4"}>
      <div className="flex items-baseline justify-between mb-2 shrink-0">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
          📈 Marquee races · round-by-round
        </h3>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
          Auto-refresh 8s
        </span>
      </div>
      <div
        className={
          variant === "scene"
            ? "grid grid-cols-2 lg:grid-cols-3 gap-2 flex-1 min-h-0 overflow-auto"
            : "grid grid-cols-1 sm:grid-cols-2 gap-3"
        }
      >
        {tiles.length === 0 ? (
          <div className="text-[var(--text-muted)] text-sm col-span-full text-center py-8">
            No marquee race data yet.
          </div>
        ) : (
          tiles.map(({ vip, detail }) => (
            <TrajectoryTile
              key={vip.constituencyId}
              vip={vip}
              detail={detail}
              status={constituencies.find((c) => c.constituencyId === vip.constituencyId)?.status}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TrajectoryTile({
  vip,
  detail,
  status,
}: {
  vip: VipRow;
  detail: Detail;
  status?: string;
}) {
  const top2 = useMemo(() => {
    return [...detail.candidates]
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 2);
  }, [detail.candidates]);

  const series = useMemo(() => {
    const rounds = detail.rounds;
    if (rounds.length === 0) return null;
    const xs = rounds.map((r) => r.round);
    const lines = top2.map((cand) => {
      const ys = rounds.map((r) => r.votes[cand.id] ?? 0);
      return { cand, ys, party: partyById(cand.party_id) };
    });
    const yMax = Math.max(1, ...lines.flatMap((l) => l.ys));
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    return { xs, lines, xMin, xMax, yMax };
  }, [detail.rounds, top2]);

  const lead = top2[0];
  const trail = top2[1];
  const margin = lead && trail ? lead.votes - trail.votes : 0;
  const leadParty = lead ? partyById(lead.party_id) : null;
  const trailParty = trail ? partyById(trail.party_id) : null;

  return (
    <Link
      href={`/broadcast/ac/${vip.constituencyId}`}
      className="rounded-lg p-3 bg-black/30 border border-white/10 hover:border-white/30 transition-colors flex flex-col gap-1.5 min-w-0"
      title={`${detail.constituency.name} — ${detail.constituency.district}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-black truncate text-sm">{vip.name}</div>
        {status === "won" ? (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-won)]/25 text-[var(--accent-won)] font-bold">
            ✓ Called
          </span>
        ) : status === "leading" || status === "counting" ? (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-counting)]/25 text-[var(--accent-counting)] font-bold">
            Counting
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/8 text-white/55 font-bold">
            Pending
          </span>
        )}
      </div>
      <div className="text-[10px] text-[var(--text-muted)] truncate">
        {detail.constituency.name} · {detail.constituency.district}
      </div>

      {series && series.xs.length >= 1 ? (
        <div className="flex-1 min-h-0 mt-1">
          <Sparkline series={series} />
        </div>
      ) : (
        <div className="text-[11px] text-[var(--text-muted)] italic mt-1">
          Awaiting round 1…
        </div>
      )}

      <div className="flex items-baseline gap-2 mt-1.5 text-[11px] flex-wrap">
        {leadParty && (
          <span className="font-bold tabular" style={{ color: leadParty.color }}>
            {leadParty.shortName ?? leadParty.name} {formatIndian(lead!.votes)}
          </span>
        )}
        {trailParty && (
          <span className="font-bold tabular" style={{ color: trailParty.color }}>
            {trailParty.shortName ?? trailParty.name} {formatIndian(trail!.votes)}
          </span>
        )}
        {margin > 0 && (
          <span className="ml-auto font-black tabular text-amber-300">
            +{formatIndian(margin)}
          </span>
        )}
      </div>
    </Link>
  );
}

function Sparkline({
  series,
}: {
  series: {
    xs: number[];
    lines: Array<{ cand: { id: number; name: string }; ys: number[]; party: { color: string; shortName?: string; name: string } }>;
    xMin: number;
    xMax: number;
    yMax: number;
  };
}) {
  const W = 240;
  const H = 70;
  const PADX = 4;
  const PADY = 6;
  const xRange = Math.max(1, series.xMax - series.xMin);
  const xAt = (x: number) => PADX + ((x - series.xMin) / xRange) * (W - PADX * 2);
  const yAt = (y: number) => H - PADY - (y / series.yMax) * (H - PADY * 2);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      style={{ minHeight: 60 }}
    >
      {/* Baseline */}
      <line
        x1={PADX}
        y1={H - PADY}
        x2={W - PADX}
        y2={H - PADY}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={0.5}
      />
      {series.lines.map((l, i) => {
        const path = series.xs
          .map((x, idx) => `${idx === 0 ? "M" : "L"} ${xAt(x).toFixed(1)} ${yAt(l.ys[idx]).toFixed(1)}`)
          .join(" ");
        return (
          <g key={l.cand.id}>
            <path
              d={path}
              fill="none"
              stroke={l.party.color}
              strokeWidth={i === 0 ? 2.5 : 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={i === 0 ? 1 : 0.85}
            />
            {/* Final-point dot */}
            <circle
              cx={xAt(series.xs[series.xs.length - 1])}
              cy={yAt(l.ys[l.ys.length - 1])}
              r={2}
              fill={l.party.color}
            />
          </g>
        );
      })}
    </svg>
  );
}
