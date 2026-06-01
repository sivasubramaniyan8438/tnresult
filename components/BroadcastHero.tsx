"use client";
import { useLiveData } from "./LiveDataProvider";
import { formatIndian } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { partyById, MAJORITY_MARK, TOTAL_SEATS, FOCUS_BLOCS } from "@/lib/parties";
import { TickingNumber } from "./TickingNumber";

/**
 * Aggregate party tallies into the 4 broadcast blocs:
 *   INDIA = DMK + INC + VCK + MDMK + CPI + CPM (anchor: DMK)
 *   NDA   = AIADMK + BJP + PMK + DMDK (anchor: AIADMK)
 *   TVK   = TVK alone
 *   NTK   = NTK alone
 *
 * Each bloc carries the breakdown so the card can show "DMK 110 · INC 15 · VCK 4".
 */
function blocAggregates(parties: { partyId: string; leading: number; won: number; total: number; voteShare: number }[]) {
  return FOCUS_BLOCS.map((bloc) => {
    const members = parties.filter((p) => bloc.members.includes(p.partyId));
    return {
      bloc,
      total: members.reduce((s, p) => s + p.total, 0),
      won: members.reduce((s, p) => s + p.won, 0),
      leading: members.reduce((s, p) => s + p.leading, 0),
      voteShare: members.reduce((s, p) => s + p.voteShare, 0),
      breakdown: members.filter((p) => p.total > 0).sort((a, b) => b.total - a.total),
    };
  });
}

// Public portraits keyed by anchor party id — same source the home-page
// LeaderHeroCard uses. Add more by dropping a JPG into public/leaders/.
const LEADER_PHOTO: Record<string, string> = {
  DMK: "/leaders/stalin.jpg",
  AIADMK: "/leaders/eps.jpg",
  TVK: "/leaders/vijay.jpg",
  NTK: "/leaders/seeman.jpg",
};

