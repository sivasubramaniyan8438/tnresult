"use client";
import Link from "next/link";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById, blocOf } from "@/lib/parties";
import { get2021ForAc } from "@/lib/historical-by-ac";
import { formatIndian } from "@/lib/cn";

// Hexgrid layout: roughly geographic — north at top, south at bottom.
// Each AC gets a hex; we lay them out in rows of 14 for a clean rectangle.
// Index = ac.id - 1, row = floor(idx / cols), col = idx % cols.
// Slight horizontal offset every other row for hex packing.
const COLS = 18;
const HEX_R = 19; // radius
const HEX_H = HEX_R * Math.sqrt(3); // row spacing
const HEX_W = HEX_R * 2; // col spacing

function hexPath(cx: number, cy: number, r: number) {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

export function SwingMap({
  variant = "card",
}: {
  variant?: "card" | "scene";
}) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();

  const OTHERS_COLOR = "#94a3b8"; // distinct grey for non-bloc winners (IND/AMMK/etc.)

  const items = constituencies.map((c) => {
    const hist = get2021ForAc(c.constituencyId, c.district);
    const lead = c.leadingCandidate;
    // Color by ACTUAL party (not bloc anchor) — otherwise BJP wins look like
    // AIADMK wins (both green) and INC wins look like DMK wins (both red).
    // Flip detection still operates at the BLOC level: DMK→INC = no flip,
    // DMK→BJP = flip.
    const currentBloc = lead ? blocOf(lead.partyId) : null;
    const oldBloc = blocOf(hist.winner);
    const flipped = !!lead && currentBloc !== oldBloc;
    const fillColor = !lead
      ? "rgba(80,90,120,0.35)"
      : currentBloc
        ? partyById(lead.partyId).color
        : OTHERS_COLOR;
    return {
      c,
      hist,
      lead,
      flipped,
      color: fillColor,
      isOthers: !!lead && !currentBloc,
    };
  });

  // Distinct ACTUAL parties currently leading anywhere — feeds the legend
  // so a BJP win shows an orange chip (not folded into AIADMK green).
  const hasOthers = items.some((it) => it.isOthers);
  const leadingActualParties = Array.from(
    new Set(
      items
        .filter((it) => it.lead && !it.isOthers)
        .map((it) => it.lead!.partyId),
    ),
  );
  const leadingParties = hasOthers ? [...leadingActualParties, "OTHERS"] : leadingActualParties;

  const totalCells = items.length;
  const rows = Math.ceil(totalCells / COLS);
  const w = COLS * HEX_W * 0.78 + HEX_W;
  const h = rows * HEX_H + HEX_H;

  if (variant === "scene") {
    return (
      <div className="card p-3 sm:p-5 h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-2 shrink-0 gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-2xl font-black uppercase tracking-wide truncate">
              {t("section.swingMap")}
            </h2>
            <p className="text-[10px] sm:text-xs text-[var(--text-muted)] truncate">
              {t("swingMap.subtitle")}
            </p>
          </div>
          <Legend parties={leadingParties} compact />
        </div>
        {/* SVG scales to whatever space is left — no min-width clipping */}
        <div className="flex-1 min-h-0 flex justify-center items-center">
          <Grid items={items} w={w} h={h} />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("section.swingMapVs2021")}
        </h3>
        <Legend compact parties={leadingParties} />
      </div>
      <div>
        <Grid items={items} w={w} h={h} />
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mt-2">
        Each hex = one AC. Filled by current leader; outlined = flipped vs 2021.
      </p>
    </div>
  );
}

function Grid({
  items,
  w,
  h,
}: {
  items: Array<{
    c: { constituencyId: number; constituencyName: string; district: string };
    hist: { winner: string };
    lead: { partyId: string; margin: number; name: string } | undefined;
    flipped: boolean;
    color: string;
  }>;
  w: number;
  h: number;
}) {
  return (
    // SVG fills the parent container; viewBox does aspect-fit. No min-width
    // so the map doesn't overflow narrow camera-frame layouts.
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className="block max-w-full max-h-full w-full h-full"
    >
      {items.map((it, idx) => {
        const row = Math.floor(idx / COLS);
        const col = idx % COLS;
        const offsetX = row % 2 === 0 ? 0 : HEX_W * 0.39;
        const cx = HEX_W * 0.78 * col + offsetX + HEX_R + 8;
        const cy = HEX_H * row + HEX_R + 8;
        return (
          <Link key={it.c.constituencyId} href={`/broadcast/ac/${it.c.constituencyId}`}>
            <g>
              <path
                d={hexPath(cx, cy, HEX_R)}
                fill={it.color}
                fillOpacity={it.lead ? 0.9 : 0.18}
                stroke={it.flipped ? "#ffffff" : "rgba(0,0,0,0.4)"}
                strokeWidth={it.flipped ? 3 : 0.6}
              >
                <title>{`AC#${it.c.constituencyId} ${it.c.constituencyName} (${it.c.district})\n2021: ${it.hist.winner}${it.lead ? `\nNow: ${it.lead.partyId} +${formatIndian(it.lead.margin)}` : "\nAwaiting"}${it.flipped ? "\n↻ FLIPPED" : ""}`}</title>
              </path>
              <text
                x={cx}
                y={cy + 3}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(0,0,0,0.7)"
                fontFamily="ui-monospace, monospace"
                style={{ pointerEvents: "none" }}
              >
                {it.c.constituencyId}
              </text>
            </g>
          </Link>
        );
      })}
    </svg>
  );
}

function Legend({
  compact,
  parties: extraParties,
}: {
  compact?: boolean;
  parties?: string[];
}) {
  // Always show the 4 majors, plus any others currently leading anywhere
  const baseParties = ["DMK", "AIADMK", "TVK", "NTK"];
  const allParties = Array.from(new Set([...baseParties, ...(extraParties ?? [])]));
  const OTHERS_COLOR = "#94a3b8";
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {allParties.map((p) => {
        if (p === "OTHERS") {
          return (
            <div key={p} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ background: OTHERS_COLOR, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
              />
              <span style={{ color: OTHERS_COLOR }} className="font-bold">Others</span>
            </div>
          );
        }
        const party = partyById(p);
        return (
          <div key={p} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: party.color, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
            />
            <span style={{ color: party.color }} className="font-bold">{party.name}</span>
          </div>
        );
      })}
      {!compact && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className="w-3 h-3 rounded-sm border-2 border-white"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
          <span className="text-white font-bold">Flipped vs 2021</span>
        </div>
      )}
    </div>
  );
}
