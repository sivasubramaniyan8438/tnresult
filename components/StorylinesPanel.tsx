"use client";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { cn, formatTimeAgo } from "@/lib/cn";
import { useState } from "react";

const TPL_COLOR: Record<string, string> = {
  BREAKING: "var(--accent-live)",
  CALL: "var(--accent-won)",
  MILESTONE: "var(--accent-counting)",
  QUOTE: "var(--accent-lead)",
};

type Story = ReturnType<typeof useLiveData>["storylines"][number];

function localize(s: Story, t: (k: string, args?: Record<string, string | number>) => string) {
  const headline = s.headlineKey ? t(s.headlineKey, s.args) : s.headline;
  const subhead = s.subheadKey ? t(s.subheadKey, s.args) : s.subhead;
  return { headline, subhead };
}

export function StorylinesPanel({ variant = "card" }: { variant?: "card" | "scene" }) {
  const { storylines } = useLiveData();
  const { t } = useLocale();
  const [busy, setBusy] = useState<string | null>(null);

  async function fireChyron(s: Story) {
    setBusy(s.id);
    try {
      const { headline, subhead } = localize(s, t);
      await fetch("/api/chyron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: s.template,
          headline,
          subhead,
          durationMs: 8000,
        }),
      });
    } finally {
      setBusy(null);
    }
  }

  if (storylines.length === 0) {
    return (
      <div className={variant === "card" ? "card p-5" : "card p-6 h-full"}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("storylines.titleShort")}
        </h3>
        <div className="text-xs text-[var(--text-muted)] mt-2 text-center py-6">
          {t("storylines.empty")}
        </div>
      </div>
    );
  }

  return (
    <div className={variant === "card" ? "card p-5" : "card p-6 h-full overflow-auto"}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("storylines.title")}
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {storylines.length} {t("storylines.events")}
        </span>
      </div>
      <ul className="space-y-2">
        {storylines.slice(0, variant === "card" ? 8 : 30).map((s) => {
          const color = TPL_COLOR[s.template] ?? "var(--text-muted)";
          const { headline, subhead } = localize(s, t);
          return (
            <li
              key={s.id}
              className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg p-3 flex items-start gap-3"
            >
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0"
                style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}
              >
                {t(`chyron.${s.template.toLowerCase()}`)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm uppercase tracking-wide leading-tight">
                  {headline}
                </div>
                {subhead && (
                  <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {subhead}
                  </div>
                )}
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  {formatTimeAgo(s.emittedAt)}
                </div>
              </div>
              <button
                onClick={() => fireChyron(s)}
                disabled={busy === s.id}
                className={cn(
                  "shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors",
                  "bg-yellow-500/15 hover:bg-yellow-500/30 border-yellow-500/40 text-yellow-300 disabled:opacity-50",
                )}
                title="Fire as on-screen chyron"
              >
                {busy === s.id ? "…" : t("storylines.take")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
