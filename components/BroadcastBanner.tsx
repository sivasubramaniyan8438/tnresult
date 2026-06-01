"use client";
import { LiveClock } from "./LiveClock";
import { PulseDot } from "./PulseDot";
import type { StateSummary } from "@/lib/schema";
import { TOTAL_SEATS, MAJORITY_MARK } from "@/lib/parties";
import { useLocale } from "./LocaleProvider";
import { TickingNumber } from "./TickingNumber";
import { useTenant } from "./TenantProvider";

export function BroadcastBanner({
  state,
}: {
  state: StateSummary | null;
}) {
  const { t } = useLocale();
  const BRAND = useTenant();
  const trends = state ? state.declared + state.counting : 0;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Top blue band */}
      <div className="relative bg-gradient-to-r from-[#0c1e4a] via-[#10286b] to-[#0c1e4a] flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
        {/* Channel logo block */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md font-black text-white shadow-lg shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND.channelAccent} 0%, ${BRAND.channelAccentDark} 100%)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logoSrc}
            alt={BRAND.channelName}
            className="w-9 h-9 rounded-full bg-white/10 object-cover"
          />
          <div className="leading-tight">
            <div className="text-sm sm:text-base whitespace-nowrap font-black">{BRAND.channelName}</div>
            <div className="text-[9px] uppercase tracking-widest text-white/85 whitespace-nowrap">
              {BRAND.channelTagline}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-400 uppercase flex items-center gap-2 flex-wrap">
            {t("label.election2026")}
            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[9px] tracking-wider">
              {t("label.megaCoverage")}
            </span>
          </div>
          <div className="font-black text-base sm:text-2xl uppercase tracking-wide truncate">
            {t("label.tnPollResults")} · 2026
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="font-mono font-black text-base sm:text-xl tabular">
              <LiveClock />
            </div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              {t("label.liveFromChennai")}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gradient-to-r from-[#dc2626] to-[#b91c1c] px-3 py-2 rounded-full font-black text-white shadow-lg">
            <PulseDot color="#ffffff" size={8} />
            <span className="text-xs sm:text-sm tracking-wider">{t("header.live")}</span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-gradient-to-r from-[#0a0f24] via-[#0d1530] to-[#0a0f24] border-t border-white/5 px-3 sm:px-4 py-2.5 grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-6 bg-[var(--accent-lead)] rounded shrink-0" />
          <div className="truncate">
            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              {t("label.constituencies")}
            </span>
            <div className="font-black tabular text-base sm:text-lg leading-none mt-0.5 text-[var(--accent-lead)]">
              {TOTAL_SEATS}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-6 bg-[var(--accent-counting)] rounded shrink-0" />
          <div className="truncate">
            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              {t("label.trends")}
            </span>
            <div className="font-black tabular text-base sm:text-lg leading-none mt-0.5">
              <TickingNumber
                value={trends}
                className="text-[var(--accent-counting)]"
              />
              <span className="text-[var(--text-muted)]">/{TOTAL_SEATS}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-6 bg-[var(--accent-won)] rounded shrink-0" />
          <div className="truncate">
            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              {t("label.majorityMark")}
            </span>
            <div className="font-black tabular text-base sm:text-lg leading-none mt-0.5 text-[var(--accent-won)]">
              {MAJORITY_MARK}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
