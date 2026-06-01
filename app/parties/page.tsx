"use client";
import { useLiveData } from "@/components/LiveDataProvider";
import { useLocale } from "@/components/LocaleProvider";
import { LeaderHeroCard } from "@/components/LeaderHeroCard";
import { PartyLeaderCard } from "@/components/PartyLeaderCard";
import { ComparisonStrip } from "@/components/ComparisonStrip";
import { AllianceRollup } from "@/components/AllianceRollup";
import { VoteShareDonut } from "@/components/VoteShareDonut";
import { PARTIES } from "@/lib/parties";

const FOCUS_PARTIES = ["DMK", "AIADMK", "TVK", "NTK"];

export default function PartiesPage() {
  const { state } = useLiveData();
  const { t, tParty, tPartyFull, tAlliance } = useLocale();
  if (!state) {
    return <div className="text-[var(--text-muted)] py-12 text-center">{t("page.loading")}</div>;
  }

  const focus = FOCUS_PARTIES.map(
    (id) =>
      state.parties.find((p) => p.partyId === id) ?? {
        partyId: id,
        leading: 0,
        won: 0,
        total: 0,
        voteShare: 0,
      },
  );

  const otherParties = state.parties
    .filter((p) => !FOCUS_PARTIES.includes(p.partyId) && p.total > 0)
    .sort((a, b) => b.total - a.total);

  // Always show all 14 known parties for completeness
  const all = PARTIES.map(
    (p) =>
      state.parties.find((s) => s.partyId === p.id) ?? {
        partyId: p.id,
        leading: 0,
        won: 0,
        total: 0,
        voteShare: 0,
      },
  ).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">{t("page.parties.title")}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t("page.parties.subtitle")}
        </p>
      </div>

      {/* Top 4 hero */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {focus.map((p, i) => (
          <LeaderHeroCard key={p.partyId} tally={p} rank={i} />
        ))}
      </section>

      <ComparisonStrip parties={state.parties} acsReporting={state.declared + state.counting} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AllianceRollup parties={state.parties} />
        <VoteShareDonut parties={state.parties} acsReporting={state.declared + state.counting} />
      </section>

      {/* Other parties */}
      {otherParties.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Other parties with seats
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {otherParties.map((p, i) => (
              <PartyLeaderCard key={p.partyId} tally={p} rank={i + 4} />
            ))}
          </div>
        </section>
      )}

      {/* All parties table */}
      <section className="card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          All parties tracked
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left py-2 pr-2">Party</th>
                <th className="text-left py-2 pr-2 hidden sm:table-cell">Alliance</th>
                <th className="text-right py-2 pr-2">Won</th>
                <th className="text-right py-2 pr-2">Leading</th>
                <th className="text-right py-2 pr-2">Total</th>
                <th className="text-right py-2 pr-2">Vote share</th>
              </tr>
            </thead>
            <tbody>
              {all.map((p) => {
                const party = PARTIES.find((x) => x.id === p.partyId)!;
                return (
                  <tr
                    key={p.partyId}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-6 rounded-sm" style={{ background: party.color }} />
                        <div>
                          <div className="font-bold" style={{ color: party.color }}>
                            {party.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {party.fullName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-[var(--text-secondary)] hidden sm:table-cell">
                      {party.allianceLabel}
                    </td>
                    <td className="py-2 pr-2 text-right tabular text-[var(--accent-won)]">{p.won}</td>
                    <td className="py-2 pr-2 text-right tabular text-[var(--accent-lead)]">
                      {p.leading}
                    </td>
                    <td className="py-2 pr-2 text-right tabular font-bold">{p.total}</td>
                    <td className="py-2 pr-2 text-right tabular">
                      {p.voteShare > 0 ? `${p.voteShare.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
