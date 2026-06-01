"use client";
import { ALLIANCES, partyById, MAJORITY_MARK } from "@/lib/parties";
import type { PartyTally } from "@/lib/schema";
import { TickingNumber } from "./TickingNumber";

const ALLIANCE_ORDER: Array<keyof typeof ALLIANCES> = ["INDIA", "NDA", "TVK", "NTK", "OTHERS"];

export function AllianceRollup({ parties }: { parties: PartyTally[] }) {
  const byParty = new Map(parties.map((p) => [p.partyId, p]));

  const rollups = ALLIANCE_ORDER.map((id) => {
    const a = ALLIANCES[id];
    const partiesInAlliance = a.parties
      .map((pid) => {
        const t = byParty.get(pid);
        if (!t) return null;
        return { ...t, party: partyById(pid) };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const total = partiesInAlliance.reduce((s, p) => s + p.total, 0);
    const won = partiesInAlliance.reduce((s, p) => s + p.won, 0);
    const leading = partiesInAlliance.reduce((s, p) => s + p.leading, 0);
    const voteShare = partiesInAlliance.reduce((s, p) => s + p.voteShare, 0);

    return { id, name: a.name, color: a.color, total, won, leading, voteShare, partiesInAlliance };
  }).filter((r) => r.total > 0 || ["INDIA", "NDA", "TVK", "NTK"].includes(r.id as string));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Alliance Rollup
        </h3>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          Magic figure: {MAJORITY_MARK}
        </div>
      </div>
      <div className="space-y-3">
        {rollups.map((r) => {
          const pct = Math.min(100, (r.total / MAJORITY_MARK) * 100);
          const reachedMajority = r.total >= MAJORITY_MARK;
          return (
            <div key={r.id} className="bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded" style={{ background: r.color }} />
                  <span className="font-bold truncate">{r.name}</span>
                  <div className="flex gap-1 flex-wrap">
                    {r.partiesInAlliance.map((p) => (
                      <span
                        key={p.partyId}
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: `${p.party.color}25`,
                          color: p.party.color,
                          border: `1px solid ${p.party.color}40`,
                        }}
                      >
                        {p.party.name} {p.total}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <TickingNumber
                    value={r.total}
                    className="text-2xl font-black tabular leading-none block"
                    style={{ color: r.color }}
                  />
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {r.won} won · {r.leading} lead
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: r.color }}
                />
              </div>
              {reachedMajority && (
                <div className="mt-1.5 text-[10px] font-bold tracking-widest text-[var(--accent-won)] uppercase">
                  ★ Majority crossed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
