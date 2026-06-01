"use client";
import { partyById, MAJORITY_MARK } from "@/lib/parties";
import type { PartyTally } from "@/lib/schema";
import { cn, formatNumber } from "@/lib/cn";

export function PartyLeaderCard({
  tally,
  rank,
}: {
  tally: PartyTally;
  rank: number;
}) {
  const party = partyById(tally.partyId);
  const reachedMajority = tally.total >= MAJORITY_MARK;
  const pctOfMajority = Math.min(100, (tally.total / MAJORITY_MARK) * 100);

  return (
    <div
      className={cn(
        "card p-4 sm:p-5 relative overflow-hidden",
        rank === 0 && "ring-1 ring-[var(--accent-lead)]",
      )}
      style={{ borderColor: rank <= 1 ? party.color : undefined }}
    >
      {/* Color stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ background: party.color }}
      />

      <div className="flex items-start justify-between gap-3 mb-3 ml-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Rank #{rank + 1}
          </div>
          <div className="font-bold text-lg truncate" style={{ color: party.color }}>
            {party.name}
          </div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            {party.fullName}
          </div>
        </div>
        {reachedMajority && (
          <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--accent-won)] text-[#03130a] whitespace-nowrap">
            Majority
          </div>
        )}
      </div>

      <div className="ml-2 flex items-baseline gap-3">
        <div className="text-5xl font-black tabular leading-none">{tally.total}</div>
        <div className="text-xs text-[var(--text-secondary)]">
          <div>
            <span className="text-[var(--accent-won)] font-semibold tabular">{tally.won}</span> won
          </div>
          <div>
            <span className="text-[var(--accent-lead)] font-semibold tabular">{tally.leading}</span> leading
          </div>
        </div>
      </div>

      {/* Progress to majority */}
      <div className="ml-2 mt-4">
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
          <span>Path to majority</span>
          <span className="tabular">{tally.total} / {MAJORITY_MARK}</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-base)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctOfMajority}%`, background: party.color }}
          />
        </div>
      </div>

      {tally.voteShare > 0 && (
        <div className="ml-2 mt-3 text-xs text-[var(--text-secondary)]">
          Vote share: <span className="text-[var(--text-primary)] tabular font-semibold">{tally.voteShare.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}
