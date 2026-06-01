"use client";
import Link from "next/link";
import { formatIndian } from "@/lib/cn";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById, blocOf } from "@/lib/parties";
import { get2021ForAc } from "@/lib/historical-by-ac";

const OTHERS_COLOR = "#94a3b8";
// Bumped from 0.12 → 0.32 so the TN outline always reads on broadcast.
// At 0.12 the polygons of unreported ACs were nearly invisible against
// the dark scene background — the map looked empty when only a handful
// of seats had data.
const PENDING_COLOR = "rgba(180,200,225,0.32)";
const PENDING_STROKE = "rgba(255,255,255,0.18)";

type TnMapData = {
  shapes: Array<{ acId: number; d: string; cx: number; cy: number }>;
  width: number;
  height: number;
};

export function TnMap({ variant = "card" }: { variant?: "card" | "scene" }) {
  const [data, setData] = useState<TnMapData | null>(null);
  useEffect(() => {
    fetch("/api/tn-map")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data) {
    return (
      <div className={variant === "scene" ? "card p-6 h-full grid place-items-center" : "card p-6 grid place-items-center min-h-[400px]"}>
        <div className="text-[var(--text-muted)] text-sm">Loading TN map…</div>
      </div>
    );
  }
  return <TnMapBody data={data} variant={variant} />;
}

function TnMapBody({
  data,
  variant = "card",
}: {
  data: TnMapData;
  variant?: "card" | "scene";
}) {
  const [hover, setHover] = useState<{
    acId: number;
    x: number;
    y: number;
  } | null>(null);
  // Zoom + pan state. (1, 0, 0) = default fit-to-viewport.
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);

  function zoom(delta: number, cx?: number, cy?: number) {
    setView((v) => {
      const newScale = Math.max(1, Math.min(8, v.scale + delta));
      if (newScale === v.scale) return v;
      // Zoom around the cursor (or viewport center if not given)
      const zx = cx ?? data.width / 2;
      const zy = cy ?? data.height / 2;
      // Keep the zoomed-around point stable
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
  const { constituencies } = useLiveData();
  const { t } = useLocale();

  // Build per-AC display state (color + flip outline)
  const acState = useMemo(() => {
    const m = new Map<
      number,
      { color: string; flipped: boolean; isOthers: boolean; lead: { partyId: string; margin: number } | null }
    >();
    for (const c of constituencies) {
      const lead = c.leadingCandidate;
      const hist = get2021ForAc(c.constituencyId, c.district);
      const currentBloc = lead ? blocOf(lead.partyId) : null;
      const oldBloc = blocOf(hist.winner);
      const flipped = !!lead && currentBloc !== oldBloc;
      const isOthers = !!lead && !currentBloc;
      // Color by ACTUAL party (BJP=orange, INC=blue, etc.) so a BJP win
      // doesn't look like AIADMK and an INC win doesn't look like DMK.
      // Flip detection still operates at the bloc level above.
      const color = !lead
        ? PENDING_COLOR
        : currentBloc
          ? partyById(lead.partyId).color
          : OTHERS_COLOR;
      m.set(c.constituencyId, {
        color,
        flipped,
        isOthers,
        lead: lead ? { partyId: lead.partyId, margin: lead.margin } : null,
      });
    }
    return m;
  }, [constituencies]);

  // Distinct ACTUAL parties currently leading — feeds the legend so a BJP
  // win shows an orange chip (not folded into AIADMK green).
  const leadingBlocs = useMemo(() => {
    const set = new Set<string>();
    let hasOthers = false;
    for (const [, st] of acState) {
      if (!st.lead) continue;
      if (st.isOthers) hasOthers = true;
      else set.add(st.lead.partyId);
    }
    const out = Array.from(set);
    if (hasOthers) out.push("OTHERS");
    return out;
  }, [acState]);

  const containerClasses =
    variant === "scene" ? "card p-4 h-full overflow-hidden" : "card p-4";

  const hoveredAc = hover
    ? constituencies.find((c) => c.constituencyId === hover.acId)
    : null;
  const hoveredHist = hover ? get2021ForAc(hover.acId, hoveredAc?.district ?? "") : null;
  const hoveredFlipped = hover && hoveredAc?.leadingCandidate
    ? blocOf(hoveredAc.leadingCandidate.partyId) !== blocOf(hoveredHist!.winner)
    : false;

  return (
    <div className={`${containerClasses} relative`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3
          className={
            variant === "scene"
              ? "text-2xl font-black uppercase tracking-wide"
              : "text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]"
          }
        >
          {t("section.swingMap")}
        </h3>
        <Legend leadingBlocs={leadingBlocs} />
      </div>
      <div
        className="flex justify-center w-full h-full relative"
        style={{
          minHeight: variant === "scene" ? "calc(100vh - 220px)" : 500,
        }}
      >
        <svg
          viewBox={`0 0 ${data.width} ${data.height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          onWheel={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            // map screen coords to viewBox coords
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
            // Convert screen drag to viewBox units
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
            const st = acState.get(s.acId);
            const color = st?.color ?? PENDING_COLOR;
            const flipped = st?.flipped ?? false;
            const lead = st?.lead;
            const c = constituencies.find((x) => x.constituencyId === s.acId);
            return (
              <Link key={s.acId} href={`/broadcast/ac/${s.acId}`}>
                <g>
                  <path
                    d={s.d}
                    fill={color}
                    fillOpacity={lead ? 0.92 : 0.85}
                    stroke={
                      hover?.acId === s.acId
                        ? "#facc15"
                        : flipped
                          ? "#ffffff"
                          : PENDING_STROKE
                    }
                    strokeWidth={hover?.acId === s.acId ? 2.5 : flipped ? 2.2 : 0.7}
                    strokeLinejoin="round"
                    onMouseEnter={(e) =>
                      setHover({
                        acId: s.acId,
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                      })
                    }
                    onMouseMove={(e) =>
                      setHover({
                        acId: s.acId,
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              </Link>
            );
          })}
          </g>
        </svg>
        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg p-1">
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
      <p className="text-[11px] text-[var(--text-muted)] mt-2 text-center">
        {t("swingMap.subtitle")}
      </p>

      {/* Hover tooltip — follows cursor */}
      {hover && hoveredAc && (
        <div
          className="absolute pointer-events-none z-20 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-lg shadow-xl px-3 py-2 text-sm"
          style={{
            left: Math.min(hover.x + 16, 1200),
            top: Math.max(hover.y - 60, 0),
          }}
        >
          <div className="font-bold text-base">
            {hoveredAc.constituencyName}{" "}
            <span className="text-[var(--text-muted)] font-normal text-xs">
              AC#{hoveredAc.constituencyId}
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {hoveredAc.district}
          </div>
          {hoveredAc.leadingCandidate ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: `${partyById(hoveredAc.leadingCandidate.partyId).color}30`,
                  color: partyById(hoveredAc.leadingCandidate.partyId).color,
                  border: `1px solid ${partyById(hoveredAc.leadingCandidate.partyId).color}60`,
                }}
              >
                {partyById(hoveredAc.leadingCandidate.partyId).name}
              </span>
              <span className="font-medium text-sm">
                {hoveredAc.leadingCandidate.name}
              </span>
            </div>
          ) : (
            <div className="mt-1.5 text-xs text-[var(--text-muted)]">Awaiting…</div>
          )}
          {hoveredAc.leadingCandidate && (
            <div className="text-xs mt-1 tabular">
              <span className="text-[var(--text-muted)]">Margin:</span>{" "}
              <span
                className="font-bold"
                style={{ color: partyById(hoveredAc.leadingCandidate.partyId).color }}
              >
                +{formatIndian(hoveredAc.leadingCandidate.margin)}
              </span>
              <span className="text-[var(--text-muted)] ml-2">
                · R{hoveredAc.round}/{hoveredAc.totalRounds}
              </span>
            </div>
          )}
          {hoveredHist && (
            <div className="text-[10px] mt-1 text-[var(--text-muted)] uppercase tracking-wider">
              2021: <span style={{ color: partyById(hoveredHist.winner).color }} className="font-bold">{hoveredHist.winner}</span>
              {hoveredFlipped && (
                <span className="ml-2 text-amber-400 font-bold">↻ FLIPPED</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ leadingBlocs }: { leadingBlocs: string[] }) {
  const baseParties = ["DMK", "AIADMK", "TVK", "NTK"];
  const allParties = Array.from(new Set([...baseParties, ...leadingBlocs]));
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {allParties.map((p) => {
        if (p === "OTHERS") {
          return (
            <div key={p} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ background: OTHERS_COLOR }}
              />
              <span style={{ color: OTHERS_COLOR }} className="font-bold">
                Others
              </span>
            </div>
          );
        }
        const party = partyById(p);
        return (
          <div key={p} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: party.color }}
            />
            <span style={{ color: party.color }} className="font-bold">
              {party.name}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span
          className="w-3 h-3 rounded-sm border-2 border-white"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />
        <span className="text-white font-bold">Flipped vs 2021</span>
      </div>
    </div>
  );
}
