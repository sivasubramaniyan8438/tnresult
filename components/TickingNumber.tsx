"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Broadcast-grade animated counter. When the prop `value` changes:
 *   1. Counts from the old value to the new value (tweened ~600ms ease-out).
 *   2. Briefly flashes scale 1.15 + the change-color so the change reads on
 *      camera even at 30fps capture.
 *
 * Designed for the hero card big number, the persistent strip, and the
 * path-to-majority bar — anywhere the number changing is a story beat.
 *
 * Falls back to instant render on first mount (no count-up from 0).
 */
export function TickingNumber({
  value,
  className,
  style,
  durationMs = 700,
  format,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState<number>(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    prevRef.current = value;

    // Tween display from prev → value
    const start = performance.now();
    const direction: "up" | "down" = value > prev ? "up" : "down";
    setFlash(direction);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), durationMs + 100);

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = prev + (value - prev) * eased;
      setDisplay(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const rendered = format
    ? format(Math.round(display))
    : String(Math.round(display));

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        transform: flash ? "scale(1.18)" : "scale(1)",
        transition: `transform ${Math.min(220, durationMs / 3)}ms ease-out, filter 220ms ease-out`,
        filter: flash === "up"
          ? "drop-shadow(0 0 14px rgba(34,197,94,0.55))"
          : flash === "down"
            ? "drop-shadow(0 0 14px rgba(239,68,68,0.55))"
            : undefined,
        ...style,
      }}
    >
      {rendered}
    </span>
  );
}
