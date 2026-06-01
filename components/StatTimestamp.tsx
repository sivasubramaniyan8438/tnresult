"use client";
import { useEffect, useState } from "react";

/**
 * Tiny "as of HH:MM IST" stamp for individual stat panels — credibility tag
 * a journalist can quote when copying a number off-screen.
 *
 * Uses a deterministic IST formatter (Asia/Kolkata, hh:mm 24h) instead of
 * Number.toLocaleString — same hydration-mismatch risk we already hit on
 * SwingMap. The stamp only renders client-side (after mount) so SSR'd
 * markup matches client (both show empty during SSR).
 */
function formatIST(ts: number): string {
  if (!ts) return "";
  // Asia/Kolkata is UTC+5:30 always (no DST). Compute manually for SSR safety.
  const d = new Date(ts + 5.5 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} IST`;
}

export function StatTimestamp({
  ts,
  label = "as of",
  className = "",
}: {
  ts: number | null | undefined;
  label?: string;
  className?: string;
}) {
  // SSR-safe: render nothing until client mount so server HTML matches client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !ts) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--text-muted)] tabular " +
        className
      }
      title={`Server timestamp ${ts}`}
    >
      <span className="opacity-60">{label}</span>
      <span className="font-bold">{formatIST(ts)}</span>
    </span>
  );
}
