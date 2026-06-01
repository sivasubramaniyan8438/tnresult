"use client";
import Link from "next/link";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById } from "@/lib/parties";
import { formatNumber } from "@/lib/cn";

export function CloseRaces({
  variant = "card",
  limit = 10,
}: {
  variant?: "card" | "scene";
  limit?: number;
}) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();
  const races = constituencies
    .filter((c) => c.status !== "pending" && c.leadingCandidate && c.leadingCandidate.margin > 0)
    .sort((a, b) => a.leadingCandidate!.margin - b.leadingCandidate!.margin)
    .slice(0, limit);

  if (variant === "scene") {
    return (
      <div className="grid grid-cols-2 gap-3 h-full overflow-auto">
        {races.map((c, i) => {
          const lead = c.leadingCandidate!;
          const leadParty = partyById(lead.partyId);
          const trail = c.trailingCandidate;
          const trailParty = trail ? partyById(trail.partyId) : null;
          return (
            <Link
              key={c.constituencyId}
              href={`/broadcast/ac/${c.constituencyId}`}
              className="rounded-xl p-4 bg-[var(--bg-card)] border border-[var(--accent-counting)]/30 hover:border-[var(--accent-counting)]/60"
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-counting)]">
                  #{i + 1} TIGHT
                </span>
                <span className="text-xs text-[var(--text-muted)] tabular">
                  R{c.round}/{c.totalRounds}
                </span>
              </div>
              <div className="font-black text-xl truncate">{c.constituencyName}</div>
              <div className="text-xs text-[var(--text-muted)]">{c.district}</div>
              <div className="mt-2 flex items-center gap-2">
                <span style={{ color: leadParty.color }} className="font-bold">
                  {leadParty.name}
                </span>
                <span className="text-[var(--text-muted)]">vs</span>
                {trailParty && (
                  <span style={{ color: trailParty.color }} className="font-bold">
                    {trailParty.name}
                  </span>
                )}
              </div>
              <div className="mt-2 text-3xl font-black tabular text-[var(--accent-counting)]">
                +{formatNumber(lead.margin)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                margin
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        {t("section.closeRaces")}
      </h3>
      {races.length === 0 ? (
        <div className="text-[var(--text-muted)] text-sm py-4 text-center">
          No tight races yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {races.slice(0, 6).map((c) => {
            const lead = c.leadingCandidate!;
            const party = partyById(lead.partyId);
            const trail = c.trailingCandidate;
            const trailParty = trail ? partyById(trail.partyId) : null;
            return (
              <li key={c.constituencyId}>
                <Link
                  href={`/constituencies/${c.constituencyId}`}
                  className="flex items-center justify-between gap-2 p-2 rounded hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {c.constituencyName}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                      <span style={{ color: party.color }}>{party.name}</span>
                      {trailParty && (
                        <>
                          <span className="text-[var(--text-muted)]">vs</span>
                          <span style={{ color: trailParty.color }}>{trailParty.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular text-[var(--accent-counting)]">
                      +{formatNumber(lead.margin)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      margin
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
