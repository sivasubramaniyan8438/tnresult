"use client";
import type { StateSummary } from "@/lib/schema";
import { formatNumber } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";

export function HeadlineStats({ state }: { state: StateSummary }) {
  const { t } = useLocale();
  const items = [
    { key: "label.constituencies", value: state.totalConstituencies, color: "var(--text-primary)" },
    { key: "label.declared", value: state.declared, color: "var(--accent-won)" },
    { key: "label.counting", value: state.counting, color: "var(--accent-lead)" },
    { key: "label.awaited", value: state.pending, color: "var(--text-muted)" },
    { key: "headline.roundsCounted", value: state.totalRoundsCompleted, color: "var(--accent-counting)" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <div key={it.key} className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t(it.key)}
          </div>
          <div
            className="text-3xl sm:text-4xl font-black tabular mt-1 leading-none"
            style={{ color: it.color }}
          >
            {formatNumber(it.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
