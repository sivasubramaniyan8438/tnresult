"use client";
import { LiveClock } from "./LiveClock";
import { PulseDot } from "./PulseDot";
import { LanguageToggle } from "./LanguageToggle";
import { useLocale } from "./LocaleProvider";
import { useLiveData } from "./LiveDataProvider";
import { useTenant } from "./TenantProvider";
import { TOTAL_SEATS } from "@/lib/parties";

/**
 * The 28px-tall top chrome strip used by every broadcast surface
 * (/broadcast, /broadcast/multi-state). Carries:
 *   · Naadhas channel logo + name
 *   · ProxyN.ai co-brand chip
 *   · Reporting-progress bar with N/234 (P%)
 *   · LIVE pulse + clock + "live from chennai"
 *   · Language toggle (backstage only)
 *
 * Designed to be readable from across the room without dominating; the
 * persistent alliance totals strip below carries the headline numbers.
 */
export function BroadcastTopStrip({
  liveMode,
  connected,
}: {
  /** OBS clean output mode — hides the language toggle. */
  liveMode: boolean;
  /** SSE connection state — drives the LIVE / OFFLINE pill. */
  connected: boolean;
}) {
  const { state } = useLiveData();
  const { t } = useLocale();
  const BRAND = useTenant();
  const declared = state?.declared ?? 0;
  const counting = state?.counting ?? 0;
  const reportingPct = state ? ((declared + counting) / TOTAL_SEATS) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-3 bg-gradient-to-r from-[#0a0f24] via-[#0d1530] to-[#0a0f24] border-b border-white/10">
      <div className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND.logoSrc}
          alt={BRAND.channelName}
          className="w-5 h-5 rounded-full ring-1 ring-white/20"
        />
        <span className="font-black text-[12px] whitespace-nowrap leading-none">
          {BRAND.channelName}
        </span>
        <span className="text-white/25 leading-none">·</span>
        <a
          href={BRAND.developerUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.95) 0%, rgba(49,46,129,0.95) 100%)",
            color: "white",
          }}
          title={BRAND.developerTagline}
        >
          {BRAND.developerName}
        </a>
        <span className="text-[9px] uppercase tracking-[0.25em] text-white/45 hidden md:inline whitespace-nowrap">
          {BRAND.developerTagline}
        </span>
      </div>

      {/* Reporting progress bar — middle */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold whitespace-nowrap hidden sm:inline">
          {t("label.reporting")}
        </span>
        <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden max-w-[280px]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-400 via-amber-300 to-amber-200"
            style={{ width: `${reportingPct}%` }}
          />
        </div>
        <span className="text-[11px] font-black tabular text-amber-300 whitespace-nowrap">
          {declared + counting}
          <span className="text-white/40">/{TOTAL_SEATS}</span>
          <span className="text-[9px] text-white/55 ml-1">
            ({reportingPct.toFixed(0)}%)
          </span>
        </span>
      </div>

      {/* LIVE + clock — right */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#dc2626] to-[#b91c1c] px-2 py-0.5 rounded-full font-black text-white shadow">
          <PulseDot color="#ffffff" size={6} />
          <span className="text-[11px] tracking-widest leading-none">
            {connected ? t("header.live") : t("header.offline")}
          </span>
        </div>
        <div className="font-mono font-black text-[12px] tabular leading-none whitespace-nowrap">
          <LiveClock />
        </div>
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/45 hidden lg:inline whitespace-nowrap">
          {t("label.liveFromChennai")}
        </span>
        {!liveMode && <LanguageToggle compact />}
      </div>
    </div>
  );
}
