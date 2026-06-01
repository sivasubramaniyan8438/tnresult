"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveData } from "@/components/LiveDataProvider";
import { partyById } from "@/lib/parties";
import type { OtherState, OtherStatePartyRow } from "@/lib/states";
import { TickingNumber } from "@/components/TickingNumber";
import { ChyronOverlay } from "@/components/ChyronOverlay";
import { formatIndian } from "@/lib/cn";
import { BroadcastTopStrip } from "@/components/BroadcastTopStrip";
import { AllianceTotalsStrip } from "@/components/AllianceTotalsStrip";
import { LiveTicker } from "@/components/LiveTicker";
import { useTenant } from "@/components/TenantProvider";
import { CameraTile } from "@/components/CameraTile";

/**
 * National multi-state broadcast — same persistent chrome as /broadcast,
 * with the scene area dedicated to non-TN state cards plus a center
 * camera area that the OBS anchor video composites onto.
 *
 *  ┌────────────────────────────────────────────────────────────┐
 *  │ [28px] Naadhas · ProxyN · reporting · LIVE · clock        │
 *  ├────────────────────────────────────────────────────────────┤
 *  │ [56px] TN ALLIANCE TOTALS — INDIA · NDA · TVK · NTK       │
 *  ├────────────────────────────────────────────────────────────┤
 *  │  ┌───────────────┬────────────────────┬───────────────┐    │
 *  │  │  STATE 1      │  CAMERA AREA       │  STATE 2      │    │
 *  │  │  KL           │  (transparent for  │  WB           │    │
 *  │  │               │   OBS composite)   │               │    │
 *  │  │  totals       │  + lower-third     │  totals       │    │
 *  │  │  party rows   │    chyron strip    │  party rows   │    │
 *  │  └───────────────┴────────────────────┴───────────────┘    │
 *  │  ┌─────┬─────┬─────┬─────┬─────┐                           │
 *  │  │  3  │  4  │  5  │  6  │  7  │  (additional states)      │
 *  │  └─────┴─────┴─────┴─────┴─────┘                           │
 *  ├────────────────────────────────────────────────────────────┤
 *  │ [36px] Breaking-news ticker                                 │
 *  └────────────────────────────────────────────────────────────┘
 */
export default function MultiStateBroadcastPage() {
  return (
    <Suspense fallback={null}>
      <MultiStateInner />
    </Suspense>
  );
}

