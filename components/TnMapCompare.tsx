"use client";
import Link from "next/link";
import { formatIndian } from "@/lib/cn";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById, blocOf } from "@/lib/parties";
import { get2021ForAc } from "@/lib/historical-by-ac";
import {
  RESERVATION_COLORS,
  URBANITY_COLORS,
  LITERACY_LEGEND,
  SEX_RATIO_LEGEND,
  RELIGION_LEGEND,
  COMMUNITY_COLORS,
  demographicsForDistrict,
  literacyColor,
  sexRatioColor,
  religionColor,
  communityColor,
} from "@/lib/demographics";
import constituenciesJson from "@/data/constituencies.json";

// AC reservation lookup — ConstituencySummary doesn't carry the reservation
// field (ECI live data is about results, not structural metadata), so pull
// from the same static source the seeder uses.
const AC_RESERVATION: Record<number, "GEN" | "SC" | "ST"> = Object.fromEntries(
  (constituenciesJson as Array<{ id: number; reservation: string }>).map(
    (c) => [c.id, (c.reservation as "GEN" | "SC" | "ST") ?? "GEN"],
  ),
);

/** Resolve the polygon color for an AC under a demographic color mode. */
function demographicColorFor(
  mode: "reservation" | "urban-rural" | "literacy" | "sex-ratio" | "religion" | "community",
  acId: number,
  district: string,
): string {
  if (mode === "reservation") {
    const r = AC_RESERVATION[acId] ?? "GEN";
    return RESERVATION_COLORS[r].color;
  }
  if (mode === "community") return communityColor(district);
  const demo = demographicsForDistrict(district);
  if (mode === "urban-rural") return URBANITY_COLORS[demo.urbanity].color;
  if (mode === "literacy") return literacyColor(demo.literacyPct);
  if (mode === "sex-ratio") return sexRatioColor(demo.sexRatio);
  if (mode === "religion") return religionColor(demo);
  return OTHERS_COLOR;
}

const OTHERS_COLOR = "#94a3b8";
// Bumped from 0.12 → 0.32 so all 234 polygons are visible even when only
// a handful of ACs have data. Otherwise the 2026 panel looked empty next
// to the fully-coloured 2021 baseline.
const PENDING_COLOR = "rgba(180,200,225,0.32)";
const PENDING_STROKE = "rgba(255,255,255,0.18)";

type TnMapData = {
  shapes: Array<{ acId: number; d: string; cx: number; cy: number }>;
  width: number;
  height: number;
};

/**
 * Side-by-side TN map: 2021 outcome (left) vs 2026 current (right).
 * Hover state is shared so highlighting AC#13 on either map highlights it
 * on both. The whole component is one card, full height in scene mode.
 */
