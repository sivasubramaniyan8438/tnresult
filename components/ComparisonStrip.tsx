"use client";
import { partyById, TOTAL_SEATS } from "@/lib/parties";
import { buildComparisons, HISTORICAL_YEAR } from "@/lib/historical";
import type { PartyTally } from "@/lib/schema";
import { cn } from "@/lib/cn";

const FOCUS_PARTIES = ["DMK", "AIADMK", "TVK", "NTK"];

export function ComparisonStrip({
  parties,
  acsReporting,
}: {
  parties: PartyTally[];
  acsReporting?: number;
}) {
  // Seat-delta vs 2021 is meaningless until enough ACs are in. At 5/234
  // reporting, "DMK -128 seats" looks like a collapse but is just early data.
  const reportingPct = acsReporting != null ? acsReporting / TOTAL_SEATS : 0;
  const seatDeltaMature = reportingPct >= 0.4;

  const comparisons = buildComparisons(
    parties.map((p) => ({ partyId: p.partyId, total: p.total, voteShare: p.voteShare })),
  ).filter((c) => FOCUS_PARTIES.includes(c.partyId));

  // Ensure deterministic order
  comparisons.sort(
    (a, b) =>
      FOCUS_PARTIES.indexOf(a.partyId) - FOCUS_PARTIES.indexOf(b.partyId),
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            vs {HISTORICAL_YEAR}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Seat & vote-share movement against last assembly election
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {comparisons.map((c) => {
          const party = partyById(c.partyId);
          const seatUp = c.seatDelta > 0;
          const seatDown = c.seatDelta < 0;
          const voteUp = c.voteShareDelta > 0;
          const voteDown = c.voteShareDelta < 0;

          return (
            <div
              key={c.partyId}
              className="relative bg-[var(--bg-base)] border border-[var(--border)] rounded-xl overflow-hidden"
            >
              <div className="h-1" style={{ background: party.color }} />
              <div className="p-3">
                <div
                  className="text-xs font-black uppercase tracking-wider"
                  style={{ color: party.color }}
                >
                  {party.name}
                </div>

                {/* Seats row — gated until ≥40% of ACs report */}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black tabular leading-none">
                    {c.seatsNow}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] tabular">
                    / {c.seatsThen}
                  </span>
                  {seatDeltaMature ? (
                    <span
                      className={cn(
                        "ml-auto text-[10px] font-bold tabular px-1.5 py-0.5 rounded uppercase",
                        seatUp && "text-[var(--accent-won)] bg-[var(--accent-won)]/10",
                        seatDown && "text-[var(--accent-live)] bg-[var(--accent-live)]/10",
                        !seatUp && !seatDown && "text-[var(--text-muted)] bg-white/5",
                      )}
                    >
                      {seatUp && "▲"}
                      {seatDown && "▼"}
                      {!seatUp && !seatDown && "–"}
                      {Math.abs(c.seatDelta)}
                    </span>
                  ) : (
                    <span
                      className="ml-auto text-[10px] font-bold tabular px-1.5 py-0.5 rounded uppercase text-[var(--text-muted)] bg-white/5"
                      title="Seat delta will appear once ≥40% of ACs report"
                    >
                      —
                    </span>
                  )}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
                  Seats (now / {HISTORICAL_YEAR})
                </div>

                {/* Vote share row */}
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-base font-bold tabular">
                    {c.voteShareNow.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] tabular">
                    / {c.voteShareThen.toFixed(1)}%
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-bold tabular px-1.5 py-0.5 rounded uppercase",
                      voteUp && "text-[var(--accent-won)] bg-[var(--accent-won)]/10",
                      voteDown && "text-[var(--accent-live)] bg-[var(--accent-live)]/10",
                      !voteUp && !voteDown && "text-[var(--text-muted)] bg-white/5",
                    )}
                  >
                    {voteUp && "▲"}
                    {voteDown && "▼"}
                    {!voteUp && !voteDown && "–"}
                    {Math.abs(c.voteShareDelta).toFixed(1)}pp
                  </span>
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
                  Vote Share (now / {HISTORICAL_YEAR})
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
