"use client";
import { useMemo } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { TickingNumber } from "./TickingNumber";

/**
 * Counting velocity panel — visualises pace of declarations + status moves.
 * NDTV doesn't show this; for journalists "how fast is counting going" is
 * a constantly-asked question.
 *
 * Uses a 5-minute rolling histogram over the last hour, derived from
 * `constituencies[i].updatedAt`. We don't need server-side history for
 * this — the live snapshot already carries the latest update timestamps.
 */
const BUCKET_MS = 5 * 60 * 1000; // 5 minutes
const BUCKETS = 12; // 12 × 5min = 1 hour

export function CountingVelocity() {
  const { state, constituencies } = useLiveData();
  const { t } = useLocale();

  const { buckets, totalRecent, declaredRecent, leadingNow, peak } = useMemo(() => {
    const now = state?.lastUpdate ?? Date.now();
    const startOfWindow = now - BUCKETS * BUCKET_MS;
    const buckets = new Array<{ all: number; declared: number }>(BUCKETS).fill({ all: 0, declared: 0 }).map(() => ({ all: 0, declared: 0 }));

    let totalRecent = 0;
    let declaredRecent = 0;
    for (const c of constituencies) {
      if (!c.updatedAt || c.updatedAt < startOfWindow) continue;
      const idx = Math.min(BUCKETS - 1, Math.floor((c.updatedAt - startOfWindow) / BUCKET_MS));
      buckets[idx].all++;
      totalRecent++;
      if (c.status === "won") {
        buckets[idx].declared++;
        declaredRecent++;
      }
    }
    const leadingNow = constituencies.filter((c) => c.status === "leading" || c.status === "counting").length;
    const peak = Math.max(1, ...buckets.map((b) => b.all));
    return { buckets, totalRecent, declaredRecent, leadingNow, peak };
  }, [constituencies, state]);

  return (
    <div className="card p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-lead)] animate-pulse" />
          {t("velocity.title")}
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] tabular">
          {t("velocity.last60")}
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-3">
        <div>
          <TickingNumber
            value={totalRecent}
            className="text-2xl sm:text-3xl font-black tabular leading-none text-[var(--accent-lead)] block"
          />
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
            {t("velocity.updates")}
          </div>
        </div>
        <div>
          <TickingNumber
            value={declaredRecent}
            className="text-xl sm:text-2xl font-black tabular leading-none text-[var(--accent-won)] block"
          />
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
            {t("velocity.declared")}
          </div>
        </div>
        <div className="ml-auto text-right">
          <TickingNumber
            value={leadingNow}
            className="text-xl sm:text-2xl font-black tabular leading-none block"
          />
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
            {t("velocity.activeNow")}
          </div>
        </div>
      </div>

      {/* Sparkline — taller bar = more updates that 5-min window */}
      <div className="relative">
        <div className="flex items-end gap-[2px] h-16 px-1">
          {buckets.map((b, i) => {
            const allPct = (b.all / peak) * 100;
            const declaredPct = (b.declared / peak) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col-reverse gap-[1px]">
                <div
                  className="w-full bg-[var(--accent-won)] rounded-sm"
                  style={{ height: `${declaredPct}%` }}
                  title={`${b.declared} declared`}
                />
                <div
                  className="w-full bg-[var(--accent-lead)]/50 rounded-sm"
                  style={{ height: `${Math.max(0, allPct - declaredPct)}%` }}
                  title={`${b.all} updates`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] tabular text-[var(--text-muted)] mt-1">
          <span>−60{t("velocity.minShort")}</span>
          <span>−30{t("velocity.minShort")}</span>
          <span>{t("velocity.now")}</span>
        </div>
      </div>
    </div>
  );
}
