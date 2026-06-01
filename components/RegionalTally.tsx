"use client";
import { useMemo } from "react";
import { useLiveData } from "./LiveDataProvider";
import { partyById, blocOf, FOCUS_BLOCS } from "@/lib/parties";
import { ALL_REGIONS, REGION_LABELS, regionForDistrict, type RegionId } from "@/lib/regions";
import { TickingNumber } from "./TickingNumber";

/**
 * Region-by-region alliance breakdown — gives the anchor a North vs
 * South vs Kongu vs Delta narrative the statewide totals can't tell.
 *
 * Each region card shows total ACs in the region, declared/counting/
 * pending split, and the alliance bloc bar (DMK+ / AIADMK+ / TVK / NTK
 * + Others) so the dominance story reads at a glance.
 */
export function RegionalTally() {
  const { constituencies } = useLiveData();

  const byRegion = useMemo(() => {
    const map = new Map<
      RegionId,
      {
        total: number;
        declared: number;
        counting: number;
        pending: number;
        // Bloc totals (using declared OR currently leading as the "called by" tally)
        blocTotals: Record<string, number>;
      }
    >();
    for (const r of ALL_REGIONS) {
      map.set(r, { total: 0, declared: 0, counting: 0, pending: 0, blocTotals: {} });
    }
    for (const c of constituencies) {
      const r = regionForDistrict(c.district);
      const entry = map.get(r)!;
      entry.total++;
      if (c.status === "won") entry.declared++;
      else if (c.status === "leading" || c.status === "counting") entry.counting++;
      else entry.pending++;
      if (c.leadingCandidate) {
        const bloc = blocOf(c.leadingCandidate.partyId) ?? "OTHERS";
        entry.blocTotals[bloc] = (entry.blocTotals[bloc] ?? 0) + 1;
      }
    }
    return map;
  }, [constituencies]);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          🌍 Regional roll-up — North · Kongu · Delta · South
        </h3>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
          ACs called by region
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ALL_REGIONS.map((rid) => {
          const r = REGION_LABELS[rid];
          const entry = byRegion.get(rid)!;
          const reportingPct =
            entry.total > 0
              ? ((entry.declared + entry.counting) / entry.total) * 100
              : 0;
          // Find the leading bloc in this region (called + currently leading)
          const blocSorted = Object.entries(entry.blocTotals).sort(
            (a, b) => b[1] - a[1],
          );
          const leadingBloc = blocSorted[0];
          return (
            <div
              key={rid}
              className="rounded-lg p-3 bg-black/30"
              style={{ border: `1px solid ${r.color}55` }}
              title={r.description}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div
                  className="font-black uppercase tracking-wider text-xs"
                  style={{ color: r.color }}
                >
                  {r.label}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] tabular">
                  {entry.total} ACs
                </div>
              </div>
              {/* Reporting bar */}
              <div
                className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-2"
                title={`Reporting ${reportingPct.toFixed(1)}%`}
              >
                <div
                  className="h-full"
                  style={{ width: `${reportingPct}%`, background: r.color }}
                />
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 tabular flex justify-between">
                <span>
                  <span className="text-[var(--accent-won)] font-bold">
                    <TickingNumber value={entry.declared} />
                  </span>{" "}
                  declared
                </span>
                <span>
                  <span className="text-[var(--accent-counting)] font-bold">
                    <TickingNumber value={entry.counting} />
                  </span>{" "}
                  counting
                </span>
                <span>
                  <span className="text-white/70 font-bold">
                    <TickingNumber value={entry.pending} />
                  </span>{" "}
                  awaited
                </span>
              </div>
              {/* Bloc bar */}
              {blocSorted.length > 0 ? (
                <BlocStrip blocTotals={entry.blocTotals} total={entry.total} />
              ) : (
                <div className="text-[10px] text-[var(--text-muted)] mt-2 italic">
                  Awaiting first results
                </div>
              )}
              {/* Headline bloc lead in the region */}
              {leadingBloc && (
                <div className="mt-2 text-[11px] flex items-baseline gap-1">
                  <span className="text-[var(--text-muted)] uppercase tracking-wider text-[9px]">
                    Leading:
                  </span>
                  <BlocChip bloc={leadingBloc[0]} count={leadingBloc[1]} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlocStrip({
  blocTotals,
  total,
}: {
  blocTotals: Record<string, number>;
  total: number;
}) {
  const entries = FOCUS_BLOCS.map((b) => ({
    bloc: b.id,
    color: partyById(b.anchorPartyId).color,
    count: blocTotals[b.id] ?? 0,
  }));
  const others = blocTotals["OTHERS"] ?? 0;
  if (others > 0) entries.push({ bloc: "OTHERS", color: "#94a3b8", count: others });
  const calledTotal = entries.reduce((s, e) => s + e.count, 0);
  return (
    <div className="h-3 rounded-md overflow-hidden flex bg-black/40 mt-2 border border-white/5">
      {entries.map((e) => {
        const pct = total > 0 ? (e.count / total) * 100 : 0;
        if (pct < 0.5) return null;
        return (
          <div
            key={e.bloc}
            title={`${e.bloc}: ${e.count}/${total}`}
            style={{ width: `${pct}%`, background: e.color }}
          />
        );
      })}
      {/* Pending portion stays empty (transparent) so the called share reads naturally */}
      {calledTotal < total && (
        <div
          style={{ width: `${((total - calledTotal) / total) * 100}%`, background: "rgba(255,255,255,0.04)" }}
        />
      )}
    </div>
  );
}

function BlocChip({ bloc, count }: { bloc: string; count: number }) {
  if (bloc === "OTHERS") {
    return (
      <span className="font-bold text-[var(--text-muted)]">
        Others <span className="tabular">{count}</span>
      </span>
    );
  }
  const p = partyById(bloc);
  return (
    <span className="font-bold" style={{ color: p.color }}>
      {p.shortName ?? p.name} <span className="tabular">{count}</span>
    </span>
  );
}
