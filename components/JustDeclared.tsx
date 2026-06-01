"use client";
import { useMemo, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById } from "@/lib/parties";
import type { ConstituencySummary } from "@/lib/schema";
import { cn } from "@/lib/cn";

/**
 * Just-declared sticky feed — last N seats called, newest first, with an
 * IST timestamp on each row and a one-tap copy button. Journalists can grab
 * the formatted line and paste it into a chyron, tweet, or Slack thread.
 *
 * NDTV/News18 don't surface this on the home page — it's a real
 * differentiator for ratings (anchors keep referring to "the latest declared
 * seat" without having to scroll).
 */
function formatIST(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts + 5.5 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function JustDeclared({ limit = 10 }: { limit?: number }) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();
  const [copied, setCopied] = useState<number | null>(null);

  const declared = useMemo(() => {
    return constituencies
      .filter((c) => c.status === "won" && c.leadingCandidate)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }, [constituencies, limit]);

  const copyRow = async (c: ConstituencySummary) => {
    const party = partyById(c.leadingCandidate!.partyId);
    const line = `★ ${c.constituencyName} (AC#${c.constituencyId}) declared for ${c.leadingCandidate!.name} (${party.name}) — margin ${c.leadingCandidate!.margin.toLocaleString("en-IN")}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(c.constituencyId);
      setTimeout(() => setCopied((cur) => (cur === c.constituencyId ? null : cur)), 1400);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <div className="card p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-won)] animate-pulse" />
          {t("justDeclared.title")}
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] tabular">
          {declared.length}
        </span>
      </div>

      {declared.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--text-muted)]">
          {t("justDeclared.empty")}
        </div>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
          {declared.map((c) => {
            const lc = c.leadingCandidate!;
            const party = partyById(lc.partyId);
            return (
              <li
                key={c.constituencyId}
                className="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
              >
                <span
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: party.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[13px] truncate">{c.constituencyName}</span>
                    <span className="text-[9px] tabular text-[var(--text-muted)]">
                      AC#{c.constituencyId}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span style={{ color: party.color }} className="font-bold">
                      {party.name}
                    </span>
                    <span className="text-[var(--text-muted)] truncate">{lc.name}</span>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] tabular text-[var(--text-muted)] hidden sm:inline">
                  {formatIST(c.updatedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => copyRow(c)}
                  className={cn(
                    "shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors border",
                    copied === c.constituencyId
                      ? "border-[var(--accent-won)] text-[var(--accent-won)] bg-[var(--accent-won)]/10"
                      : "border-white/10 text-[var(--text-muted)] hover:border-white/30 hover:text-[var(--text-primary)]",
                  )}
                  title={t("justDeclared.copyTitle")}
                >
                  {copied === c.constituencyId ? "✓" : "⎘"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
