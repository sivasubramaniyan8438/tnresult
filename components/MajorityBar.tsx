"use client";
import { partyById, MAJORITY_MARK, TOTAL_SEATS } from "@/lib/parties";
import type { PartyTally } from "@/lib/schema";
import { useLocale } from "./LocaleProvider";
import { TickingNumber } from "./TickingNumber";

export function MajorityBar({ parties }: { parties: PartyTally[] }) {
  const { t, tParty } = useLocale();
  const ordered = [...parties].filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  const leader = ordered[0];
  const leaderParty = leader ? partyById(leader.partyId) : null;
  const seatsToMajority = leader ? Math.max(0, MAJORITY_MARK - leader.total) : MAJORITY_MARK;
  const reachedMajority = leader ? leader.total >= MAJORITY_MARK : false;
  const leaderPctOfMajority = leader ? Math.min(100, (leader.total / MAJORITY_MARK) * 100) : 0;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t("section.tnAssembly")}
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-0.5">
            {TOTAL_SEATS} {t("section.seats")} &middot; {t("label.majority")}{" "}
            <span className="gradient-text">{MAJORITY_MARK}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t("section.decided")}</div>
          <div className="text-xl tabular font-bold">
            {ordered.reduce((s, p) => s + p.total, 0)} / {TOTAL_SEATS}
          </div>
        </div>
      </div>

      {/* Path-to-majority bar for the leader — animates fill toward 118 */}
      {leader && leaderParty && (
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: leaderParty.color }} />
              {t("majority.pathFor")}{" "}
              <span className="font-bold" style={{ color: leaderParty.color }}>
                {tParty(leaderParty.id, leaderParty.name)}
              </span>
            </div>
            {reachedMajority ? (
              <div className="text-[11px] font-black uppercase tracking-widest text-[var(--accent-won)]">
                ★ {t("majority.crossed")}
              </div>
            ) : (
              <div className="text-[11px] font-bold tabular">
                <TickingNumber
                  value={seatsToMajority}
                  className="text-[var(--accent-lead)]"
                />
                <span className="text-[var(--text-muted)] ml-1">{t("majority.moreNeeded")}</span>
              </div>
            )}
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-[var(--bg-base)] border border-[var(--border)]">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-700 ease-out"
              style={{
                width: `${leaderPctOfMajority}%`,
                background: `linear-gradient(90deg, ${leaderParty.color}88, ${leaderParty.color})`,
                boxShadow: reachedMajority ? `0 0 12px ${leaderParty.color}80` : undefined,
              }}
            />
            <div className="absolute inset-y-[-3px] right-0 left-0 pointer-events-none">
              <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: "100%" }} />
            </div>
          </div>
          <div className="flex justify-between text-[9px] mt-1 tabular text-[var(--text-muted)]">
            <span>0</span>
            <TickingNumber
              value={leader.total}
              className="font-bold text-[var(--text-secondary)]"
            />
            <span>{MAJORITY_MARK}</span>
          </div>
        </div>
      )}

      {/* Stacked bar */}
      <div className="relative">
        <div className="flex h-12 rounded-lg overflow-hidden bg-[var(--bg-base)] border border-[var(--border)]">
          {ordered.map((p) => {
            const party = partyById(p.partyId);
            const widthPct = (p.total / TOTAL_SEATS) * 100;
            if (widthPct < 0.3) return null;
            return (
              <div
                key={p.partyId}
                className="relative group flex items-center justify-center text-[11px] font-bold transition-all duration-500 hover:brightness-110"
                style={{
                  width: `${widthPct}%`,
                  background: party.color,
                  color: party.textColor,
                }}
                title={`${party.name}: ${p.total}`}
              >
                {widthPct > 5 && <span className="tabular">{p.total}</span>}
                <div className="hidden group-hover:block absolute -top-9 left-1/2 -translate-x-1/2 bg-black/95 border border-[var(--border-strong)] text-white text-xs whitespace-nowrap px-2 py-1 rounded z-10">
                  {party.name}: {p.total}
                </div>
              </div>
            );
          })}
        </div>

        {/* Majority marker */}
        <div
          className="absolute top-[-6px] bottom-[-6px] flex flex-col items-center pointer-events-none"
          style={{ left: `${(MAJORITY_MARK / TOTAL_SEATS) * 100}%` }}
        >
          <div className="w-0.5 h-[calc(100%+6px)] bg-white/70" />
          <div className="absolute -top-5 -translate-x-1/2 text-[10px] font-bold text-white/80 whitespace-nowrap">
            ↓ {MAJORITY_MARK}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {ordered.slice(0, 8).map((p) => {
          const party = partyById(p.partyId);
          return (
            <div key={p.partyId} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: party.color }}
              />
              <span className="text-[var(--text-secondary)]">{tParty(party.id, party.name)}</span>
              <span className="font-semibold tabular">{p.total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
