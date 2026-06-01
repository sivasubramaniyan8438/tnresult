"use client";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import {
  partyById,
  MAJORITY_MARK,
  TOTAL_SEATS,
  FOCUS_BLOCS,
} from "@/lib/parties";
import { TickingNumber } from "./TickingNumber";

/**
 * The "soul" strip — persistent across every broadcast scene. Shows the four
 * alliance bloc totals (INDIA · NDA · TVK · NTK), each with a ticking number,
 * a thin path-to-majority track, and the breakdown of member parties when
 * the bloc has more than one. This is the headline data viewers track for
 * hours on counting day; it must never disappear.
 *
 * Designed to fit a 56px-tall band at 1920×1080 — readable from across the
 * room without dominating the scene area.
 */
export function AllianceTotalsStrip() {
  const { state } = useLiveData();
  const { t, tAllianceById } = useLocale();

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-xs uppercase tracking-widest">
        Connecting…
      </div>
    );
  }

  const blocs = FOCUS_BLOCS.map((bloc) => {
    const members = state.parties.filter((p) => bloc.members.includes(p.partyId));
    return {
      bloc,
      total: members.reduce((s, p) => s + p.total, 0),
      won: members.reduce((s, p) => s + p.won, 0),
      leading: members.reduce((s, p) => s + p.leading, 0),
      breakdown: members.filter((p) => p.total > 0).sort((a, b) => b.total - a.total),
    };
  });

  const reportingPct = ((state.declared + state.counting) / TOTAL_SEATS) * 100;

  return (
    <div className="h-full w-full grid grid-cols-4 gap-2 px-2 py-1">
      {blocs.map(({ bloc, total, won, leading, breakdown }) => {
        const party = partyById(bloc.anchorPartyId);
        const reachedMajority = total >= MAJORITY_MARK;
        const allianceLabel = tAllianceById(party.alliance, bloc.label);
        const majorityPct = Math.min(100, (total / MAJORITY_MARK) * 100);

        return (
          <div
            key={bloc.id}
            className="relative h-full rounded-lg border bg-gradient-to-r from-[#0a0f24]/70 to-[#04081a]/40 backdrop-blur-sm flex items-center gap-3 pl-3 pr-3 overflow-hidden"
            style={{
              borderColor: reachedMajority
                ? `${party.color}cc`
                : `${party.color}40`,
              boxShadow: reachedMajority
                ? `0 0 18px ${party.color}40, inset 0 0 0 1px ${party.color}80`
                : undefined,
            }}
          >
            {/* Color bar on left */}
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: party.color }}
            />

            {/* Bloc label + member breakdown */}
            <div className="flex flex-col leading-tight min-w-0 ml-1 shrink-1 flex-1">
              <span
                className="font-black uppercase tracking-wider text-sm whitespace-nowrap"
                style={{ color: party.color }}
              >
                {bloc.shortLabel === "SPA" || bloc.shortLabel === "NDA"
                  ? `${bloc.shortLabel} (${party.shortName}+)`
                  : bloc.shortLabel}
              </span>
              <span className="text-[11px] uppercase tracking-[0.15em] text-white/65 truncate font-bold mt-0.5">
                {breakdown.length > 1
                  ? breakdown
                      .slice(0, 3)
                      .map((p) => `${p.partyId} ${p.total}`)
                      .join(" · ")
                  : total === 0
                    ? allianceLabel
                    : `${party.shortName} ${total}`}
              </span>
            </div>

            {/* Big number + won/leading split — explicit, readable labels. */}
            <div className="flex items-stretch gap-2 shrink-0">
              <TickingNumber
                value={total}
                className="font-black tabular text-3xl sm:text-4xl leading-none self-center"
                style={{ color: party.color }}
              />
              <div className="flex flex-col items-start justify-center leading-tight gap-0.5 border-l border-white/10 pl-2">
                <span className="text-[11px] tabular whitespace-nowrap font-black leading-none">
                  <span className="text-[var(--accent-won)]">{won}</span>
                  <span className="text-white/45 ml-1 text-[9px] tracking-[0.18em] uppercase">
                    won
                  </span>
                </span>
                <span className="text-[11px] tabular whitespace-nowrap font-black leading-none">
                  <span className="text-[var(--accent-counting)]">{leading}</span>
                  <span className="text-white/45 ml-1 text-[9px] tracking-[0.18em] uppercase">
                    lead
                  </span>
                </span>
              </div>
            </div>

            {/* Path-to-majority bar at the bottom */}
            <span
              className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/5"
              aria-hidden
            />
            <span
              className="absolute left-0 bottom-0 h-[2px] transition-all duration-700 ease-out"
              style={{
                width: `${majorityPct}%`,
                background: `linear-gradient(90deg, ${party.color}aa 0%, ${party.color} 100%)`,
                boxShadow: reachedMajority
                  ? `0 0 8px ${party.color}`
                  : undefined,
              }}
              aria-hidden
            />
          </div>
        );
      })}

      {/* Hidden semantic context for screen readers */}
      <span className="sr-only">
        Reporting {reportingPct.toFixed(1)}% · {t("label.majority")}{" "}
        {MAJORITY_MARK} of {TOTAL_SEATS} seats
      </span>
    </div>
  );
}
