"use client";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { rollupCalls } from "@/lib/calls";
import { partyById } from "@/lib/parties";

const FOCUS = ["DMK", "AIADMK", "TVK", "NTK"];

export function CallStatusRollup({
  variant = "card",
}: {
  variant?: "card" | "scene";
}) {
  const { constituencies } = useLiveData();
  const { t, tParty } = useLocale();
  const { rollup } = rollupCalls(constituencies);

  const focusRows = FOCUS.map((id) => {
    const r = rollup.byParty[id] ?? { called: 0, likely: 0, leaning: 0, total: 0 };
    return { id, ...r };
  });

  if (variant === "scene") {
    return (
      <div className="card p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black uppercase tracking-wide">{t("call.title")}</h2>
          <div className="text-sm text-[var(--text-muted)] uppercase tracking-widest">
            {t("call.subtitle")}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Stat label={t("call.called")} value={rollup.called} color="var(--accent-won)" big />
          <Stat label={t("call.likely")} value={rollup.likely} color="var(--accent-counting)" big />
          <Stat label={t("call.leaning")} value={rollup.leaning} color="var(--accent-lead)" big />
          <Stat label={t("call.tooClose")} value={rollup.uncalled} color="var(--text-muted)" big />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {focusRows.map((r) => {
            const party = partyById(r.id);
            return (
              <div key={r.id} className="bg-[var(--bg-base)] border rounded-xl p-4" style={{ borderColor: `${party.color}40` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-2xl" style={{ color: party.color }}>
                    {tParty(party.id, party.name)}
                  </span>
                  <span className="font-black text-3xl tabular">{r.total}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Pill label={t("call.called")} n={r.called} color="var(--accent-won)" />
                  <Pill label={t("call.likely")} n={r.likely} color="var(--accent-counting)" />
                  <Pill label={t("call.leaning")} n={r.leaning} color="var(--accent-lead)" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("section.raceCalls")}
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t("call.subtitle")}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Stat label={t("call.called")} value={rollup.called} color="var(--accent-won)" />
        <Stat label={t("call.likely")} value={rollup.likely} color="var(--accent-counting)" />
        <Stat label={t("call.leaning")} value={rollup.leaning} color="var(--accent-lead)" />
        <Stat label={t("call.tooClose")} value={rollup.uncalled} color="var(--text-muted)" />
      </div>
      <div className="text-[11px] text-[var(--text-muted)] mt-2">
        {t("call.explanation")}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: number;
  color: string;
  big?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-base)] rounded-lg p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`font-black tabular leading-none mt-1 ${big ? "text-5xl" : "text-2xl"}`} style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Pill({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-black tabular text-base leading-none mt-0.5" style={{ color }}>
        {n}
      </div>
    </div>
  );
}
