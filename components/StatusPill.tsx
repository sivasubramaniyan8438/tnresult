"use client";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";

const MAP: Record<string, { bg: string; color: string; ring?: string }> = {
  pending: { bg: "rgba(100,116,139,0.15)", color: "var(--text-muted)" },
  counting: { bg: "rgba(245,158,11,0.18)", color: "var(--accent-counting)", ring: "1px solid rgba(245,158,11,0.4)" },
  leading: { bg: "rgba(56,189,248,0.18)", color: "var(--accent-lead)", ring: "1px solid rgba(56,189,248,0.4)" },
  won: { bg: "rgba(16,185,129,0.2)", color: "var(--accent-won)", ring: "1px solid rgba(16,185,129,0.4)" },
};

export function StatusPill({ status }: { status: string }) {
  const { tStatus } = useLocale();
  const cfg = MAP[status] ?? MAP.pending;
  return (
    <span
      className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md")}
      style={{ background: cfg.bg, color: cfg.color, border: cfg.ring }}
    >
      {tStatus(status)}
    </span>
  );
}
