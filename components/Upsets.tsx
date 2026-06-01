"use client";
import Link from "next/link";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById } from "@/lib/parties";
import { get2021ForAc } from "@/lib/historical-by-ac";

type Upset = {
  constituencyId: number;
  constituencyName: string;
  district: string;
  round: number;
  totalRounds: number;
  status: string;
  oldWinner: string;
  newLeader: string;
  swingMagnitude: number;
};

export function Upsets({
  variant = "card",
  limit = 10,
}: {
  variant?: "card" | "scene";
  limit?: number;
}) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();

  const upsets: Upset[] = [];
  for (const c of constituencies) {
    if (c.status === "pending" || !c.leadingCandidate) continue;
    // Skip very-early counts — margins as % are noisy when only a handful
    // of votes are in (a 14k margin out of 14k total votes ≠ a 100pp swing).
    if (c.totalVotes < 5000) continue;
    const hist = get2021ForAc(c.constituencyId, c.district);
    if (hist.winner === c.leadingCandidate.partyId) continue;
    // "Margin shift vs 2021": old winner's margin (in %) + new leader's
    // current margin (as % of votes counted so far). Each capped at 50pp
    // so a single side can never exceed a true landslide. The sum tells
    // viewers how far the seat has moved on the partisan scale.
    const histMarginCapped = Math.min(50, Math.max(0, hist.marginPct));
    const currentMarginPct = Math.min(
      50,
      (c.leadingCandidate.margin / Math.max(1, c.totalVotes)) * 100,
    );
    upsets.push({
      constituencyId: c.constituencyId,
      constituencyName: c.constituencyName,
      district: c.district,
      round: c.round,
      totalRounds: c.totalRounds,
      status: c.status,
      oldWinner: hist.winner,
      newLeader: c.leadingCandidate.partyId,
      swingMagnitude: histMarginCapped + currentMarginPct,
    });
  }

  upsets.sort((a, b) => b.swingMagnitude - a.swingMagnitude);
  const top = upsets.slice(0, limit);

  if (variant === "scene") {
    return (
      <div className="grid grid-cols-2 gap-3 h-full overflow-auto">
        {top.map((u, i) => {
          const oldP = partyById(u.oldWinner);
          const newP = partyById(u.newLeader);
          return (
            <Link
              key={u.constituencyId}
              href={`/broadcast/ac/${u.constituencyId}`}
              className="rounded-xl p-4 bg-[var(--bg-card)] border-2 hover:scale-[1.01] transition-transform"
              style={{ borderColor: `${newP.color}55` }}
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-live)]">
                  #{i + 1} UPSET
                </span>
                <span className="text-xs text-[var(--text-muted)] tabular">R{u.round}/{u.totalRounds}</span>
              </div>
              <div className="font-black text-xl truncate">{u.constituencyName}</div>
              <div className="text-xs text-[var(--text-muted)]">{u.district}</div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span
                  style={{ background: `${oldP.color}25`, color: oldP.color, border: `1px solid ${oldP.color}55` }}
                  className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider line-through opacity-70"
                >
                  {oldP.name} {t("upsets.was")}
                </span>
                <span className="text-[var(--text-muted)]">→</span>
                <span
                  style={{ background: `${newP.color}25`, color: newP.color, border: `1px solid ${newP.color}55` }}
                  className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider"
                >
                  {newP.name} {t("upsets.now")}
                </span>
              </div>
              <div className="mt-2 text-2xl font-black tabular" style={{ color: newP.color }}>
                ~{u.swingMagnitude.toFixed(0)}pp margin shift
              </div>
            </Link>
          );
        })}
        {top.length === 0 && (
          <div className="col-span-full text-center text-[var(--text-muted)] py-12">
            No upsets vs 2021 yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        {t("section.upsetsTitle")}
      </h3>
      {top.length === 0 ? (
        <div className="text-[var(--text-muted)] text-sm py-4 text-center">
          No upsets yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {top.slice(0, 6).map((u) => {
            const oldP = partyById(u.oldWinner);
            const newP = partyById(u.newLeader);
            return (
              <li key={u.constituencyId}>
                <Link
                  href={`/constituencies/${u.constituencyId}`}
                  className="flex items-center justify-between gap-2 p-2 rounded hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {u.constituencyName}
                    </div>
                    <div className="text-xs flex items-center gap-1.5">
                      <span style={{ color: oldP.color }} className="line-through opacity-70">
                        {oldP.name}
                      </span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span style={{ color: newP.color }} className="font-bold">
                        {newP.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular" style={{ color: newP.color }}>
                      ~{u.swingMagnitude.toFixed(0)}pp
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      margin shift
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
