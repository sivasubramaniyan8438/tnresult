"use client";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById, MAJORITY_MARK, TOTAL_SEATS } from "@/lib/parties";
import { cn } from "@/lib/cn";
import { TickingNumber } from "./TickingNumber";

export function PersistentLeaderStrip() {
  const { state } = useLiveData();
  const { t, tParty } = useLocale();
  if (!state) return null;

  const overallLeader = [...state.parties].sort((a, b) => b.total - a.total)[0];
  const overallParty = overallLeader && overallLeader.total > 0 ? partyById(overallLeader.partyId) : null;
  const reachedMajority = overallLeader && overallLeader.total >= MAJORITY_MARK;
  const reporting = state.declared + state.counting;
  const reportingPct = (reporting / TOTAL_SEATS) * 100;

  return (
    <div className="sticky top-[57px] z-20 hide-on-broadcast border-b border-[var(--border)] bg-gradient-to-r from-[#04081a]/95 via-[#0a1024]/95 to-[#04081a]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-2 flex items-center gap-3 sm:gap-4 overflow-x-auto">
        {/* Overall leader badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
            {t("section.leadingOverall")}
          </span>
          {overallParty && overallLeader ? (
            <div
              className={cn(
                "flex items-center gap-2 px-2.5 py-1 rounded-md",
                reachedMajority && "shadow-lg shadow-[var(--accent-won)]/20",
              )}
              style={{
                background: `${overallParty.color}30`,
                border: `1px solid ${overallParty.color}80`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: overallParty.color }}
              />
              <span className="font-black text-xs sm:text-sm" style={{ color: overallParty.color }}>
                {tParty(overallParty.id, overallParty.name)}
              </span>
              <TickingNumber
                value={overallLeader.total}
                className="font-black tabular text-base sm:text-lg"
              />
              <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                / {TOTAL_SEATS}
              </span>
            </div>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">Awaiting data</span>
          )}
          {reachedMajority && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent-won)] shrink-0">
              ★ {t("label.majority")}
            </span>
          )}
        </div>

        <span className="w-px h-6 bg-[var(--border)] shrink-0 hidden sm:block" />

        {/* Progress meta — % reporting is the journalist's "counting velocity" number */}
        <div className="flex items-center gap-3 text-xs ml-auto shrink-0">
          {/* % of ACs reporting — prominent (#6) */}
          <div className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
              {t("label.reporting")}
            </span>
            <TickingNumber
              value={reportingPct}
              className="font-black tabular text-base sm:text-lg text-[var(--accent-lead)]"
              format={(n) => `${n.toFixed(1)}%`.replace(/\.0%$/, "%")}
              durationMs={500}
            />
            <span className="text-[10px] text-[var(--text-muted)] tabular hidden sm:inline">
              (<TickingNumber value={reporting} />/{TOTAL_SEATS})
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              {t("label.declared")}
            </span>
            <TickingNumber
              value={state.declared}
              className="font-black tabular text-[var(--accent-won)]"
            />
          </div>
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              {t("label.counting")}
            </span>
            <TickingNumber
              value={state.counting}
              className="font-black tabular text-[var(--accent-lead)]"
            />
          </div>
          <div className="hidden lg:flex items-center gap-1">
            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              {t("label.awaited")}
            </span>
            <TickingNumber
              value={state.pending}
              className="font-black tabular text-[var(--text-muted)]"
            />
          </div>

          {/* Mini majority bar */}
          <div className="hidden sm:flex flex-col items-end gap-0.5 min-w-[120px]">
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
              {overallLeader && overallLeader.total > 0
                ? `${MAJORITY_MARK - overallLeader.total} ${t("section.shortOfMajority")}`
                : `${t("label.majority")}: ${MAJORITY_MARK}`}
            </div>
            <div className="w-full h-1 bg-[var(--bg-base)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((overallLeader?.total ?? 0) / MAJORITY_MARK) * 100)}%`,
                  background: overallParty?.color ?? "var(--text-muted)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