export function BroadcastHero() {
  const { state } = useLiveData();
  const { t, tParty, tPartyLeader, tAllianceById } = useLocale();
  if (!state) return null;
  const focus = blocAggregates(state.parties);

  return (
    // 4-up grid that mirrors the home-page LeaderHeroCard composition.
    // Every dimension uses clamp() so a single layout handles three modes:
    //   - no camera (full ~960px scene height) — big portraits, huge number
    //   - camera=2 top-strip (~365px scene height) — compact but still vertical
    //   - in-between widths
    <div className="grid grid-cols-4 gap-3 h-full">
      {focus.map(({ bloc, total, won, leading, breakdown }) => {
        const party = partyById(bloc.anchorPartyId);
        const p = { partyId: bloc.anchorPartyId, total, won, leading };
        const initials = (party.leader ?? party.name)
          .split(/\s+/)
          .map((s) => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();
        const reachedMajority = p.total >= MAJORITY_MARK;
        const partyName = tParty(party.id, party.name);
        const leaderName = tPartyLeader(party.id, party.leader) || partyName;
        const allianceLabel = tAllianceById(party.alliance, party.allianceLabel);
        return (
          <div
            key={p.partyId}
            // containerType:size enables both cqh AND cqw. Photo is sized
            // with min(cqw, cqh) so it grows to fill whichever dimension is
            // smaller — no more tiny portrait floating in a tall narrow card.
            // Middle zone uses flex-1 so the photo+name block CENTERS in the
            // available space instead of leaving a huge empty band.
            className="relative rounded-2xl overflow-hidden flex flex-col bg-gradient-to-b from-[#0e1530] to-[#04081a] border-2 border-white/10 min-h-0"
            style={{ containerType: "size" }}
          >
            {/* Color band (always at top) */}
            <div
              className="self-stretch shrink-0"
              style={{ height: "clamp(2px, 0.8cqh, 8px)", background: party.color }}
            />
            {/* Party tab in top-left corner — absolute so it doesn't push photo */}
            <div className="absolute left-0 z-10" style={{ top: "clamp(2px, 0.8cqh, 8px)" }}>
              <div
                className="font-black tracking-wider shadow-lg"
                style={{
                  background: party.color,
                  color: party.textColor,
                  clipPath: "polygon(0 0, 100% 0, 90% 100%, 0% 100%)",
                  padding: "clamp(2px, 0.8cqh, 6px) 1.4rem clamp(2px, 0.8cqh, 6px) 0.75rem",
                  fontSize: "clamp(0.65rem, 1.6cqh, 0.95rem)",
                }}
              >
                {partyName}
              </div>
            </div>

            {/* Middle zone — photo + name + alliance, vertically centered.
                flex-1 absorbs all the leftover space so we no longer leave
                a giant empty navy strip between header and number plate. */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-2 py-2">
              <div
                className="rounded-full flex items-center justify-center font-black overflow-hidden shrink-0"
                style={{
                  // min() picks the smaller of width-based vs height-based
                  // sizing → photo fits without overflowing tall-narrow OR
                  // short-wide cards. Floor of 70px keeps it readable on
                  // the smallest top-strip.
                  // 38cqh (was 50) leaves enough room below the photo for
                  // leader name + alliance chip without colliding with the
                  // bottom plate in 4-cam top-strip mode.
                  // aspect-ratio + shrink-0 prevent flex-shrink from squishing
                  // ONE dimension and turning the circle into an ellipse.
                  width: "max(70px, min(70cqw, 38cqh))",
                  height: "max(70px, min(70cqw, 38cqh))",
                  aspectRatio: "1 / 1",
                  fontSize: "clamp(24px, 11cqw, 64px)",
                  background: `radial-gradient(circle at 30% 30%, ${party.color}30, ${party.color}10 70%, transparent)`,
                  color: `${party.color}cc`,
                  border: `4px solid ${party.color}`,
                  boxShadow: `0 10px 28px -10px ${party.color}55`,
                }}
              >
                {LEADER_PHOTO[party.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={LEADER_PHOTO[party.id]}
                    alt={party.leader ?? party.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  initials
                )}
              </div>

              <div className="text-center w-full" style={{ marginTop: "clamp(6px, 1.8cqh, 16px)" }}>
                <div
                  className="font-black uppercase tracking-wide leading-tight truncate"
                  style={{ fontSize: "clamp(0.78rem, 2.4cqw, 1.25rem)" }}
                >
                  {leaderName}
                </div>
                <div
                  className="inline-block rounded font-black uppercase tracking-[0.18em] max-w-full truncate"
                  style={{
                    marginTop: "clamp(3px, 0.8cqh, 8px)",
                    padding: "clamp(2px, 0.5cqh, 4px) clamp(6px, 1.4cqw, 10px)",
                    fontSize: "clamp(0.6rem, 1.5cqw, 0.78rem)",
                    background: `${party.color}25`,
                    color: party.color,
                    border: `1px solid ${party.color}55`,
                  }}
                  title={allianceLabel}
                >
                  {allianceLabel}
                </div>
              </div>
            </div>

            {/* Bottom plate — number + W/L. Always visible because the parent
                uses justify-between; never pushed below the card edge. */}
            <div
              className="bg-black/40 border-t border-white/5 rounded-xl text-center shrink-0"
              style={{
                margin: "clamp(4px, 1cqh, 10px)",
                padding: "clamp(4px, 1cqh, 10px) clamp(6px, 1.5cqh, 12px)",
              }}
            >
              <div
                className="uppercase tracking-[0.25em] text-[var(--text-muted)] flex items-center justify-center gap-1"
                style={{ fontSize: "clamp(0.55rem, 1.1cqh, 0.7rem)" }}
              >
                <span>↗</span>
                <span>{t("hero.leadsWon")}</span>
              </div>
              <div
                className="font-black tabular leading-none flex items-center justify-center gap-2"
                style={{
                  color: party.color,
                  fontSize: "clamp(28px, 9cqh, 96px)",
                  marginTop: "clamp(2px, 0.6cqh, 6px)",
                }}
              >
                <TickingNumber value={p.total} />
                {p.total > 0 && (
                  <span style={{ fontSize: "clamp(12px, 3.5cqh, 28px)" }}>↑</span>
                )}
              </div>
              <div
                className="grid grid-cols-2 gap-1.5"
                style={{ marginTop: "clamp(4px, 1cqh, 10px)" }}
              >
                <div className="bg-white/5 rounded px-1 py-0.5 text-center">
                  <div
                    className="uppercase tracking-wider text-[var(--text-muted)]"
                    style={{ fontSize: "clamp(0.5rem, 1cqh, 0.65rem)" }}
                  >
                    {t("hero.won")}
                  </div>
                  <TickingNumber
                    value={p.won}
                    className="font-black tabular text-[var(--accent-won)] block leading-none"
                    style={{ fontSize: "clamp(0.85rem, 2.4cqh, 1.4rem)" }}
                  />
                </div>
                <div className="bg-white/5 rounded px-1 py-0.5 text-center">
                  <div
                    className="uppercase tracking-wider text-[var(--text-muted)]"
                    style={{ fontSize: "clamp(0.5rem, 1cqh, 0.65rem)" }}
                  >
                    {t("hero.leads")}
                  </div>
                  <TickingNumber
                    value={p.leading}
                    className="font-black tabular text-[var(--accent-lead)] block leading-none"
                    style={{ fontSize: "clamp(0.85rem, 2.4cqh, 1.4rem)" }}
                  />
                </div>
              </div>
              {reachedMajority && (
                <div
                  className="font-black uppercase tracking-widest text-[var(--accent-won)]"
                  style={{
                    fontSize: "clamp(0.55rem, 1.2cqh, 0.75rem)",
                    marginTop: "clamp(2px, 0.6cqh, 6px)",
                  }}
                >
                  ★ {t("hero.majorityCrossed")}
                </div>
              )}
              {breakdown.length > 1 && (
                <div
                  className="tracking-wider text-white/60 flex justify-center gap-1 flex-wrap"
                  style={{
                    fontSize: "clamp(0.5rem, 1cqh, 0.65rem)",
                    marginTop: "clamp(2px, 0.6cqh, 4px)",
                  }}
                >
                  {breakdown.map((m) => {
                    const mp = partyById(m.partyId);
                    return (
                      <span key={m.partyId}>
                        <span style={{ color: mp.color }} className="font-bold">
                          {tParty(mp.id, mp.name)}
                        </span>{" "}
                        <span className="tabular text-white/80">{m.total}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BroadcastBigNumber() {
  const { state } = useLiveData();
  const { t, tParty } = useLocale();
  if (!state) return null;
  const overall = [...state.parties].sort((a, b) => b.total - a.total)[0];
  const party = overall && overall.total > 0 ? partyById(overall.partyId) : null;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="text-[20vh] font-black tabular leading-none" style={{ color: party?.color ?? "white" }}>
        {overall?.total ?? 0}
      </div>
      <div className="text-3xl font-bold uppercase tracking-[0.4em] mt-4" style={{ color: party?.color }}>
        {party ? tParty(party.id, party.name) : "—"}
      </div>
      <div className="text-base text-white/50 mt-2 uppercase tracking-widest">
        / {TOTAL_SEATS} · {t("label.majority")} {MAJORITY_MARK}
      </div>
      {overall && overall.total >= MAJORITY_MARK && (
        <div className="mt-6 px-6 py-3 rounded-full bg-[var(--accent-won)] text-black font-black text-xl uppercase tracking-widest shadow-2xl">
          ★ {t("hero.majoritySecured")}
        </div>
      )}
    </div>
  );
}

export function BroadcastLeaderBoard() {
  const { state } = useLiveData();
  const { t, tParty, tPartyFull } = useLocale();
  if (!state) return null;
  const ranked = state.parties.filter((p) => p.total > 0).slice(0, 8);

  return (
    <div className="card p-6 h-full overflow-auto">
      <h2 className="text-2xl font-black uppercase tracking-wide mb-4">{t("ticker.leaderboard")}</h2>
      <ul className="space-y-2">
        {ranked.map((p, i) => {
          const party = partyById(p.partyId);
          const widthPct = (p.total / TOTAL_SEATS) * 100;
          return (
            <li
              key={p.partyId}
              className="relative bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-4 overflow-hidden"
            >
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  background: `linear-gradient(90deg, ${party.color}40 0%, ${party.color}10 100%)`,
                }}
              />
              <div className="relative flex items-center gap-3">
                <span className="text-2xl font-black tabular text-[var(--text-muted)] w-8">
                  {i + 1}
                </span>
                <span
                  className="px-3 py-1 rounded font-black uppercase tracking-wider text-sm"
                  style={{ background: party.color, color: party.textColor }}
                >
                  {tParty(party.id, party.name)}
                </span>
                <span className="flex-1 truncate text-sm text-[var(--text-secondary)]">
                  {tPartyFull(party.id, party.fullName)}
                </span>
                <div className="text-right">
                  <div className="text-3xl font-black tabular" style={{ color: party.color }}>
                    {p.total}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] tabular">
                    {p.won} W · {p.leading} L · {p.voteShare.toFixed(1)}%
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BroadcastTicker() {
  const { constituencies } = useLiveData();
  const { t, tParty } = useLocale();
  const declared = constituencies
    .filter((c) => c.status === "won" && c.leadingCandidate)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 30);
  const close = constituencies
    .filter(
      (c) =>
        c.status === "leading" &&
        c.leadingCandidate &&
        c.leadingCandidate.margin > 0 &&
        c.leadingCandidate.margin < 3000,
    )
    .sort((a, b) => a.leadingCandidate!.margin - b.leadingCandidate!.margin)
    .slice(0, 20);

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex-1 rounded-2xl border-2 border-[var(--accent-won)]/40 overflow-hidden bg-gradient-to-r from-[#03130a] to-[#0a2418]">
        <div className="bg-[var(--accent-won)] text-black px-6 py-3 font-black text-2xl uppercase tracking-widest">
          ★ {t("ticker.justDeclared")} ({declared.length})
        </div>
        <ul className="divide-y divide-white/5">
          {declared.slice(0, 8).map((c) => {
            const lead = c.leadingCandidate!;
            const party = partyById(lead.partyId);
            return (
              <li key={c.constituencyId} className="px-6 py-3 flex items-center gap-4">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                  style={{ background: `${party.color}30`, color: party.color, border: `1px solid ${party.color}60` }}
                >
                  {tParty(party.id, party.name)}
                </span>
                <span className="font-bold text-lg flex-1">{c.constituencyName}</span>
                <span className="text-base text-white/80">{lead.name}</span>
                <span className="font-black tabular text-lg" style={{ color: party.color }}>
                  +{formatIndian(lead.margin)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex-1 rounded-2xl border-2 border-[var(--accent-counting)]/40 overflow-hidden bg-gradient-to-r from-[#1a0d0d] to-[#170808]">
        <div className="bg-[var(--accent-counting)] text-black px-6 py-3 font-black text-2xl uppercase tracking-widest">
          ⚡ {t("ticker.tightestRaces")} ({close.length})
        </div>
        <ul className="divide-y divide-white/5">
          {close.slice(0, 8).map((c) => {
            const lead = c.leadingCandidate!;
            const party = partyById(lead.partyId);
            return (
              <li key={c.constituencyId} className="px-6 py-3 flex items-center gap-4">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                  style={{ background: `${party.color}30`, color: party.color, border: `1px solid ${party.color}60` }}
                >
                  {tParty(party.id, party.name)}
                </span>
                <span className="font-bold text-lg flex-1">{c.constituencyName}</span>
                <span className="font-black tabular text-lg text-[var(--accent-counting)]">
                  +{formatIndian(lead.margin)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