function MultiStateInner() {
  const params = useSearchParams();
  const liveMode = params.get("live") === "1";
  const cameraParam = params.get("camera");
  const { connected, constituencies, slots } = useLiveData();
  const [otherStates, setOtherStates] = useState<OtherState[]>([]);

  // Camera count (0..6) — same model as /broadcast.
  // ?camera=N wins; else localStorage `tn-broadcast-camera`; else 1 (anchor).
  const [cameraCount, setCameraCount] = useState<number>(1);
  useEffect(() => {
    if (cameraParam != null) {
      const n = parseInt(cameraParam, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) {
        setCameraCount(n);
        return;
      }
    }
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("tn-broadcast-camera")
        : null;
    if (stored != null) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) setCameraCount(n);
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "tn-broadcast-camera" && e.newValue != null) {
        const n = parseInt(e.newValue, 10);
        if (!Number.isNaN(n) && n >= 0 && n <= 6) setCameraCount(n);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cameraParam]);
  const setCount = (n: number) => {
    setCameraCount(n);
    if (typeof window !== "undefined") {
      localStorage.setItem("tn-broadcast-camera", String(n));
    }
  };

  useEffect(() => {
    document.body.classList.add("broadcast");
    return () => document.body.classList.remove("broadcast");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/states")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setOtherStates(d.states ?? []);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const justDeclared = useMemo(
    () =>
      [...constituencies]
        .filter((c) => c.status === "won" && c.leadingCandidate)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8),
    [constituencies],
  );

  const leftState = otherStates[0];
  const rightState = otherStates[1];
  const bottomStates = otherStates.slice(2);

  return (
    <>
      <ChyronOverlay />
      <div
        className="fixed inset-0 grid grid-cols-1 bg-gradient-to-br from-[#04081a] via-[#08102a] to-[#04081a] text-white"
        style={{
          gridTemplateRows: liveMode
            ? "28px 56px 1fr 36px"
            : "32px 28px 56px 1fr 36px",
        }}
      >
        {/* Backstage nav row — only when not in OBS clean mode */}
        {!liveMode && (
          <div className="flex items-center justify-center gap-2 px-3 bg-black/55 border-b border-white/10">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/55 font-bold">
              National view
            </span>
            <span className="w-px h-5 bg-white/15" />
            <a
              href="/broadcast"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/50 text-amber-200 hover:bg-amber-500/35 hover:border-amber-400 transition-colors whitespace-nowrap"
              title="Back to the TN broadcast scenes"
            >
              ← Tamil Nadu
            </a>
            <a
              href="/broadcast/admin"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
              title="Backstage control room"
            >
              🎛 Backstage
            </a>
            <a
              href="/admin/states"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
              title="Edit non-TN state numbers"
            >
              ✎ Edit States
            </a>
            <a
              href={`/broadcast/multi-state?live=1&camera=${cameraCount}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/35 transition-colors whitespace-nowrap"
              title="Clean URL for OBS browser source"
            >
              🎬 OBS URL ↗
            </a>
            <span className="w-px h-5 bg-white/15" />
            <div className="flex items-center gap-1 bg-black/60 border border-white/15 rounded-md px-1.5 py-0.5">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mr-0.5">
                📷
              </span>
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={
                    "text-[11px] font-bold tabular px-1.5 py-0.5 rounded transition-colors " +
                    (cameraCount === n
                      ? "bg-[var(--accent-counting)] text-black"
                      : "text-white/60 hover:text-white hover:bg-white/10")
                  }
                  title={n === 0 ? "Camera off" : `${n} camera${n === 1 ? "" : "s"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        <BroadcastTopStrip liveMode={liveMode} connected={connected} />
        <div className="bg-gradient-to-b from-black/35 to-transparent border-b border-white/5">
          <AllianceTotalsStrip />
        </div>

        {/* Scene area — left state | camera | right state, with
            additional states piling along the bottom edge. The Naadhas
            and ProxyN brand panels fill any empty side slots so the
            broadcast always shows the channel + co-brand prominently. */}
        <div className="overflow-hidden relative min-h-0 p-2 flex flex-col gap-2">
          <div
            className="grid gap-2 flex-1 min-h-0"
            style={{
              gridTemplateColumns:
                "minmax(280px, 360px) 1fr minmax(280px, 360px)",
            }}
          >
            {/* LEFT: Naadhas brand always visible. State on top if
                configured, brand fills the remainder; otherwise the
                whole panel is the Naadhas brand block. */}
            {leftState ? (
              <StatePanel
                accent={pickAccent(0)}
                state={leftState}
                brandFooter="naadhas"
              />
            ) : (
              <BrandPanel kind="naadhas" />
            )}

            <CameraStage
              justDeclared={justDeclared}
              cameraCount={cameraCount}
              slots={slots}
            />

            {/* RIGHT: ProxyN co-brand always visible — same pattern. */}
            {rightState ? (
              <StatePanel
                accent={pickAccent(1)}
                state={rightState}
                brandFooter="proxyn"
              />
            ) : (
              <BrandPanel kind="proxyn" />
            )}
          </div>

          {bottomStates.length > 0 && (
            <div
              className="grid gap-2 shrink-0"
              style={{
                gridTemplateColumns: `repeat(${bottomStates.length}, minmax(0, 1fr))`,
              }}
            >
              {bottomStates.map((s, i) => (
                <StateBar key={s.id} accent={pickAccent(i + 2)} state={s} />
              ))}
            </div>
          )}

          {otherStates.length === 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40 bg-black/45 border border-white/10 rounded-md px-3 py-1.5 backdrop-blur-sm">
              + Add states at{" "}
              <span className="text-white/70 font-bold">/admin/states</span> —
              they replace the brand panels with live state cards
            </div>
          )}
        </div>

        {/* Bottom — breaking ticker */}
        <div className="overflow-hidden">
          <LiveTicker constituencies={constituencies} />
        </div>
      </div>
    </>
  );
}

// ── Camera stage in the centre ────────────────────────────────

function CameraStage({
  justDeclared,
  cameraCount,
  slots,
}: {
  justDeclared: Array<{
    constituencyId: number;
    constituencyName: string;
    leadingCandidate?: { name: string; partyId: string; margin: number };
  }>;
  cameraCount: number;
  slots: import("@/lib/broadcast-slots").BroadcastSlot[];
}) {
  // Auto-rotate the chyron through the latest declared seats every 4s
  const [chyronIdx, setChyronIdx] = useState(0);
  useEffect(() => {
    if (justDeclared.length <= 1) return;
    const t = setInterval(
      () => setChyronIdx((i) => (i + 1) % justDeclared.length),
      4000,
    );
    return () => clearInterval(t);
  }, [justDeclared.length]);
  const cur = justDeclared[chyronIdx];

  // Pick a tile grid to fit `cameraCount` cameras at ~4:3 each in the
  // available stage area (which is roughly 16:9 minus the chyron strip).
  const grid = pickCameraGrid(cameraCount);

  return (
    <div className="relative rounded-xl overflow-hidden flex flex-col border border-white/8 bg-black/20">
      {/* Transparent camera area — tiled into N rectangles */}
      <div className="relative flex-1 min-h-0">
        {cameraCount === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-center text-white/40">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] font-bold">
                Camera off
              </div>
              <div className="text-[10px] mt-1.5 max-w-[260px] mx-auto">
                Set camera count in the backstage nav to enable the OBS
                composite area.
              </div>
            </div>
          </div>
        ) : (
          <div
            className="absolute inset-2 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: cameraCount }).map((_, i) => (
              <div key={i} className="relative">
                <CameraTile slot={slots[i]} index={i} totalCount={cameraCount} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lower-third chyron — auto-rotates through TN's just-declared list */}
      <div className="relative z-10 bg-gradient-to-r from-black/85 to-black/55 border-t border-white/10">
        {cur && cur.leadingCandidate ? (
          <ChyronLine
            constituency={cur.constituencyName}
            partyId={cur.leadingCandidate.partyId}
            candidate={cur.leadingCandidate.name}
            margin={cur.leadingCandidate.margin}
          />
        ) : (
          <div className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/45">
            Tamil Nadu live · No declarations yet
          </div>
        )}
      </div>
    </div>
  );
}

/** Pick a (cols, rows) grid that targets ~4:3 tiles in a 16:9-ish stage. */
function pickCameraGrid(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 4, rows: 2 };
}

/** Naadhas / ProxyN brand panel filling an empty state slot. */
function BrandPanel({ kind }: { kind: "naadhas" | "proxyn" }) {
  const isNaadhas = kind === "naadhas";
  return (
    <div
      className="rounded-xl flex flex-col overflow-hidden h-full border-2"
      style={{
        borderColor: isNaadhas ? "#3a8c93" : "#6366f1",
        boxShadow: isNaadhas
          ? "0 8px 28px -12px #3a8c9380"
          : "0 8px 28px -12px #6366f180",
      }}
    >
      {isNaadhas ? <NaadhasBrandBlock /> : <ProxyNBrandBlock />}
    </div>
  );
}

function ChyronLine({
  constituency,
  partyId,
  candidate,
  margin,
}: {
  constituency: string;
  partyId: string;
  candidate: string;
  margin: number;
}) {
  const party = partyById(partyId);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0"
        style={{ background: party.color, color: party.textColor }}
      >
        ★ JUST DECLARED
      </span>
      <span className="font-black text-base sm:text-lg truncate">
        {constituency}
      </span>
      <span className="text-white/70 text-sm truncate hidden sm:inline">
        → {candidate}
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto shrink-0"
        style={{ background: `${party.color}30`, color: party.color }}
      >
        {party.name}
      </span>
      <span
        className="font-black tabular text-sm sm:text-base shrink-0"
        style={{ color: party.color }}
      >
        +{formatIndian(margin)}
      </span>
    </div>
  );
}

// ── State panel (left/right tall) ─────────────────────────────

function StatePanel({
  accent,
  state,
  brandFooter,
}: {
  accent: string;
  state: OtherState;
  brandFooter?: "naadhas" | "proxyn";
}) {
  const accentSoft = darken(accent);
  const reportingPct = state.totalSeats
    ? (state.reportingSeats / state.totalSeats) * 100
    : 0;
  return (
    <div
      className="rounded-xl flex flex-col overflow-hidden h-full"
      style={{
        background: `linear-gradient(180deg, ${accentSoft}cc 0%, rgba(4,8,26,0.92) 90%)`,
        border: `2px solid ${accent}`,
        boxShadow: `0 8px 28px -12px ${accent}80`,
      }}
    >
      <div className="px-3 py-2.5 shrink-0" style={{ background: `${accent}55` }}>
        <div className="font-black text-lg uppercase tracking-wider leading-tight">
          {state.name.toUpperCase()}
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <span className="text-[9px] uppercase tracking-[0.25em] text-white/65 font-bold">
            Leads / Wins
          </span>
          <span className="font-black tabular text-xl leading-tight">
            <TickingNumber value={state.reportingSeats} />
            <span className="text-white/55">/{state.totalSeats}</span>
          </span>
        </div>
        <div className="h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${reportingPct}%`, background: accent }}
          />
        </div>
      </div>
      <div className="flex flex-col shrink-0">
        {state.parties.length === 0 && (
          <div className="text-center text-white/40 text-xs py-4">
            No party rows
          </div>
        )}
        {state.parties.map((p, i) => (
          <PanelRow key={i} row={p} even={i % 2 === 0} />
        ))}
      </div>
      {/* Brand footer fills the remaining vertical space — Naadhas in
          left panel, ProxyN in right. Always shown so the broadcast
          always carries the channel + co-brand. */}
      {brandFooter && (
        <div className="flex-1 flex flex-col min-h-0 border-t border-white/10">
          {brandFooter === "naadhas" ? (
            <NaadhasBrandBlock />
          ) : (
            <ProxyNBrandBlock />
          )}
        </div>
      )}
    </div>
  );
}

function PanelRow({ row, even }: { row: OtherStatePartyRow; even: boolean }) {
  const up = (row.delta ?? 0) > 0;
  const down = (row.delta ?? 0) < 0;
  return (
    <div
      className="flex items-center px-3 py-3 gap-2 border-b border-white/5"
      style={{ background: even ? "transparent" : "rgba(255,255,255,0.04)" }}
    >
      <div
        className="w-1.5 h-10 rounded-sm shrink-0"
        style={{ background: row.color ?? "#94a3b8" }}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <span
          className="font-black text-sm uppercase tracking-wider truncate"
          style={{ color: row.color ?? "#94a3b8" }}
        >
          {row.label}
        </span>
        {row.delta != null && row.delta !== 0 && (
          <span
            className={
              "text-[10px] font-bold tabular leading-none mt-0.5 " +
              (up ? "text-emerald-400" : "text-red-400")
            }
          >
            {up ? "▲ +" : down ? "▼ " : ""}
            {row.delta} vs prior
          </span>
        )}
      </div>
      <TickingNumber
        value={row.total}
        className="text-3xl font-black tabular text-white shrink-0"
      />
    </div>
  );
}

// ── State bar (compact, bottom row) ───────────────────────────

function StateBar({ accent, state }: { accent: string; state: OtherState }) {
  const accentSoft = darken(accent);
  return (
    <div
      className="rounded-lg overflow-hidden flex h-full"
      style={{
        background: `linear-gradient(135deg, ${accentSoft}cc 0%, rgba(4,8,26,0.95) 100%)`,
        border: `2px solid ${accent}`,
      }}
    >
      <div
        className="px-3 py-2 flex flex-col justify-center min-w-[140px]"
        style={{ background: `${accent}55` }}
      >
        <div className="font-black text-base uppercase tracking-wider leading-tight">
          {state.name.toUpperCase()}
        </div>
        <div className="flex items-baseline gap-1 text-[10px] mt-0.5">
          <span className="text-white/60 uppercase tracking-wider text-[9px] font-bold">
            Leads / Wins
          </span>
          <span className="font-black tabular text-sm">
            <TickingNumber value={state.reportingSeats} />
            <span className="text-white/55">/{state.totalSeats}</span>
          </span>
        </div>
      </div>
      <div
        className="grid gap-1.5 flex-1 p-2"
        style={{
          gridTemplateColumns: `repeat(${Math.max(state.parties.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {state.parties.length === 0 && (
          <div className="text-center text-white/40 text-xs py-2">
            No party rows
          </div>
        )}
        {state.parties.map((r, i) => (
          <div
            key={i}
            className="rounded-md p-1.5 flex flex-col items-center justify-center text-center bg-black/35"
            style={{ borderTop: `2px solid ${r.color ?? "#94a3b8"}` }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-wider truncate w-full"
              style={{ color: r.color ?? "#94a3b8" }}
            >
              {r.label}
            </div>
            <TickingNumber
              value={r.total}
              className="text-2xl font-black tabular leading-none mt-0.5 text-white"
            />
            {r.delta != null && r.delta !== 0 && (
              <div
                className={
                  "text-[9px] font-bold tabular " +
                  ((r.delta ?? 0) > 0 ? "text-emerald-400" : "text-red-400")
                }
              >
                {(r.delta ?? 0) > 0 ? "▲ +" : "▼ "}
                {r.delta}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Brand panels (fill empty side slots) ──────────────────

function NaadhasBrandBlock() {
  const BRAND = useTenant();
  // Channel accent gradient — pulls from tenant config so Aadhan logins
  // get a red glow while Naadhas gets the teal one.
  const tint = BRAND.channelAccent;
  const tintDark = BRAND.channelAccentDark;
  return (
    <div
      className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-6 overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 35%, ${tint}88 0%, ${tintDark}88 45%, rgba(4,8,26,0.95) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 8px, transparent 8px 16px)",
        }}
      />
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND.logoSrc}
          alt={BRAND.channelName}
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-white/30 shadow-2xl mx-auto"
        />
        <div className="font-black text-xl sm:text-2xl uppercase tracking-wide mt-4 leading-tight">
          {BRAND.channelName}
        </div>
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.4em] text-white/75 mt-1">
          {BRAND.channelTagline}
        </div>
        <div
          className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] mt-4 px-3 py-1.5 rounded inline-block text-white/85"
          style={{
            background: `${tint}30`,
            border: `1px solid ${tint}55`,
          }}
        >
          ★ TN Election 2026 · Live
        </div>
      </div>
    </div>
  );
}

function ProxyNBrandBlock() {
  const BRAND = useTenant();
  return (
    <a
      href={BRAND.developerUrl}
      target="_blank"
      rel="noreferrer"
      className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-6 overflow-hidden transition-transform hover:scale-[1.01]"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, rgba(99,102,241,0.55) 0%, rgba(49,46,129,0.55) 45%, rgba(4,8,26,0.95) 100%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0 8px, transparent 8px 16px)",
        }}
      />
      <div className="relative">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] text-white/65 mb-3">
          Powered by
        </div>
        <div
          className="font-black text-3xl sm:text-4xl px-4 py-2 rounded-md shadow-2xl inline-block"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #312e81 100%)",
            color: "white",
            letterSpacing: "0.02em",
          }}
        >
          {BRAND.developerName}
        </div>
        <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-white/85 font-bold mt-4 leading-tight">
          {BRAND.developerTagline}
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/45 mt-3">
          {BRAND.developerUrl.replace("https://", "")} →
        </div>
      </div>
    </a>
  );
}

// ── Color helpers ──────────────────────────────────────────

const ACCENTS = ["#f97316", "#0d9488", "#a855f7", "#16a34a", "#fbbf24", "#dc2626"];
function pickAccent(idx: number) {
  return ACCENTS[idx % ACCENTS.length];
}

function darken(hex: string): string {
  const map: Record<string, string> = {
    "#f97316": "#7c2d12",
    "#0d9488": "#134e4a",
    "#a855f7": "#581c87",
    "#16a34a": "#14532d",
    "#fbbf24": "#78350f",
    "#dc2626": "#7f1d1d",
  };
  return map[hex] ?? "#1f2937";
}
