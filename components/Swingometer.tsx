"use client";
import { useState, useMemo } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById, MAJORITY_MARK, FOCUS_BLOCS } from "@/lib/parties";
import { HISTORICAL_2021 } from "@/lib/historical";
import { get2021ForAc } from "@/lib/historical-by-ac";
import constituencies from "@/data/constituencies.json";

type Constituency = { id: number; name: string; district: string; reservation: string };

const ACS = constituencies as Constituency[];

// Build per-AC 2021 winners
const AC_HISTORY = ACS.map((ac) => ({
  acId: ac.id,
  district: ac.district,
  ...get2021ForAc(ac.id, ac.district),
}));

const HIST_VOTE_SHARE: Record<string, number> = Object.fromEntries(
  HISTORICAL_2021.map((h) => [h.partyId, h.voteShare]),
);

export function Swingometer({
  variant = "card",
}: {
  variant?: "card" | "scene";
}) {
  const { state } = useLiveData();
  const { t } = useLocale();
  const [manualSwing, setManualSwing] = useState<number | null>(null);
  // Thin-data gate: under 10% reporting, the projection is meaningless
  // (a handful of Chennai ACs project DMK 220+ seats statewide).
  const reportingPct = state ? (state.declared + state.counting) / 234 : 0;
  const isThinForProjection = reportingPct < 0.1;

  // Detect current swing from live vote share vs 2021 (DMK ↔ AIADMK)
  const liveDmkShare = state?.parties.find((p) => p.partyId === "DMK")?.voteShare ?? 0;
  const liveAiadmkShare = state?.parties.find((p) => p.partyId === "AIADMK")?.voteShare ?? 0;
  const liveTvkShare = state?.parties.find((p) => p.partyId === "TVK")?.voteShare ?? 0;

  // (DMK_now − DMK_2021) − (AIADMK_now − AIADMK_2021) → positive = DMK gain
  const detectedSwing = useMemo(() => {
    if (liveDmkShare === 0 && liveAiadmkShare === 0) return 0;
    return (
      liveDmkShare - HIST_VOTE_SHARE.DMK - (liveAiadmkShare - HIST_VOTE_SHARE.AIADMK)
    );
  }, [liveDmkShare, liveAiadmkShare]);

  const swing = manualSwing ?? detectedSwing;

  // Projected seats under Uniform Swing
  // For each AC: take 2021 winning margin (in %), apply swing, see if it flips
  const projected = useMemo(() => {
    const counts: Record<string, number> = { DMK: 0, AIADMK: 0, TVK: 0, NTK: 0, OTHERS: 0 };
    for (const ac of AC_HISTORY) {
      // Determine effective margin after swing
      let effectiveWinner = ac.winner;
      if (ac.winner === "DMK") {
        // If swing is negative (toward AIADMK) and bigger than DMK margin, flips to AIADMK
        if (-swing > ac.marginPct / 2) effectiveWinner = "AIADMK";
      } else if (ac.winner === "AIADMK") {
        if (swing > ac.marginPct / 2) effectiveWinner = "DMK";
      }
      // (TVK statewide-share steal handled below — per-AC stochastic model
      // intentionally NOT applied here; would need actual vote-split data.)
      const key = ["DMK", "AIADMK", "TVK", "NTK"].includes(effectiveWinner)
        ? effectiveWinner
        : "OTHERS";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // Apply TVK steal proportionally if their statewide share > 15%
    if (liveTvkShare > 15) {
      const stealRatio = Math.min(0.25, (liveTvkShare - 15) / 30);
      const stealFromDmk = Math.round(counts.DMK * stealRatio * 0.6);
      const stealFromAiadmk = Math.round(counts.AIADMK * stealRatio * 0.4);
      counts.DMK -= stealFromDmk;
      counts.AIADMK -= stealFromAiadmk;
      counts.TVK = (counts.TVK ?? 0) + stealFromDmk + stealFromAiadmk;
    }
    return counts;
  }, [swing, liveTvkShare]);

  // Arc geometry — semicircle from -90° (left) to +90° (right)
  // Negative swing = left/AIADMK, positive = right/DMK
  const SWING_RANGE = 15; // ±15pp
  const clampedSwing = Math.max(-SWING_RANGE, Math.min(SWING_RANGE, swing));
  const angleDeg = (clampedSwing / SWING_RANGE) * 90; // -90..+90
  const angleRad = (angleDeg * Math.PI) / 180;

  const w = variant === "scene" ? 720 : 480;
  const h = variant === "scene" ? 380 : 260;
  const cx = w / 2;
  const cy = h - 30;
  const r = (Math.min(w, h * 2) / 2) - 30;

  // Needle endpoint
  const nx = cx + r * Math.sin(angleRad);
  const ny = cy - r * Math.cos(angleRad);

  // Detected (auto) needle in dotted style
  const detectedClamped = Math.max(-SWING_RANGE, Math.min(SWING_RANGE, detectedSwing));
  const detectedAngleRad = ((detectedClamped / SWING_RANGE) * 90 * Math.PI) / 180;
  const dx = cx + (r - 12) * Math.sin(detectedAngleRad);
  const dy = cy - (r - 12) * Math.cos(detectedAngleRad);

  // Build arc segments per party — left half = AIADMK gain region, right = DMK gain region
  const dmkColor = partyById("DMK").color;
  const aiadmkColor = partyById("AIADMK").color;
  const tvkColor = partyById("TVK").color;

  const arcPath = (startA: number, endA: number, radius = r) => {
    const sx = cx + radius * Math.sin((startA * Math.PI) / 180);
    const sy = cy - radius * Math.cos((startA * Math.PI) / 180);
    const ex = cx + radius * Math.sin((endA * Math.PI) / 180);
    const ey = cy - radius * Math.cos((endA * Math.PI) / 180);
    const largeArc = Math.abs(endA - startA) > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} ${endA > startA ? 1 : 0} ${ex} ${ey}`;
  };

  return (
    <div className={variant === "scene" ? "card p-6 h-full" : "card p-5"}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3
            className={
              variant === "scene"
                ? "text-2xl font-black uppercase tracking-wide"
                : "text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]"
            }
          >
            {t("section.swingometer")}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t("swing.subtitle")}
          </p>
        </div>
        {manualSwing !== null && (
          <button
            onClick={() => setManualSwing(null)}
            className="text-xs px-2 py-1 rounded bg-[var(--bg-card-hover)] hover:bg-[var(--border)] uppercase tracking-wider"
          >
            {t("swing.resetLive")}
          </button>
        )}
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[720px]">
          {/* Background half-disc */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`} fill="rgba(255,255,255,0.02)" />

          {/* AIADMK arc (left: -90 to 0) */}
          <path
            d={arcPath(-90, 0)}
            stroke={aiadmkColor}
            strokeWidth={20}
            fill="none"
            opacity={0.85}
          />
          {/* DMK arc (right: 0 to 90) */}
          <path
            d={arcPath(0, 90)}
            stroke={dmkColor}
            strokeWidth={20}
            fill="none"
            opacity={0.85}
          />

          {/* Tick marks every 5pp */}
          {[-15, -10, -5, 0, 5, 10, 15].map((tick) => {
            const a = ((tick / SWING_RANGE) * 90 * Math.PI) / 180;
            const x1 = cx + (r - 14) * Math.sin(a);
            const y1 = cy - (r - 14) * Math.cos(a);
            const x2 = cx + (r + 6) * Math.sin(a);
            const y2 = cy - (r + 6) * Math.cos(a);
            const lx = cx + (r + 18) * Math.sin(a);
            const ly = cy - (r + 18) * Math.cos(a);
            return (
              <g key={tick}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={2} />
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgba(255,255,255,0.7)"
                  fontFamily="ui-monospace, monospace"
                >
                  {tick > 0 ? `+${tick}` : tick}
                </text>
              </g>
            );
          })}

          {/* Detected (live) needle — ghost */}
          <line
            x1={cx}
            y1={cy}
            x2={dx}
            y2={dy}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={3}
            strokeDasharray="6 4"
          />

          {/* Manual / current needle */}
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fef3c7" strokeWidth={4} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={10} fill="#fbbf24" stroke="#000" strokeWidth={2} />

          {/* Center label */}
          <text
            x={cx}
            y={cy + 30}
            textAnchor="middle"
            fontSize={variant === "scene" ? 22 : 16}
            fill="#fbbf24"
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
          >
            {Math.abs(clampedSwing).toFixed(1)}pp {swing > 0 ? "→ DMK" : swing < 0 ? "→ AIADMK" : ""}
          </text>

          {/* Side labels */}
          <text x={20} y={cy} fill={aiadmkColor} fontSize={14} fontWeight="bold">
            {t("swing.aiadmkGain")}
          </text>
          <text x={w - 130} y={cy} fill={dmkColor} fontSize={14} fontWeight="bold">
            {t("swing.dmkGain")}
          </text>
        </svg>

        {/* Slider input */}
        <input
          type="range"
          min={-SWING_RANGE}
          max={SWING_RANGE}
          step={0.5}
          value={swing}
          onChange={(e) => setManualSwing(parseFloat(e.target.value))}
          className="w-full max-w-[640px] mt-2"
          style={{ accentColor: "#fbbf24" }}
        />

        {/* Projection bar — gated to avoid showing 229 DMK from 7 Chennai ACs */}
        {isThinForProjection ? (
          <div className="w-full mt-4 px-3 py-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
            <div className="text-amber-300 text-sm font-bold uppercase tracking-wider">
              ⚠ Projection unavailable
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Need at least 10% of ACs reporting before uniform-swing projection is meaningful.
            </div>
          </div>
        ) : (
          <div className="w-full mt-4 grid grid-cols-4 gap-2">
            <ProjBox party="DMK" seats={projected.DMK} />
            <ProjBox party="AIADMK" seats={projected.AIADMK} />
            <ProjBox party="TVK" seats={projected.TVK} />
            <ProjBox party="NTK" seats={projected.NTK} />
          </div>
        )}
        <div className="text-[11px] text-[var(--text-muted)] mt-2 text-center">
          {t("swing.uniform", { n: MAJORITY_MARK })}
        </div>

        {/* Vote-share movement panel — anchors the swingometer needle into a
            three-bloc picture so TVK is visible as it grows. The dial above
            keeps the dramatic two-bloc swing reading; the bars below show
            where the votes actually moved between 2021 and now. */}
        <VoteShareMovement variant={variant} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Vote Share Movement panel — sits under the swingometer dial.
   Two stacked horizontal bars (2021 baseline → LIVE now) with a delta
   chip per bloc so the anchor can narrate the three-bloc story without
   pretending TVK doesn't exist.
   ────────────────────────────────────────────────────────────────────── */

type BlocSlice = {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  share2021: number;
  shareNow: number;
};

function VoteShareMovement({ variant }: { variant: "card" | "scene" }) {
  const { state } = useLiveData();
  const { t } = useLocale();

  // Compute "have live data?" first — only then synthesise the OTHERS bucket
  // for the NOW bar, so empty state doesn't render as "OTH 100%".
  const histShare: Record<string, number> = useMemo(
    () => Object.fromEntries(HISTORICAL_2021.map((h) => [h.partyId, h.voteShare])),
    [],
  );
  const liveShare: Record<string, number> = useMemo(
    () =>
      state ? Object.fromEntries(state.parties.map((p) => [p.partyId, p.voteShare])) : {},
    [state],
  );
  const haveLiveData = useMemo(
    () => Object.values(liveShare).some((v) => v > 0),
    [liveShare],
  );

  const slices = useMemo<BlocSlice[]>(() => {
    if (!state) return [];
    const out: BlocSlice[] = [];
    let used2021 = 0;
    let usedNow = 0;
    for (const bloc of FOCUS_BLOCS) {
      const s2021 = bloc.members.reduce((s, m) => s + (histShare[m] ?? 0), 0);
      const sNow = bloc.members.reduce((s, m) => s + (liveShare[m] ?? 0), 0);
      const anchor = partyById(bloc.anchorPartyId);
      out.push({
        id: bloc.id,
        label: bloc.label,
        shortLabel: bloc.shortLabel,
        color: anchor.color,
        share2021: s2021,
        shareNow: sNow,
      });
      used2021 += s2021;
      usedNow += sNow;
    }
    // OTHERS bucket: always include in 2021 (independent / IND seats are
    // real); only include in NOW once we have live data, otherwise it
    // would render as 100% "Others" in the empty state.
    out.push({
      id: "OTHERS",
      label: "Others / IND",
      shortLabel: "OTH",
      color: "#94a3b8",
      share2021: Math.max(0, 100 - used2021),
      shareNow: haveLiveData ? Math.max(0, 100 - usedNow) : 0,
    });
    return out;
  }, [state, histShare, liveShare, haveLiveData]);

  if (!state) return null;
  const reportingPct = ((state.declared + state.counting) / 234) * 100;

  return (
    <div className="w-full mt-5 pt-5 border-t border-white/10">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div>
          <h4
            className={
              variant === "scene"
                ? "text-base font-black uppercase tracking-wider"
                : "text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
            }
          >
            Vote share movement · 2021 → now
          </h4>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Where the votes actually moved. Adds the third-bloc picture
            (TVK) the dial above can&apos;t show.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          Reporting <span className="text-[var(--text-primary)] font-bold">{reportingPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Two stacked bars */}
      <ShareBar label="2021" slices={slices} which="share2021" />
      <ShareBar
        label="Now"
        slices={slices}
        which="shareNow"
        emptyHint={!haveLiveData ? "Awaiting first round vote-share data" : undefined}
      />

      {/* Per-bloc delta chips — what's the story per party */}
      {/* Per-bloc chips. Layout is vertical so each chip stays readable
          even at narrow widths (5-col grid on desktop = ~120px each).
          The biggest absolute mover gets a glow so the eye lands on the
          headline story (usually TVK on counting night). */}
      {(() => {
        const maxAbsDelta = haveLiveData
          ? Math.max(...slices.map((s) => Math.abs(s.shareNow - s.share2021)))
          : 0;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 mt-3">
            {slices.map((s) => {
              const delta = s.shareNow - s.share2021;
              const absDelta = Math.abs(delta);
              const dir = !haveLiveData
                ? "flat"
                : delta > 0.5
                  ? "up"
                  : delta < -0.5
                    ? "down"
                    : "flat";
              const dirChar = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
              const dirColor =
                dir === "up" ? "#10b981" : dir === "down" ? "#ef4444" : "#94a3b8";
              const isHero = haveLiveData && absDelta >= maxAbsDelta && maxAbsDelta > 1;
              return (
                <div
                  key={s.id}
                  className="rounded-md px-2 py-1.5 flex flex-col items-center text-center"
                  style={{
                    background: `${s.color}15`,
                    border: isHero
                      ? `2px solid ${s.color}`
                      : `1px solid ${s.color}40`,
                    boxShadow: isHero ? `0 0 12px -4px ${s.color}80` : undefined,
                  }}
                  title={`${s.label}: ${s.share2021.toFixed(1)}% (2021) → ${haveLiveData ? `${s.shareNow.toFixed(1)}%` : "—"} (now)`}
                >
                  <div
                    className="text-[9px] uppercase tracking-[0.15em] font-black leading-none"
                    style={{ color: s.color }}
                  >
                    {s.shortLabel}
                  </div>
                  <div
                    className="text-base font-black tabular leading-none mt-1"
                    style={{ color: s.color }}
                  >
                    {haveLiveData ? `${s.shareNow.toFixed(1)}%` : "—"}
                  </div>
                  <div
                    className="text-[10px] font-bold tabular leading-none mt-1 whitespace-nowrap"
                    style={{ color: dirColor }}
                  >
                    {dirChar}{" "}
                    {haveLiveData
                      ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp`
                      : "—"}
                  </div>
                  <div className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] tabular leading-none mt-1">
                    from {s.share2021.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* TVK-aware caveat — appears once TVK >= 15% statewide */}
      {(() => {
        const tvk = slices.find((s) => s.id === "TVK");
        if (!tvk || tvk.shareNow < 15) return null;
        return (
          <div className="mt-3 px-3 py-2 rounded-md text-[11px] bg-amber-500/10 border border-amber-500/40 text-amber-200">
            <strong>Three-bloc race active:</strong> TVK is at{" "}
            {tvk.shareNow.toFixed(1)}% statewide. The swingometer dial above is
            now reading <em>residual</em> DMK-vs-AIADMK swing only — read the
            bar movement here for the full picture.
          </div>
        );
      })()}
      {/* Help line */}
      <div className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
        Each bar sums to 100%. Δ shows percentage-point change vs 2021.
      </div>
    </div>
  );
}

function ShareBar({
  label,
  slices,
  which,
  emptyHint,
}: {
  label: string;
  slices: BlocSlice[];
  which: "share2021" | "shareNow";
  emptyHint?: string;
}) {
  const total = slices.reduce((s, x) => s + x[which], 0);
  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold w-10 shrink-0 text-right">
          {label}
        </div>
        <div className="flex-1 h-7 rounded-md overflow-hidden flex bg-black/30 relative">
          {emptyHint ? (
            <div className="w-full grid place-items-center text-[10px] uppercase tracking-wider text-white/45">
              {emptyHint}
            </div>
          ) : (
            slices.map((s) => {
              const pct = total > 0 ? (s[which] / total) * 100 : 0;
              if (pct < 0.1) return null;
              return (
                <div
                  key={s.id}
                  title={`${s.label} · ${s[which].toFixed(1)}%`}
                  className="h-full flex items-center justify-center text-[10px] font-bold text-black/85 overflow-hidden"
                  style={{
                    width: `${pct}%`,
                    background: s.color,
                  }}
                >
                  {pct >= 6 ? `${s.shortLabel} ${s[which].toFixed(0)}` : ""}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ProjBox({ party, seats }: { party: string; seats: number }) {
  const p = partyById(party);
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: `${p.color}18`, border: `1px solid ${p.color}40` }}>
      <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.color }}>
        {p.name}
      </div>
      <div className="text-2xl font-black tabular" style={{ color: p.color }}>
        {seats}
      </div>
    </div>
  );
}
