"use client";
import { useMemo } from "react";
import { formatIndian } from "@/lib/cn";
import { partyById } from "@/lib/parties";
import type { ConstituencySummary } from "@/lib/schema";
import { useLocale } from "./LocaleProvider";

export function LiveTicker({ constituencies }: { constituencies: ConstituencySummary[] }) {
  const { t, locale } = useLocale();
  const items = useMemo(() => {
    // Build a feed of recent significant events
    const declared = constituencies
      .filter((c) => c.status === "won" && c.leadingCandidate)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12);
    const close = constituencies
      .filter(
        (c) =>
          c.status === "leading" &&
          c.leadingCandidate &&
          c.leadingCandidate.margin > 0 &&
          c.leadingCandidate.margin < 2000,
      )
      .sort((a, b) => a.leadingCandidate!.margin - b.leadingCandidate!.margin)
      .slice(0, 8);

    const events: Array<{ type: "won" | "close"; text: string; color: string }> = [];
    for (const c of declared) {
      const lead = c.leadingCandidate!;
      const party = partyById(lead.partyId);
      events.push({
        type: "won",
        text: `★ DECLARED · ${c.constituencyName} (${c.constituencyId}) → ${lead.name} (${party.name})`,
        color: party.color,
      });
    }
    for (const c of close) {
      const lead = c.leadingCandidate!;
      const party = partyById(lead.partyId);
      events.push({
        type: "close",
        text: `⚡ CLOSE FIGHT · ${c.constituencyName}: ${party.name} +${formatIndian(lead.margin)}`,
        color: party.color,
      });
    }

    if (events.length === 0) {
      return [
        {
          type: "close" as const,
          text:
            locale === "ta"
              ? "எண்ணிக்கை மையங்களில் இருந்து முதல் முடிவுகளுக்காக காத்திருக்கிறது…"
              : "Awaiting first results from counting centres…",
          color: "#94a3b8",
        },
        {
          type: "close" as const,
          text:
            locale === "ta"
              ? "எண்ணிக்கை மே 4 அன்று துவங்கும் · சுற்று 1 இலிருந்து போக்குகள்"
              : "Counting begins May 4 · Trends from Round 1 onwards",
          color: "#94a3b8",
        },
      ];
    }
    return events;
  }, [constituencies, locale]);

  // Duplicate items for seamless loop
  const loop = [...items, ...items];

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#1a0d0d] via-[#170808] to-[#1a0d0d] border-y-2 border-[var(--accent-live)]/40">
      <div className="absolute left-0 top-0 bottom-0 z-10 bg-gradient-to-r from-[var(--accent-live)] to-[#991b1b] text-white px-3 py-1.5 font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>{t("ticker.breaking")}</span>
      </div>
      <div
        className="flex whitespace-nowrap py-2 pl-32"
        style={{ animation: "ticker 60s linear infinite" }}
      >
        {loop.map((e, i) => (
          <span key={i} className="inline-flex items-center px-6 text-sm font-medium">
            <span style={{ color: e.color }}>{e.text}</span>
            <span className="mx-4 text-[var(--text-muted)]">·</span>
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
