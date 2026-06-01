"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { partyById } from "@/lib/parties";
import type { ConstituencySummary } from "@/lib/schema";
import { cn, formatNumber } from "@/lib/cn";
import { StatusPill } from "./StatusPill";
import { useLocale } from "./LocaleProvider";

type FilterKey = "all" | "won" | "leading" | "counting" | "pending";

export function ConstituencyTable({
  constituencies,
  recentlyChanged,
  initialQuery = "",
}: {
  constituencies: ConstituencySummary[];
  recentlyChanged: Set<number>;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const { t, tParty } = useLocale();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return constituencies.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (partyFilter !== "all" && c.leadingCandidate?.partyId !== partyFilter) return false;
      if (!q) return true;
      return (
        c.constituencyName.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        String(c.constituencyId).includes(q) ||
        c.leadingCandidate?.name.toLowerCase().includes(q)
      );
    });
  }, [constituencies, query, filter, partyFilter]);

  const counts = useMemo(() => {
    const c = { all: constituencies.length, won: 0, leading: 0, counting: 0, pending: 0 };
    for (const x of constituencies) {
      if (x.status === "won") c.won++;
      else if (x.status === "leading") c.leading++;
      else if (x.status === "counting") c.counting++;
      else c.pending++;
    }
    return c;
  }, [constituencies]);

  const partyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of constituencies) {
      if (c.leadingCandidate) set.add(c.leadingCandidate.partyId);
    }
    return Array.from(set).sort();
  }, [constituencies]);

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{t("label.constituencies")}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t("table.shown", { n: filtered.length, total: constituencies.length })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="search"
            placeholder={t("table.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm w-full sm:w-72 placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none"
          />
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent-lead)] outline-none"
          >
            <option value="all">{t("table.allParties")}</option>
            {partyOptions.map((p) => (
              <option key={p} value={p}>
                {tParty(p, partyById(p).name)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {(["all", "won", "leading", "counting", "pending"] as FilterKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider whitespace-nowrap border transition-colors",
              filter === k
                ? "bg-[var(--bg-card-hover)] border-[var(--border-strong)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]",
            )}
          >
            {k === "all" ? t("filter.all") : t(`status.${k}`)}
            <span className="ml-1.5 text-[var(--text-muted)] tabular">{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="text-left py-2 pr-2 w-12">#</th>
              <th className="text-left py-2 pr-2">{t("label.constituency")}</th>
              <th className="text-left py-2 pr-2 hidden md:table-cell">{t("label.district")}</th>
              <th className="text-left py-2 pr-2">{t("hero.leadingCap")}</th>
              <th className="text-left py-2 pr-2 hidden sm:table-cell">{t("label.margin")}</th>
              <th className="text-left py-2 pr-2 hidden lg:table-cell">{t("label.round")}</th>
              <th className="text-left py-2 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const lead = c.leadingCandidate;
              const party = lead ? partyById(lead.partyId) : null;
              const flash = recentlyChanged.has(c.constituencyId);
              return (
                <tr
                  key={c.constituencyId}
                  className={cn(
                    "border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors",
                    flash && "flash",
                  )}
                >
                  <td className="py-2 pr-2 text-[var(--text-muted)] tabular">{c.constituencyId}</td>
                  <td className="py-2 pr-2">
                    <Link
                      href={`/constituencies/${c.constituencyId}`}
                      className="font-medium hover:text-[var(--accent-lead)]"
                    >
                      {c.constituencyName}
                    </Link>
                    <div className="md:hidden text-xs text-[var(--text-muted)]">{c.district}</div>
                  </td>
                  <td className="py-2 pr-2 text-[var(--text-secondary)] hidden md:table-cell">
                    {c.district}
                  </td>
                  <td className="py-2 pr-2">
                    {lead && party ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-6 rounded-sm shrink-0"
                          style={{ background: party.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate max-w-[12rem]">{lead.name}</div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {party.name} &middot;{" "}
                            <span className="tabular">{formatNumber(lead.votes)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 hidden sm:table-cell">
                    {lead && lead.margin > 0 ? (
                      <span className="tabular text-[var(--text-secondary)]">
                        +{formatNumber(lead.margin)}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 hidden lg:table-cell text-[var(--text-secondary)] tabular">
                    {c.round > 0 ? `R${c.round} / ${c.totalRounds}` : "—"}
                  </td>
                  <td className="py-2 pr-2">
                    <StatusPill status={c.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            {t("table.noMatches")}
          </div>
        )}
      </div>
    </div>
  );
}
