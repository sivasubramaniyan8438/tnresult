"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById, blocOf, FOCUS_BLOCS } from "@/lib/parties";
import bellwethers from "@/data/bellwethers.json";
import { cn , formatIndian} from "@/lib/cn";

type Bell = {
  constituencyId: number;
  label: string;
  track: string;
  since: number;
};

const RING_WINDOW_MS = 90_000; // 90s — fresh-call pulse window

export function BellwetherStrip({
  variant = "card",
}: {
  variant?: "card" | "scene";
}) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();
  const list = bellwethers as Bell[];
  // Tick every 5s so RINGING → CALLED transition happens without a reload
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const rows = list.map((b) => {
    const c = constituencies.find((x) => x.constituencyId === b.constituencyId);
    return { b, c };
  });

  // Consensus by bloc — how many declared bellwethers point at each bloc?
  const consensus = useMemo(() => {
    const blocCounts: Record<string, number> = {};
    let called = 0;
    for (const { c } of rows) {
      if (c?.status === "won" && c.leadingCandidate) {
        const bloc = blocOf(c.leadingCandidate.partyId) ?? "OTHERS";
        blocCounts[bloc] = (blocCounts[bloc] ?? 0) + 1;
        called++;
      }
    }
    const sorted = Object.entries(blocCounts).sort((a, b) => b[1] - a[1]);
    return { called, total: rows.length, leading: sorted[0] ?? null, byBloc: blocCounts };
  }, [rows]);

  if (variant === "scene") {
    return (
      <div className="h-full flex flex-col gap-2">
        <ConsensusChip consensus={consensus} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 overflow-auto">
          {rows.map(({ b, c }) => {
            const lead = c?.leadingCandidate;
            const party = lead ? partyById(lead.partyId) : null;
            const isCalled = c?.status === "won";
            const justCalled = isCalled && c?.updatedAt && now - c.updatedAt <= RING_WINDOW_MS;
            return (
              <Link
                key={b.constituencyId}
                href={`/broadcast/ac/${b.constituencyId}`}
                className={
                  "relative rounded-xl p-4 bg-gradient-to-br from-[var(--bg-card)] to-[#04081a] border hover:border-[var(--border-strong)] " +
                  (justCalled ? "border-amber-400" : isCalled ? "border-amber-400/50" : "border-[var(--border)]")
                }
                style={
                  justCalled
                    ? { boxShadow: "0 0 18px -2px rgba(251,191,36,0.55)" }
                    : undefined
                }
              >
                {justCalled && (
                  <div
                    className="absolute -top-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-black animate-pulse shadow-lg"
                    title="Bellwether just declared — pattern just confirmed"
                  >
                    🔔 RINGING
                  </div>
                )}
                {isCalled && !justCalled && (
                  <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-300 border border-amber-400/40">
                    🔔 CALLED
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⚖️</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                    Bellwether since {b.since}
                  </span>
                </div>
                <div className="font-black text-xl truncate">{b.label}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{b.track}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {isCalled ? "Called for" : "Currently"}
                  </span>
                  {party && lead ? (
                    <span
                      className="px-2 py-1 rounded font-bold uppercase tracking-wider text-xs"
                      style={{
                        background: `${party.color}30`,
                        color: party.color,
                        border: `1px solid ${party.color}55`,
                      }}
                    >
                      {party.name} +{formatIndian(lead.margin)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      {t("bellwether.awaiting")}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          ⚖️ {t("section.bellwethers")}
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t("bellwether.subtitle")}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rows.map(({ b, c }) => {
          const lead = c?.leadingCandidate;
          const party = lead ? partyById(lead.partyId) : null;
          return (
            <Link
              key={b.constituencyId}
              href={`/constituencies/${b.constituencyId}`}
              className={cn(
                "shrink-0 w-56 rounded-xl p-3 border bg-[var(--bg-base)]",
                "hover:bg-[var(--bg-card-hover)]",
              )}
              style={{ borderColor: party ? `${party.color}55` : "var(--border)" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Since {b.since}
              </div>
              <div className="font-bold text-sm truncate">{b.label}</div>
              <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-tight mt-1">
                {b.track}
              </div>
              <div className="mt-2 text-xs">
                {party && lead ? (
                  <span style={{ color: party.color }} className="font-bold">
                    {party.name} leading
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">Awaiting</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Headline summary chip — "X of Y bellwethers called · consensus is leaning DMK".
 *  Goes above the bellwether grid in scene mode so the macro signal lands first. */
function ConsensusChip({
  consensus,
}: {
  consensus: { called: number; total: number; leading: [string, number] | null; byBloc: Record<string, number> };
}) {
  const leadBloc = consensus.leading;
  if (consensus.called === 0) {
    return (
      <div className="rounded-md px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-[11px] sm:text-xs uppercase tracking-wider text-amber-200">
        ⚖️ Bellwether watch — <strong>0 of {consensus.total}</strong> called yet ·
        These ACs are historical sentinels for who wins TN.
      </div>
    );
  }
  if (!leadBloc) {
    return null;
  }
  const [blocId, count] = leadBloc;
  const blocConfig = FOCUS_BLOCS.find((b) => b.id === blocId);
  const color = blocConfig ? partyById(blocConfig.anchorPartyId).color : "#94a3b8";
  const blocLabel = blocConfig?.shortLabel ?? blocId;
  // How decisive is the consensus?
  const isClean = count === consensus.called && consensus.called >= 2;
  const message = isClean
    ? `Bellwether consensus → ${blocLabel}`
    : `Bellwethers leaning ${blocLabel}`;
  return (
    <div
      className="rounded-md px-3 py-2 text-[11px] sm:text-xs uppercase tracking-wider"
      style={{
        background: `${color}20`,
        border: `1px solid ${color}55`,
        color,
      }}
    >
      ⚖️ <strong>{message}</strong> ·{" "}
      <span className="text-white/85">
        {consensus.called} of {consensus.total} called
      </span>
      {consensus.called > 0 &&
        Object.entries(consensus.byBloc).length > 1 && (
          <span className="text-white/55 ml-2 font-normal normal-case tracking-normal">
            (
            {Object.entries(consensus.byBloc)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
            )
          </span>
        )}
    </div>
  );
}
