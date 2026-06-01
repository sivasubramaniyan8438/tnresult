import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Deterministic Indian-style number formatter. We avoid Number.toLocaleString
// because Node.js without full-ICU produces different output than the browser,
// which causes hydration mismatches (and a "1 Issue" Turbopack indicator).
// Indian style: 12,34,567 — last 3 digits, then groups of 2.
export function formatIndian(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 0) return "-" + formatIndian(-n);
  const s = String(Math.floor(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return rest + "," + last3;
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && n >= 100000) {
    if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
    if (n >= 100000) return (n / 100000).toFixed(2) + " L";
  }
  return formatIndian(n);
}

export function formatTimeAgo(ts: number): string {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
