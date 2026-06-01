"use client";
import type { CameraLayout } from "@/lib/scenes";
import type { BroadcastSlot } from "@/lib/broadcast-slots";
import { CameraTile } from "./CameraTile";

/**
 * Wraps a broadcast scene with a camera-frame layout. The scene shrinks /
 * repositions per `layout`, and the remaining canvas is transparent so the
 * OBS operator can composite anchor video where the camera area is.
 *
 * `cameraCount` (1..6) tiles the camera-area box into that many rectangles
 * — picked automatically as a 1×N row, 2×2 grid, 2×3 grid etc. based on the
 * shape of the empty area. So a 3-camera or 4-camera show "just works"
 * without per-scene config.
 *
 * `slots` (optional) lets each tile render an in-page streaming source
 * (YouTube live, HLS, etc.) instead of staying transparent. A slot with an
 * empty url falls back to the bracket camera-area hint, so the OBS-overlay
 * workflow continues to work for any tile that isn't explicitly assigned.
 */
export function CameraFrameWrapper({
  layout,
  cameraCount = 1,
  slots,
  children,
}: {
  layout: CameraLayout;
  cameraCount?: number;
  slots?: BroadcastSlot[];
  children: React.ReactNode;
}) {
  if (layout === "off") return <>{children}</>;

  const sceneStyle: React.CSSProperties = sceneStyleFor(layout);
  const box = cameraBoxFor(layout);
  const tiles = tileBox(box, cameraCount, layout);

  return (
    <div className="relative w-full h-full">
      {tiles.map((r, i) => (
        <div key={i} className="absolute" style={r}>
          <CameraTile slot={slots?.[i]} index={i} totalCount={cameraCount} />
        </div>
      ))}
      <div style={sceneStyle} className="overflow-hidden">
        <div className="w-full h-full">{children}</div>
      </div>
    </div>
  );
}

// ── Where the SCENE goes ─────────────────────────────────

function sceneStyleFor(layout: CameraLayout): React.CSSProperties {
  switch (layout) {
    case "top-strip":
      return { position: "absolute", inset: "0 0 auto 0", height: "38%", minHeight: 200 };
    case "left-bar":
      return { position: "absolute", inset: "0 auto 0 0", width: "32%", maxWidth: 380, minWidth: 280 };
    case "right-bar":
      return { position: "absolute", inset: "0 0 0 auto", width: "32%", maxWidth: 380, minWidth: 280 };
    case "right-pane":
      // Scene takes the right 70% so map/comparison views get the real estate
      // they need; camera fills the left 30% (480px on a 1080p canvas — fine
      // for a portrait anchor headshot).
      return { position: "absolute", inset: "0 0 0 auto", width: "70%", minWidth: 800 };
    case "l-shape":
      return { position: "absolute", inset: 0 };
    case "pip-tr":
      return {
        position: "absolute",
        top: 8,
        right: 8,
        width: "30%",
        maxWidth: 360,
        minWidth: 240,
        height: "40%",
        maxHeight: 320,
      };
    case "camera-pip-br":
    case "camera-pip-tr":
      // Scene fills the canvas, camera is a small PIP on top.
      return { position: "absolute", inset: 0 };
    default:
      return {};
  }
}

// ── Bounding box of the camera area, normalized as percentages 0..100 ──

type Box = { left: number; top: number; right: number; bottom: number };

function cameraBoxFor(layout: CameraLayout): Box {
  switch (layout) {
    case "top-strip":
      return { left: 0, top: 38, right: 0, bottom: 0 };
    case "left-bar":
      return { left: 32, top: 0, right: 0, bottom: 0 };
    case "right-bar":
      return { left: 0, top: 0, right: 32, bottom: 0 };
    case "right-pane":
      // Camera fills the left 30% of the canvas; scene is the right 70%.
      return { left: 0, top: 0, right: 70, bottom: 0 };
    case "l-shape":
      return { left: 0, top: 30, right: 32, bottom: 0 };
    case "pip-tr":
      return { left: 0, top: 0, right: 0, bottom: 0 };
    case "camera-pip-br":
      // Bottom-right corner box, sized to a 4:3 cell at 16:9 canvas:
      // width ≈ 22% × 16 = 352u, height ≈ 33% × 9 = 297u → ratio ≈ 4:3.
      return { left: 76, top: 56, right: 1.5, bottom: 2 };
    case "camera-pip-tr":
      return { left: 76, top: 2, right: 1.5, bottom: 56 };
    default:
      return { left: 0, top: 0, right: 0, bottom: 0 };
  }
}

// ── Tile a bounding box into N camera rectangles ─────────

// Camera tiles target a 4:3 aspect ratio (standard broadcast camera framing).
// To switch, edit TARGET_TILE_ASPECT.
const TARGET_TILE_ASPECT = 4 / 3;

/** Pick (cols, rows) so we cover the box in tiles closest to 4:3. */
function pickGrid(box: Box, count: number): { cols: number; rows: number } {
  // The "box" coordinates are percentages of the wrapper rectangle, and
  // typical broadcast canvases are 16:9. Translate the % box back into a
  // pixel-equivalent ratio so the tile-aspect calculation reflects what
  // the operator actually sees.
  const CANVAS_RATIO = 16 / 9;
  const wPct = 100 - box.left - box.right;
  const hPct = 100 - box.top - box.bottom;
  const w = wPct * CANVAS_RATIO; // normalize x-axis to canvas aspect
  const h = hPct;
  let best: { cols: number; rows: number; score: number } | null = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = w / cols;
    const tileH = h / rows;
    const aspect = tileW / tileH;
    const score = Math.abs(Math.log(aspect / TARGET_TILE_ASPECT));
    if (!best || score < best.score) best = { cols, rows, score };
  }
  return { cols: best?.cols ?? 1, rows: best?.rows ?? 1 };
}

function tileBox(box: Box, count: number, layout: CameraLayout): React.CSSProperties[] {
  if (count <= 1) return [boxToCss(box)];

  // Reduce the gap between camera tiles for cleaner separation
  const gapPct = layout.startsWith("camera-pip") ? 0.6 : 1.2;
  const { cols, rows } = pickGrid(box, count);

  const w = 100 - box.left - box.right;
  const h = 100 - box.top - box.bottom;
  const tileW = (w - gapPct * (cols - 1)) / cols;
  const tileH = (h - gapPct * (rows - 1)) / rows;

  const tiles: React.CSSProperties[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const left = box.left + c * (tileW + gapPct);
    const top = box.top + r * (tileH + gapPct);
    tiles.push({
      left: `${left}%`,
      top: `${top}%`,
      width: `${tileW}%`,
      height: `${tileH}%`,
    });
  }
  return tiles;
}

function boxToCss(b: Box): React.CSSProperties {
  return {
    left: `${b.left}%`,
    top: `${b.top}%`,
    right: `${b.right}%`,
    bottom: `${b.bottom}%`,
  };
}

