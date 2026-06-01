"use client";
import { partyById, FOCUS_BLOCS, TOTAL_SEATS, blocOf } from "@/lib/parties";
import type { PartyTally } from "@/lib/schema";
import { useLocale } from "./LocaleProvider";

/**
 * Vote share donut, aggregated by ALLIANCE BLOC to match the rest of the
 * dashboard (hero cards, ComparisonStrip, SwingMap flip-detection). Showing
 * raw party shares makes a big BJP win in one AC look like "BJP 50% statewide"
 * — it's BJP-share-of-counted-votes, but viewers read it as state vote
 * share. The bloc view (INDIA / NDA / TVK / NTK + Others) is the consistent
 * story.
 *
 * Thin-data behaviour:
 *   < 5% reporting   → headline % suppressed entirely, donut shown muted
 *                      with "Sample too small" warning. Even the legend
 *                      hides percentages — only sticks shown.
 *   < 30% reporting  → "early sample" tag in the header
 *   ≥ 30% reporting  → full headline + percentages
 */
export function VoteShareDonut({
  parties,
  acsReporting,
}: {
  parties: PartyTally[];
  acsReporting?: number;
}) {
  const { t, tAllianceById } = useLocale();
  const reportingPct = acsReporting != null ? acsReporting / TOTAL_SEATS : 0;
  const veryThin = reportingPct < 0.05;
  const thin = reportingPct < 0.3;

  // Aggregate per-party voteShare into alliance bloc totals
  const blocShare = new Map<string, number>();
  for (const b of FOCUS_BLOCS) blocShare.set(b.id, 0);
  let othersShare = 0;
  for (const p of parties) {
    const blocAnchor = blocOf(p.partyId); // returns the anchor party id
    if (!blocAnchor) {
      othersShare += p.voteShare;
      continue;
    }
    // Find the bloc whose anchor matches
    const bloc = FOCUS_BLOCS.find((b) => b.anchorPartyId === blocAnchor);
    if (bloc) blocShare.set(bloc.id, (blocShare.get(bloc.id) ?? 0) + p.voteShare);
    else othersShare += p.voteShare;
  }
  if (othersShare > 0.001) blocShare.set("OTHERS", othersShare);

  // Order largest-first for legend + headline
  const ordered = Array.from(blocShare.entries())
    .filter(([, v]) => v > 0.005)
    .sort((a, b) => b[1] - a[1])
    .map(([id, share]) => {
      const bloc = FOCUS_BLOCS.find((b) => b.id === id);
      const color = bloc ? partyById(bloc.anchorPartyId).color : "#94a3b8";
      const label = bloc ? bloc.label : "Others";
      return { id, share, color, label, anchor: bloc?.anchorPartyId };
    });

  const totalShare = ordered.reduce((s, b) => s + b.share, 0);
  const remaining = Math.max(0, 100 - totalShare);

  // Build conic-gradient stops
  const stops: string[] = [];
  let cursor = 0;
  for (const b of ordered) {
    stops.push(`${b.color} ${cursor}% ${cursor + b.share}%`);
    cursor += b.share;
  }
  if (remaining > 0) stops.push(`#1f2937 ${cursor}% 100%`);
  const gradient = `conic-gradient(${stops.join(", ") || "#1f2937 0% 100%"})`;

  const top = ordered[0];
  const showHeadline = top && !veryThin;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("section.voteShare")}
        </h3>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {totalShare > 0 && acsReporting != null
            ? `${acsReporting} / ${TOTAL_SEATS} ACs reporting${thin ? " · early sample" : ""}`
            : totalShare > 0
              ? "—"
              : t("voteShare.awaitingData")}
        </div>
      </div>

      {/* Thin-data warning */}
      {totalShare > 0 && veryThin && (
        <div className="text-[10px] mb-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
          ⚠ Sample too small ({acsReporting} of {TOTAL_SEATS} ACs) — vote share is not statewide.
        </div>
      )}

      <div className="flex items-center gap-4" style={veryThin ? { opacity: 0.5 } : undefined}>
        {/* Donut */}
        <div className="relative shrink-0 w-32 h-32 sm:w-40 sm:h-40">
          <div
            className="w-full h-full rounded-full transition-[background] duration-500"
            style={{ background: gradient }}
          />
          <div className="absolute inset-[18%] rounded-full bg-[var(--bg-card)] flex flex-col items-center justify-center text-center">
            {showHeadline ? (
              <>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                  {t("hero.leadingCap")}
                </div>
                <div
                  className="text-xl font-black tabular leading-tight"
                  style={{ color: top.color }}
                >
                  {top.share.toFixed(1)}%
                </div>
                <div
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: top.color }}
                >
                  {top.anchor ? tAllianceById(top.anchor, top.label) : top.label}
                </div>
              </>
            ) : totalShare > 0 ? (
              <>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                  {t("hero.leadingCap")}
                </div>
                <div className="text-xl font-black tabular leading-tight text-[var(--text-muted)]">
                  —
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  too thin
                </div>
              </>
            ) : (
              <div className="text-[10px] text-[var(--text-muted)]">
                {t("voteShare.noData")}
              </div>
            )}
          </div>
        </div>

        {/* Legend — bloc labels with bloc colors */}
        <div className="flex-1 min-w-0 space-y-1">
          {ordered.slice(0, 5).map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: b.color }}
              />
              <span
                className="font-medium truncate flex-1"
                style={{ color: b.color }}
              >
                {b.anchor ? tAllianceById(b.anchor, b.label) : b.label}
              </span>
              {!veryThin && (
                <span className="font-bold tabular text-[var(--text-primary)]">
                  {b.share.toFixed(2)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
