"use client";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { project } from "@/lib/projection";
import { partyById, MAJORITY_MARK } from "@/lib/parties";
import { cn } from "@/lib/cn";
import { TickingNumber } from "./TickingNumber";

const FOCUS = ["DMK", "AIADMK", "TVK", "NTK"];

export function ProjectionCard({
  variant = "card",
}: {
  variant?: "card" | "scene";
}) {
  const { state, constituencies } = useLiveData();
  const { t } = useLocale();
  if (!state) return null;

  const { projections, countedShare, confidence } = project(state, constituencies);
  const focusProjections = projections.filter((p) => FOCUS.includes(p.partyId));

  const confLabel = t(`conf.${confidence}`);

  const confColor = {
    low: "var(--accent-live)",
    medium: "var(--accent-counting)",
    high: "var(--accent-won)",
  }[confidence];

  // Thin-data suppressor: under 10% reporting, the projection extrapolates
  // a handful of Chennai ACs to "DMK 230 ± 1 ★ MAJORITY" — broadcast-killer.
  // Show the headline frame but replace numbers with a clear "awaiting" face.
  // Same threshold as Swingometer for consistency.
  const isThin = countedShare < 0.1;

  if (variant === "scene") {
    return (
      <div className="card p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              {t("section.ifPatternHolds")}
            </div>
            <h2 className="text-3xl font-black uppercase tracking-wide">{t("section.projectionTitle")}</h2>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest" style={{ color: confColor }}>
              {confLabel}
            </div>
            <div className="text-xs text-[var(--text-muted)] tabular">
              {t("section.projectionBasis", { pct: Math.round(countedShare * 100) })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {focusProjections.map((p, i) => (
            <ProjectionTile key={p.partyId} proj={p} big rank={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            {t("section.ifPatternHolds")}
          </div>
          <h3 className="text-lg sm:text-2xl font-black uppercase tracking-wide leading-tight mt-0.5">
            {t("section.projection")}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: confColor }}>
            {confLabel}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] tabular">
            {t("section.projectionBasis", { pct: Math.round(countedShare * 100) })}
          </div>
        </div>
      </div>
      {isThin ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-6 text-center">
          <div className="text-amber-300 text-base font-black uppercase tracking-widest">
            ⚠ {t("projection.awaitingHeadline")}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {t("projection.awaitingDetail")}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {focusProjections.map((p, i) => (
            <ProjectionTile key={p.partyId} proj={p} rank={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectionTile({
  proj,
  big,
  rank,
}: {
  proj: ReturnType<typeof project>["projections"][0];
  big?: boolean;
  rank: number;
}) {
  const party = partyById(proj.partyId);
  const reachedMajority = proj.point >= MAJORITY_MARK;
  const { tParty, t } = useLocale();
  const partyName = tParty(party.id, party.name);
  return (
    <div
      className={cn(
        "rounded-xl p-3 bg-[var(--bg-base)] border",
        big && "p-5",
      )}
      style={{ borderColor: reachedMajority ? party.color : "var(--border)" }}
    >
      <div className="text-xs font-black uppercase tracking-wider" style={{ color: party.color }}>
        {partyName}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <TickingNumber
          value={proj.point}
          className={cn(
            "font-black tabular leading-none",
            big ? "text-6xl sm:text-7xl" : "text-4xl sm:text-5xl",
          )}
          style={{ color: party.color }}
        />
        <span className={cn("text-[var(--text-muted)] tabular", big ? "text-sm" : "text-xs")}>
          ± {proj.high - proj.point}
        </span>
      </div>
      <div className={cn("mt-1 text-[var(--text-muted)] tabular", big ? "text-sm" : "text-[11px]")}>
        {t("projection.range")} {proj.low}–{proj.high}
      </div>
      {reachedMajority && (
        <div
          className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border"
          style={{
            background: `${party.color}25`,
            color: party.color,
            borderColor: `${party.color}60`,
          }}
        >
          ★ {t("label.majority")}
        </div>
      )}
    </div>
  );
}