export function TnMapCompare({ variant = "scene" }: { variant?: "scene" | "card" }) {
  const [data, setData] = useState<TnMapData | null>(null);
  useEffect(() => {
    fetch("/api/tn-map")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data) {
    return (
      <div className="card p-6 grid place-items-center min-h-[400px]">
        <div className="text-[var(--text-muted)] text-sm">Loading TN map…</div>
      </div>
    );
  }
  return <TnMapCompareBody data={data} variant={variant} />;
}

function TnMapCompareBody({
  data,
  variant,
}: {
  data: TnMapData;
  variant: "scene" | "card";
}) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();
  const [hoverAcId, setHoverAcId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  // Shared zoom/pan — applied to BOTH map panes simultaneously
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);

  // Stack maps vertically only when the container is REALLY narrow (e.g.
  // sidebar/card mode). In side-by-side mode the cells use min-w-0 so they
  // shrink to share the available width — slightly smaller than their natural
  // 698px aspect-derived width, but readable and far bigger than what stacked
  // mode produces. Threshold = 900px so right-pane (1344px on 1080p canvas)
  // happily uses side-by-side.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setStacked(w < 900);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Color mode — controls how each AC polygon is shaded.
  //
  // Political modes (use the live-results data):
  //   "party"     — actual winning/leading party color (BJP orange, INC blue…).
  //   "alliance"  — collapses members into bloc anchor color (INDIA red, NDA
  //                 green, TVK yellow, NTK purple) for the macro pattern.
  //
  // Demographic modes (use Census 2011 + AC reservation data, NOT live results
  // — both 2021 and 2026 panes show identical shading; the comparison value is
  // overlaying political winners on top of demographic structure).
  //   "reservation" — SC / ST / GEN per AC (already in constituencies.json).
  //   "urban-rural" — Urban / Semi-urban / Rural by parent district.
  //   "literacy"    — district-level literacy % (Census 2011), 5-step scale.
  //   "sex-ratio"   — district-level F/1000M (Census 2011), 4-step scale.
  // Persists per-browser via localStorage.
  type ColorMode =
    | "party"
    | "alliance"
    | "reservation"
    | "urban-rural"
    | "literacy"
    | "sex-ratio"
    | "religion"
    | "community";
  const VALID_MODES: ColorMode[] = [
    "party", "alliance", "reservation", "urban-rural",
    "literacy", "sex-ratio", "religion", "community",
  ];
  const [colorMode, setColorMode] = useState<ColorMode>("party");
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("tn-swingmap-color-mode")
      : null;
    if (stored && (VALID_MODES as string[]).includes(stored)) {
      setColorMode(stored as ColorMode);
    }
  }, []);
  const setMode = (m: ColorMode) => {
    setColorMode(m);
    if (typeof window !== "undefined") {
      localStorage.setItem("tn-swingmap-color-mode", m);
    }
  };
  const isDemographic =
    colorMode === "reservation" ||
    colorMode === "urban-rural" ||
    colorMode === "literacy" ||
    colorMode === "sex-ratio" ||
    colorMode === "religion" ||
    colorMode === "community";
  // Tier 2 = community heartland classification (academic/journalistic
  // estimates, not Census). Show a prominent disclaimer banner when on.
  const isTier2Estimate = colorMode === "community";

  function zoom(delta: number, cx?: number, cy?: number) {
    setView((v) => {
      const newScale = Math.max(1, Math.min(8, v.scale + delta));
      if (newScale === v.scale) return v;
      const zx = cx ?? data.width / 2;
      const zy = cy ?? data.height / 2;
      const k = newScale / v.scale;
      return {
        scale: newScale,
        tx: zx - (zx - v.tx) * k,
        ty: zy - (zy - v.ty) * k,
      };
    });
  }
  function resetView() {
    setView({ scale: 1, tx: 0, ty: 0 });
  }

  // Build per-AC color/flip data for both maps
  const acData = useMemo(() => {
    const m = new Map<
      number,
      {
        currentColor: string;
        oldColor: string;
        currentBloc: string | null;
        oldBloc: string | null;
        currentIsOthers: boolean;
        oldIsOthers: boolean;
        flipped: boolean;
        lead: { partyId: string; name: string; margin: number } | null;
        oldWinnerParty: string;
      }
    >();
    for (const c of constituencies) {
      const lead = c.leadingCandidate;
      const hist = get2021ForAc(c.constituencyId, c.district);
      const currentBloc = lead ? blocOf(lead.partyId) : null;
      const oldBloc = blocOf(hist.winner);
      const currentIsOthers = !!lead && !currentBloc;
      const oldIsOthers = !oldBloc;
      // Color depends on `colorMode`:
      //   - "party":   use the actual party's color (BJP orange, INC blue…)
      //   - "alliance": collapse to the bloc anchor's color (INDIA red,
      //                 NDA green) so the macro pattern reads at a glance.
      //   - demographic modes (reservation/urban-rural/literacy/sex-ratio):
      //                 BOTH panes show the same demographic shading; the
      //                 comparative value is overlaying political winners
      //                 (still rendered via outline / chip on hover) on
      //                 top of structural demographic patterns.
      // Flip detection still operates at the bloc level either way.
      let currentColor: string;
      let oldColor: string;
      if (
        colorMode === "reservation" ||
        colorMode === "urban-rural" ||
        colorMode === "literacy" ||
        colorMode === "sex-ratio" ||
        colorMode === "religion" ||
        colorMode === "community"
      ) {
        // 2021 (left) pane → the demographic / structural pattern.
        // 2026 (right) pane → live winning ALLIANCE color so the operator
        // can see "look how alliance X did in this demographic region".
        // (Per user request 2026-05-03: don't shade both panes identically
        // in demographic modes — the live story stays on the 2026 side.)
        oldColor = demographicColorFor(
          colorMode,
          c.constituencyId,
          c.district,
        );
        currentColor = !lead
          ? PENDING_COLOR
          : currentBloc
            ? partyById(currentBloc).color // alliance anchor color
            : OTHERS_COLOR;
      } else {
        currentColor = !lead
          ? PENDING_COLOR
          : currentBloc
            ? colorMode === "alliance"
              ? partyById(currentBloc).color
              : partyById(lead.partyId).color
            : OTHERS_COLOR;
        oldColor = oldBloc
          ? colorMode === "alliance"
            ? partyById(oldBloc).color
            : partyById(hist.winner).color
          : OTHERS_COLOR;
      }
      const flipped = !!lead && currentBloc !== oldBloc;
      m.set(c.constituencyId, {
        currentColor,
        oldColor,
        currentBloc,
        oldBloc,
        currentIsOthers,
        oldIsOthers,
        flipped,
        lead: lead
          ? {
              partyId: lead.partyId,
              name: lead.name,
              margin: lead.margin,
            }
          : null,
        oldWinnerParty: hist.winner,
      });
    }
    return m;
  }, [constituencies, colorMode]);

  const hoveredAc = hoverAcId
    ? constituencies.find((c) => c.constituencyId === hoverAcId)
    : null;
  const hoveredState = hoverAcId ? acData.get(hoverAcId) : null;

  // Distinct ACTUAL parties across both maps for the legend
  const leadingBlocs = useMemo(() => {
    const set = new Set<string>();
    let hasOthers = false;
    for (const [, st] of acData) {
      if (st.lead) {
        if (st.currentIsOthers) hasOthers = true;
        else set.add(st.lead.partyId);
      }
      if (st.oldBloc) set.add(st.oldWinnerParty);
      else if (st.oldIsOthers) hasOthers = true;
    }
    const out = Array.from(set);
    if (hasOthers) out.push("OTHERS");
    return out;
  }, [acData]);

  return (
    <div
      className={
        variant === "scene"
          ? "card p-2 sm:p-3 h-full overflow-hidden flex flex-col relative"
          : "card p-4 relative"
      }
    >
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h3
            className={
              variant === "scene"
                ? "text-base sm:text-lg font-black uppercase tracking-wide"
                : "text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]"
            }
          >
            {t("section.swingMap")}
          </h3>
          {/* Color-mode toggle. Two political modes (party/alliance) +
              four demographic overlays. Demographic modes shade BOTH map
              panes by the same Census/structural attribute — political
              winners still land via the hover tooltip + flip outline. */}
          <div className="inline-flex flex-wrap bg-black/40 border border-white/15 rounded-md overflow-hidden text-[10px]">
            {(
              [
                { id: "party",       label: "Party",       title: "Color by individual party (BJP orange, INC blue, …)" },
                { id: "alliance",    label: "Alliance",    title: "Color by alliance bloc (INDIA red, NDA green, TVK yellow, NTK purple)" },
                { id: "reservation", label: "SC/ST",       title: "Color by AC reservation status (GEN/SC/ST). Source: ECI delimitation." },
                { id: "urban-rural", label: "Urban/Rural", title: "Color by district urbanisation. Source: Census 2011 (district level)." },
                { id: "literacy",    label: "Literacy",    title: "Color by district literacy %. Source: Census 2011 (district level)." },
                { id: "sex-ratio",   label: "F/M",         title: "Color by district sex ratio (females per 1000 males). Source: Census 2011 (district level)." },
                { id: "religion",    label: "Religion",    title: "Highlight Muslim and Christian-significant districts. Source: Census 2011 (district level)." },
                { id: "community",   label: "Community ⚠", title: "INDICATIVE community heartland (Nadar / Mukkulathor / Vanniyar / Gounder / Coastal-fisher). Based on academic + journalistic sources, NOT Census enumeration." },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={
                  "font-black uppercase tracking-wider px-2 py-0.5 transition-colors " +
                  (colorMode === m.id
                    ? "bg-amber-400 text-black"
                    : "text-white/55 hover:bg-white/10 hover:text-white")
                }
                title={m.title}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {isDemographic ? (
          <DemographicLegend mode={colorMode} />
        ) : (
          <Legend leadingBlocs={leadingBlocs} colorMode={colorMode} />
        )}
      </div>
      {isTier2Estimate && (
        <div className="mb-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/45 text-amber-200 text-[11px] leading-snug shrink-0">
          <strong className="uppercase tracking-wider">⚠ Indicative pattern, not Census</strong> ·
          Caste hasn&apos;t been formally enumerated since 1931. This layer reflects
          widely-cited regional associations (CSDS-Lokniti, Frontline, academic
          analyses) — treat as <em>directional</em>, not a precise demographic
          map. Use spoken framing like &ldquo;X-leaning area&rdquo;, never quote
          a percentage.
        </div>
      )}
      {/* Two map cells, each aspect-locked to TN's projected aspect.
          When the pane is too narrow for both maps side-by-side
          (e.g. 60% scene with camera-frame on the left), stack them
          vertically so they each get the full pane width. */}
      <div
        ref={containerRef}
        className={
          (stacked ? "flex flex-col" : "flex flex-row") +
          " gap-2 sm:gap-3 flex-1 min-h-0 justify-center items-center relative"
        }
      >
        <MapPane
          title="2021"
          subtitle={t("section.vs2021")}
          data={data}
          acData={acData}
          colorKey="oldColor"
          hoverAcId={hoverAcId}
          view={view}
          setView={setView}
          dragRef={dragRef}
          zoom={zoom}
          setHoverAcId={(id, e) => {
            setHoverAcId(id);
            if (e && id) {
              const rect = (e.currentTarget as Element).getBoundingClientRect();
              setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12 });
            }
          }}
        />
        <MapPane
          title="2026"
          subtitle="LIVE"
          data={data}
          acData={acData}
          colorKey="currentColor"
          hoverAcId={hoverAcId}
          view={view}
          setView={setView}
          dragRef={dragRef}
          zoom={zoom}
          setHoverAcId={(id, e) => {
            setHoverAcId(id);
            if (e && id) {
              const rect = (e.currentTarget as Element).getBoundingClientRect();
              setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12 });
            }
          }}
          showFlipOutline
        />
        {/* Shared zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg p-1 z-10">
          <button
            onClick={() => zoom(0.5)}
            title="Zoom in"
            className="w-8 h-8 grid place-items-center text-lg font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors"
          >
            +
          </button>
          <button
            onClick={() => zoom(-0.5)}
            title="Zoom out"
            className="w-8 h-8 grid place-items-center text-lg font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors"
          >
            −
          </button>
          <button
            onClick={resetView}
            title="Reset view"
            className="w-8 h-8 grid place-items-center text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors"
          >
            ⊙
          </button>
        </div>
      </div>

      {/* Shared hover tooltip — fixed position */}
      {hoveredAc && hoveredState && tooltipPos && (
        <div
          className="absolute pointer-events-none z-30 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-lg shadow-2xl px-3 py-2 text-sm"
          style={{
            left: Math.min(tooltipPos.x, 1400),
            top: Math.max(tooltipPos.y, 80),
          }}
        >
          <div className="font-bold text-base">
            {hoveredAc.constituencyName}{" "}
            <span className="text-[var(--text-muted)] font-normal text-xs">AC#{hoveredAc.constituencyId}</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">{hoveredAc.district}</div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">2021</div>
              <span className="font-bold" style={{ color: partyById(hoveredState.oldWinnerParty).color }}>
                {partyById(hoveredState.oldWinnerParty).name}
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">2026</div>
              {hoveredState.lead ? (
                <>
                  <div className="font-bold" style={{ color: partyById(hoveredState.lead.partyId).color }}>
                    {partyById(hoveredState.lead.partyId).name}
                  </div>
                  <div className="text-xs">{hoveredState.lead.name}</div>
                  <div className="text-xs tabular text-[var(--accent-counting)] mt-0.5">
                    +{formatIndian(hoveredState.lead.margin)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">Awaiting…</div>
              )}
            </div>
          </div>
          {hoveredState.flipped && (
            <div className="mt-2 text-[10px] uppercase tracking-wider text-amber-400 font-bold">
              ↻ FLIPPED · {partyById(hoveredState.oldWinnerParty).name} → {hoveredState.currentBloc ? partyById(hoveredState.currentBloc).name : "Others"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AcRow = {
  currentColor: string;
  oldColor: string;
  currentBloc: string | null;
  oldBloc: string | null;
  currentIsOthers: boolean;
  oldIsOthers: boolean;
  flipped: boolean;
  lead: { partyId: string; name: string; margin: number } | null;
  oldWinnerParty: string;
};

function MapPane({
  title,
  subtitle,
  data,
  acData,
  colorKey,
  hoverAcId,
  setHoverAcId,
  view,
  setView,
  dragRef,
  zoom,
  showFlipOutline = false,
}: {
  title: string;
  subtitle: string;
  data: TnMapData;
  acData: Map<number, AcRow>;
  colorKey: "currentColor" | "oldColor";
  hoverAcId: number | null;
  setHoverAcId: (id: number | null, e?: React.MouseEvent<Element>) => void;
  view: { scale: number; tx: number; ty: number };
  setView: React.Dispatch<React.SetStateAction<{ scale: number; tx: number; ty: number }>>;
  dragRef: React.RefObject<{ startX: number; startY: number; tx: number; ty: number } | null>;
  zoom: (delta: number, cx?: number, cy?: number) => void;
  showFlipOutline?: boolean;
}) {
  return (
    // h-full + aspect-[4/5] sizes the cell to TN's natural portrait shape.
    // The cell takes max-height of the parent row, then derives width from
    // aspect — no horizontal empty bands inside the cell. The two cells
    // sit side-by-side centered in the row, with row-edge whitespace
    // taking up any leftover horizontal space.
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)]/50 flex flex-col h-full min-w-0 flex-1"
      style={{ aspectRatio: `${data.width} / ${data.height + 32}` }}
    >
      <div className="px-2 py-1 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <span className="text-[11px] font-black uppercase tracking-widest">{title}</span>
        <span className={`text-[9px] uppercase tracking-wider ${title === "2026" ? "text-[var(--accent-live)]" : "text-[var(--text-muted)]"}`}>
          {subtitle}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${data.width} ${data.height}`}
          className="block w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          onWheel={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const vbX = ((e.clientX - rect.left) / rect.width) * data.width;
            const vbY = ((e.clientY - rect.top) / rect.height) * data.height;
            zoom(e.deltaY < 0 ? 0.5 : -0.5, vbX, vbY);
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              tx: view.tx,
              ty: view.ty,
            };
          }}
          onMouseMove={(e) => {
            if (!dragRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const dxScreen = e.clientX - dragRef.current.startX;
            const dyScreen = e.clientY - dragRef.current.startY;
            const dxVb = (dxScreen / rect.width) * data.width;
            const dyVb = (dyScreen / rect.height) * data.height;
            setView((v) => ({
              ...v,
              tx: dragRef.current!.tx + dxVb,
              ty: dragRef.current!.ty + dyVb,
            }));
          }}
          onMouseUp={() => {
            dragRef.current = null;
          }}
          onMouseLeave={() => {
            dragRef.current = null;
          }}
          style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
        >
          <g transform={`translate(${view.tx}, ${view.ty}) scale(${view.scale})`}>
            {data.shapes.map((s) => {
              const st = acData.get(s.acId);
              const color = st ? st[colorKey] : PENDING_COLOR;
              const isHovered = hoverAcId === s.acId;
              const flipped = showFlipOutline && st?.flipped;
              return (
                <Link key={s.acId} href={`/broadcast/ac/${s.acId}`}>
                  <path
                    d={s.d}
                    fill={color}
                    fillOpacity={
                      colorKey === "currentColor"
                        ? st?.lead
                          ? 0.92
                          : 0.85 // pending fills with the dim PENDING_COLOR but full opacity multiplier — so the TN outline is always legible
                        : 0.85
                    }
                    stroke={
                      isHovered
                        ? "#facc15"
                        : flipped
                          ? "#ffffff"
                          : PENDING_STROKE
                    }
                    strokeWidth={isHovered ? 2.5 : flipped ? 2.2 : 0.7}
                    strokeLinejoin="round"
                    onMouseEnter={(e) => setHoverAcId(s.acId, e)}
                    onMouseMove={(e) => setHoverAcId(s.acId, e)}
                    onMouseLeave={() => setHoverAcId(null)}
                    style={{ cursor: "pointer" }}
                  />
                </Link>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

function Legend({
  leadingBlocs,
  colorMode,
}: {
  leadingBlocs: string[];
  colorMode: "party" | "alliance";
}) {
  if (colorMode === "alliance") {
    // Just the four broadcast blocs in their anchor colors. No per-party
    // breakdown — that's the whole point of alliance mode.
    const blocs = [
      { id: "DMK", label: "SPA (DMK+)" },
      { id: "AIADMK", label: "NDA (AIADMK+)" },
      { id: "TVK", label: "TVK" },
      { id: "NTK", label: "NTK" },
    ];
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {blocs.map((b) => {
          const party = partyById(b.id);
          return (
            <div key={b.id} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ background: party.color }}
              />
              <span style={{ color: party.color }} className="font-bold">
                {b.label}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ background: OTHERS_COLOR }}
          />
          <span style={{ color: OTHERS_COLOR }} className="font-bold">
            Others
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className="w-3 h-3 rounded-sm border-2 border-white"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
          <span className="text-white font-bold">Flipped</span>
        </div>
      </div>
    );
  }
  const baseParties = ["DMK", "AIADMK", "TVK", "NTK"];
  const allParties = Array.from(new Set([...baseParties, ...leadingBlocs]));
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {allParties.map((p) => {
        if (p === "OTHERS") {
          return (
            <div key={p} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded-sm" style={{ background: OTHERS_COLOR }} />
              <span style={{ color: OTHERS_COLOR }} className="font-bold">Others</span>
            </div>
          );
        }
        const party = partyById(p);
        return (
          <div key={p} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 rounded-sm" style={{ background: party.color }} />
            <span style={{ color: party.color }} className="font-bold">{party.name}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="w-3 h-3 rounded-sm border-2 border-white" style={{ background: "rgba(255,255,255,0.1)" }} />
        <span className="text-white font-bold">Flipped</span>
      </div>
    </div>
  );
}

/** Legend for the demographic overlay modes — categorical or gradient
 *  swatches plus a tiny attribution chip so the source is never
 *  ambiguous on air. */
function DemographicLegend({
  mode,
}: {
  mode: "reservation" | "urban-rural" | "literacy" | "sex-ratio" | "religion" | "community";
}) {
  const items: Array<{ color: string; label: string }> =
    mode === "reservation"
      ? Object.values(RESERVATION_COLORS)
      : mode === "urban-rural"
        ? Object.values(URBANITY_COLORS)
        : mode === "literacy"
          ? LITERACY_LEGEND
          : mode === "sex-ratio"
            ? SEX_RATIO_LEGEND
            : mode === "religion"
              ? RELIGION_LEGEND
              : Object.values(COMMUNITY_COLORS).map((c) => ({ color: c.color, label: c.label }));
  const source =
    mode === "reservation"
      ? "ECI delimitation"
      : mode === "community"
        ? "CSDS / Frontline / academic — INDICATIVE"
        : "Census 2011 · district level";
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-3 rounded-sm" style={{ background: it.color }} />
          <span className="text-white/80 font-bold">{it.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[10px] pl-2 ml-1 border-l border-white/15">
        <span className="text-white/45 uppercase tracking-wider">Src:</span>
        <span
          className={
            mode === "community"
              ? "text-amber-300 font-bold"
              : "text-white/65 font-bold"
          }
        >
          {source}
        </span>
      </div>
    </div>
  );
}
