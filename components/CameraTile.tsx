"use client";
import type { BroadcastSlot } from "@/lib/broadcast-slots";
import { SlotPlayer } from "./SlotPlayer";

/**
 * Single camera tile — used by every page that renders camera holes
 * (broadcast/page.tsx via CameraFrameWrapper, broadcast/multi-state/page.tsx
 * via CameraStage). Centralised so SlotPlayer wiring + bracket fallback
 * never drift between the two layouts.
 *
 * Behaviour:
 *  - slot has a non-empty sourceUrl → SlotPlayer fills the tile (in-page
 *    YouTube/HLS/iframe stream).
 *  - slot empty / undefined → bracket camera-area hint, transparent so
 *    OBS can composite anchor video over the rectangle.
 */
export function CameraTile({
  slot,
  index,
  totalCount,
}: {
  slot: BroadcastSlot | undefined;
  index: number;
  totalCount: number;
}) {
  const hasSource = slot && slot.sourceUrl.trim().length > 0;
  const fallback = <CameraHintBox label={totalCount > 1 ? `Camera ${index + 1}` : undefined} />;

  if (!hasSource || !slot) {
    return (
      <div className="absolute inset-0 pointer-events-none">{fallback}</div>
    );
  }
  return (
    <div className="absolute inset-0">
      <SlotPlayer slot={slot} index={index} fallback={fallback} />
    </div>
  );
}

export function CameraHintBox({ label }: { label?: string }) {
  return (
    <div className="relative w-full h-full">
      <Bracket position="tl" />
      <Bracket position="tr" />
      <Bracket position="bl" />
      <Bracket position="br" />
      <div className="absolute inset-0 flex items-center justify-center text-center text-white/35 px-2">
        <div>
          {label && (
            <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.4em] font-bold text-white/60 mb-1">
              {label}
            </div>
          )}
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.4em]">
            Camera area
          </div>
          <div className="text-[9px] sm:text-[10px] mt-1 max-w-[220px] mx-auto hidden sm:block">
            Drop OBS video over this rectangle
          </div>
        </div>
      </div>
    </div>
  );
}

function Bracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const styles: Record<typeof position, React.CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: "2px solid #ffffff80", borderLeft: "2px solid #ffffff80" },
    tr: { top: 0, right: 0, borderTop: "2px solid #ffffff80", borderRight: "2px solid #ffffff80" },
    bl: { bottom: 0, left: 0, borderBottom: "2px solid #ffffff80", borderLeft: "2px solid #ffffff80" },
    br: { bottom: 0, right: 0, borderBottom: "2px solid #ffffff80", borderRight: "2px solid #ffffff80" },
  };
  return <div className="absolute w-8 h-8 sm:w-10 sm:h-10" style={styles[position]} />;
}
