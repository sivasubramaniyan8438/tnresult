"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useLiveData } from "./LiveDataProvider";
import { partyById } from "@/lib/parties";
import { formatNumber } from "@/lib/cn";
import { TickingNumber } from "./TickingNumber";

/**
 * Knife-edge feed — drama compressed into three margin tiers:
 *   🔥 RAZOR  (margin < 500)   — pulsing red, "anything could happen"
 *   ⚡ KNIFE  (margin < 2,000)  — orange, "watch this seat"
 *   👀 WATCH  (margin < 5,000)  — yellow, "still in play"
 *
 * Counters at the top show how many seats are in each tier — a single
 * number anchors love to read out ("47 seats are within five-thousand
 * votes right now"). Compounds in dramatic value through the day as
 * recounts and recounts surface ever-tighter races.
 */
export function KnifeEdge({
  variant = "card",
  limit = 12,
}: {
  variant?: "card" | "scene";
  limit?: number;
}) {
  const { constituencies } = useLiveData();

  const { razor, knife, watch, tiered } = useMemo(() => {
    const inFlight = constituencies.filter(
      (c) =>
        (c.status === "leading" || c.status === "counting") &&
        c.leadingCandidate &&
        c.leadingCandidate.margin > 0,
    );
    const sorted = [...inFlight].sort(
      (a, b) => a.leadingCandidate!.margin - b.leadingCandidate!.margin,
    );
    const razor = sorted.filter((c) => c.leadingCandidate!.margin < 500);
    const knife = sorted.filter(
      (c) => c.leadingCandidate!.margin >= 500 && c.leadingCandidate!.margin < 2000,
    );
    const watch = sorted.filter(
      (c) => c.leadingCandidate!.margin >= 2000 && c.leadingCandidate!.margin < 5000,
    );
    return { razor, knife, watch, tiered: sorted.slice(0, limit) };
  }, [constituencies, limit]);

  const isScene = variant === "scene";

  return (
    <div className={isScene ? "h-full overflow-auto" : "card p-4"}>
      {!isScene && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            🪒 Knife edge — closest races
          </h3>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Live
          </span>
        </div>
      )}

      {/* Tier counters — the single most narratable line on this feed */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <TierCounter
          glyph="🔥"
          label="Razor (<500)"
          count={razor.length}
          color="#ef4444"
          pulse
        />
        <TierCounter
          glyph="⚡"
          label="Knife (<2k)"
          count={knife.length}
          color="#f97316"
        />
        <TierCounter
          glyph="👀"
          label="Watch (<5k)"
          count={watch.length}
          color="#eab308"
        />
      </div>

      {tiered.length === 0 ? (
        <div className="text-center text-[var(--text-muted)] text-sm py-8">
          No races within 5,000 votes yet — keep an eye as counting tightens.
        </div>
      ) : (
        <div className={isScene ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-1.5"}>
          {tiered.map((c, i) => (
            <KnifeRow key={c.constituencyId} c={c} rank={i + 1} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}

function TierCounter({
  glyph,
  label,
  count,
  color,
  pulse = false,
}: {
  glyph: string;
  label: string;
  count: number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}55`,
      }}
    >
      <div
        className={
          "text-[10px] uppercase tracking-wider font-bold " +
          (pulse && count > 0 ? "animate-pulse" : "")
        }
        style={{ color }}
      >
        {glyph} {label}
      </div>
      <div
        className="text-2xl font-black tabular leading-none mt-0.5"
        style={{ color }}
      >
        <TickingNumber value={count} />
      </div>
    </div>
  );
}

function KnifeRow({
  c,
  rank,
  variant,
}: {
  c: ReturnType<typeof useLiveData>["constituencies"][number];
  rank: number;
  variant: "card" | "scene";
}) {
  const lead = c.leadingCandidate!;
  const trail = c.trailingCandidate;
  const leadParty = partyById(lead.partyId);
  const trailParty = trail ? partyById(trail.partyId) : null;
  const m = lead.margin;
  const tier = m < 500 ? "razor" : m < 2000 ? "knife" : "watch";
  const tierColor =
    tier === "razor" ? "#ef4444" : tier === "knife" ? "#f97316" : "#eab308";
  const tierGlyph = tier === "razor" ? "🔥" : tier === "knife" ? "⚡" : "👀";

  return (
    <Link
      href={`/broadcast/ac/${c.constituencyId}`}
      className={
        "block rounded-md transition-colors hover:bg-white/5 " +
        (variant === "scene"
          ? "p-3 bg-black/30 border border-white/10"
          : "px-2 py-1.5")
      }
      style={
        tier === "razor"
          ? { boxShadow: `0 0 12px -4px ${tierColor}88`, borderColor: `${tierColor}66` }
          : undefined
      }
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${tierColor}25`, color: tierColor }}
        >
          {tierGlyph} #{rank}
        </span>
        <span className="font-black text-sm truncate">{c.constituencyName}</span>
        <span className="text-[10px] text-[var(--text-muted)] tabular">
          R{c.round}/{c.totalRounds || "?"}
        </span>
        <span
          className={
            "ml-auto font-black tabular tracking-tight " +
            (variant === "scene" ? "text-2xl" : "text-base")
          }
          style={{ color: tierColor }}
        >
          {formatNumber(m)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
        <span style={{ color: leadParty.color }} className="font-bold">
          {leadParty.shortName ?? leadParty.name}
        </span>
        <span className="text-[var(--text-muted)]">vs</span>
        {trailParty ? (
          <span style={{ color: trailParty.color }} className="font-bold">
            {trailParty.shortName ?? trailParty.name}
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
        <span className="text-[var(--text-muted)] truncate ml-1">· {c.district}</span>
      </div>
    </Link>
  );
}
