"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { partyById } from "@/lib/parties";
import { cn, formatNumber } from "@/lib/cn";
import { get2021ForAc } from "@/lib/historical-by-ac";

type Vip = {
  name: string;
  role: string;
  constituencyId: number;
  expectedParty: string;
  initials: string;
  source?: "static" | "runtime";
  id?: string;
};

export function VipTracker({
  variant = "card",
}: {
  variant?: "card" | "scene";
}) {
  const { constituencies } = useLiveData();
  const { t } = useLocale();
  // Static defaults bundled into the page (server-fetched on first request)
  // are merged with runtime overrides from the DB. Refetched every 30s so
  // newly-added VIPs appear without a hard refresh.
  const [list, setList] = useState<Vip[]>([]);
  useEffect(() => {
    const fetchVips = () =>
      fetch("/api/vips")
        .then((r) => r.json())
        .then((d) => setList(d.vips ?? []))
        .catch(() => {});
    fetchVips();
    const t = setInterval(fetchVips, 30_000);
    return () => clearInterval(t);
  }, []);

  const rows = list.map((v) => {
    const c = constituencies.find((x) => x.constituencyId === v.constituencyId);
    return { vip: v, c };
  });

  if (variant === "scene") {
    return <VipMarquee rows={rows} t={t} />;
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("section.vips")}
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {list.length} {t("scene.vips")}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map(({ vip, c }) => (
          <VipRow key={vip.constituencyId} vip={vip} c={c} />
        ))}
      </div>
    </div>
  );
}

function VipRow({ vip, c }: { vip: Vip; c: ReturnType<typeof Object> }) {
  const expectedParty = partyById(vip.expectedParty);
  const lead = c?.leadingCandidate;
  const leadParty = lead ? partyById(lead.partyId) : null;
  const leadingExpected = lead?.partyId === vip.expectedParty;

  return (
    <Link
      href={`/constituencies/${vip.constituencyId}`}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors",
      )}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0"
        style={{
          background: `${expectedParty.color}25`,
          color: expectedParty.color,
          border: `2px solid ${expectedParty.color}55`,
        }}
      >
        {vip.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate text-sm">{vip.name}</div>
        <div className="text-[11px] text-[var(--text-muted)] truncate">
          {c?.constituencyName ?? `AC #${vip.constituencyId}`}
        </div>
        {c && (() => {
          const hist = get2021ForAc(c.constituencyId, c.district);
          const histParty = partyById(hist.winner);
          return (
            <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
              <span className="opacity-60">2021:</span>{" "}
              <span style={{ color: histParty.color }} className="font-bold">
                {histParty.name}
              </span>{" "}
              <span className="tabular">+{hist.marginPct.toFixed(1)}pp</span>
            </div>
          );
        })()}
      </div>
      <div className="text-right shrink-0">
        {lead && leadParty ? (
          <>
            <div
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                leadingExpected ? "text-[var(--accent-won)]" : "text-[var(--accent-live)]",
              )}
            >
              {leadingExpected ? "✓ Leading" : "✗ Trailing"}
            </div>
            <div className="text-xs text-[var(--text-secondary)] tabular">
              {leadParty.name} +{formatNumber(lead.margin)}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {c?.status ?? "pending"}
          </div>
        )}
      </div>
    </Link>
  );
}

function VipMarquee({
  rows,
  t,
}: {
  rows: Array<{ vip: Vip; c: ReturnType<typeof Object> }>;
  t: (key: string) => string;
}) {
  // Duplicate the rows so the translate-by-50% loop is seamless. Speed scales
  // with count so a short list doesn't whip past faster than a long one.
  const loop = rows.length > 0 ? [...rows, ...rows] : [];
  const durationSec = Math.max(40, rows.length * 6);

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col">
      {/* Header strip — VIP badge + count */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-black px-2.5 py-1 rounded font-black text-xs uppercase tracking-[0.3em] shadow-lg">
            ★ {t("section.vips")}
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold">
            {t("scene.vips")}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/50 tabular">
          {rows.length}
        </span>
      </div>

      {/* Marquee row — fills remaining height. Each card is fixed-width so
          the row lengths stay deterministic for the seamless loop. */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {loop.length === 0 ? (
          <div className="h-full grid place-items-center text-white/40 text-sm uppercase tracking-widest">
            Awaiting VIP feed…
          </div>
        ) : (
          <div
            className="flex items-center gap-3 px-3 py-3 absolute top-1/2 -translate-y-1/2 whitespace-nowrap"
            style={{
              animation: `vip-marquee ${durationSec}s linear infinite`,
              width: "max-content",
            }}
          >
            {loop.map(({ vip, c }, i) => (
              <VipChip key={`${vip.constituencyId}-${i}`} vip={vip} c={c} />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes vip-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function VipChip({ vip, c }: { vip: Vip; c: ReturnType<typeof Object> }) {
  const expectedParty = partyById(vip.expectedParty);
  const lead = c?.leadingCandidate;
  const leadParty = lead ? partyById(lead.partyId) : null;
  const isWinning = lead?.partyId === vip.expectedParty;
  const hist = c ? get2021ForAc(c.constituencyId, c.district) : null;
  const histParty = hist ? partyById(hist.winner) : null;

  return (
    <Link
      href={`/broadcast/ac/${vip.constituencyId}`}
      className="shrink-0 inline-flex items-center gap-3 rounded-2xl px-4 py-4 bg-gradient-to-b from-[var(--bg-card)] to-[#04081a] border shadow-xl"
      style={{
        borderColor: isWinning
          ? `${expectedParty.color}66`
          : "rgba(255,255,255,0.1)",
        minWidth: "340px",
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shrink-0"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${expectedParty.color}40, ${expectedParty.color}10 70%, transparent)`,
          color: expectedParty.color,
          border: `2.5px solid ${expectedParty.color}66`,
        }}
      >
        {vip.initials}
      </div>
      <div className="flex flex-col justify-center min-w-0">
        <div className="font-black text-sm uppercase tracking-wide leading-tight whitespace-nowrap">
          {vip.name}
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">
          {c?.constituencyName ?? `AC #${vip.constituencyId}`}
        </div>
        {hist && histParty && (
          <div className="text-[9px] tabular text-[var(--text-muted)] mt-1 whitespace-nowrap">
            <span className="opacity-60">2021:</span>{" "}
            <span style={{ color: histParty.color }} className="font-bold">
              {histParty.name}
            </span>{" "}
            +{hist.marginPct.toFixed(1)}pp
          </div>
        )}
      </div>
      <div className="ml-2 pl-3 border-l border-white/10 text-right shrink-0">
        {lead && leadParty ? (
          <>
            <div
              className={cn(
                "text-[9px] font-black uppercase tracking-[0.25em]",
                isWinning
                  ? "text-[var(--accent-won)]"
                  : "text-[var(--accent-live)]",
              )}
            >
              {isWinning ? "★ Leading" : "✗ Trailing"}
            </div>
            <div
              className="text-2xl font-black tabular leading-none mt-0.5"
              style={{ color: leadParty.color }}
            >
              +{formatNumber(lead.margin)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] mt-0.5">
              {leadParty.name}
            </div>
          </>
        ) : (
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Pending
          </div>
        )}
      </div>
    </Link>
  );
}

