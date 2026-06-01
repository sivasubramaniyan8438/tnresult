"use client";
import { partyById, MAJORITY_MARK } from "@/lib/parties";
import type { PartyTally } from "@/lib/schema";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { TickingNumber } from "./TickingNumber";

const LEADER_PHOTO: Record<string, string> = {
  DMK: "/leaders/stalin.jpg",
  AIADMK: "/leaders/eps.jpg",
  TVK: "/leaders/vijay.jpg",
  NTK: "/leaders/seeman.jpg",
};

export function LeaderHeroCard({
  tally,
  rank,
}: {
  tally: PartyTally;
  rank: number;
}) {
  const party = partyById(tally.partyId);
  const reachedMajority = tally.total >= MAJORITY_MARK;
  const { t, tParty, tPartyLeader, tAllianceById } = useLocale();
  const partyName = tParty(party.id, party.name);
  const leaderName = tPartyLeader(party.id, party.leader) || partyName;
  const allianceLabel = tAllianceById(party.alliance, party.allianceLabel);

  const leaderInitials = (party.leader ?? party.name)
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[var(--bg-card)] to-[#06091a] border border-[var(--border)]",
        rank === 0 && "ring-1 ring-white/10",
      )}
      style={{
        // aspect-locked so the card has predictable proportions across the
        // 2-col (mobile) and 4-col (desktop) grid. containerType:size lets us
        // size every child against the card's own width/height with cqw/cqh,
        // so the photo grows with the card instead of staying tiny.
        aspectRatio: "4 / 5",
        containerType: "size",
      }}
    >
      {/* Top color band */}
      <div
        className="self-stretch shrink-0"
        style={{ height: "clamp(3px, 1cqh, 10px)", background: party.color }}
      />

      {/* Party tab in top-left */}
      <div
        className="absolute left-0 z-10"
        style={{ top: "clamp(3px, 1cqh, 10px)" }}
      >
        <div
          className="font-black tracking-wider shadow-lg"
          style={{
            background: party.color,
            color: party.textColor,
            clipPath: "polygon(0 0, 100% 0, 90% 100%, 0% 100%)",
            padding:
              "clamp(3px, 0.9cqh, 7px) clamp(20px, 5cqw, 32px) clamp(3px, 0.9cqh, 7px) clamp(8px, 2cqw, 14px)",
            fontSize: "clamp(0.7rem, 2.2cqw, 1rem)",
          }}
        >
          {partyName}
        </div>
      </div>

      {/* Photo + name + alliance chip — all sized against card WIDTH so
          the portrait fills the available horizontal space cleanly. */}
      <div className="flex flex-col items-center w-full px-2">
        <div
          className="rounded-full flex items-center justify-center font-black overflow-hidden shrink-0"
          style={{
            marginTop: "clamp(28px, 9cqh, 56px)",
            width: "clamp(110px, 52cqw, 280px)",
            height: "clamp(110px, 52cqw, 280px)",
            aspectRatio: "1 / 1",
            fontSize: "clamp(28px, 12cqw, 80px)",
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
            leaderInitials
          )}
        </div>
        <div
          className="text-center w-full"
          style={{ marginTop: "clamp(6px, 2cqh, 14px)" }}
        >
          <div
            className="font-black uppercase tracking-wide leading-tight truncate"
            style={{ fontSize: "clamp(0.85rem, 2.6cqw, 1.25rem)" }}
          >
            {leaderName}
          </div>
          <div
            className="inline-block rounded font-black uppercase tracking-[0.18em] max-w-full truncate"
            style={{
              marginTop: "clamp(3px, 0.8cqh, 8px)",
              padding: "clamp(2px, 0.5cqh, 4px) clamp(6px, 1.5cqw, 10px)",
              fontSize: "clamp(0.6rem, 1.6cqw, 0.78rem)",
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

      {/* Bottom number plate — flush to bottom via justify-between */}
      <div
        className="bg-black/40 border-t border-white/5 rounded-xl text-center shrink-0"
        style={{
          margin: "clamp(6px, 1.5cqh, 12px)",
          padding: "clamp(6px, 1.5cqh, 12px) clamp(8px, 2cqw, 14px)",
        }}
      >
        <div
          className="uppercase tracking-[0.25em] text-[var(--text-muted)] flex items-center justify-center gap-1"
          style={{ fontSize: "clamp(0.55rem, 1.4cqw, 0.72rem)" }}
        >
          <span>↗</span>
          <span>{t("hero.leadsWon")}</span>
        </div>
        <div
          className="font-black tabular leading-none flex items-center justify-center gap-2"
          style={{
            color: party.color,
            fontSize: "clamp(34px, 11cqw, 92px)",
            marginTop: "clamp(2px, 0.7cqh, 7px)",
          }}
        >
          <TickingNumber value={tally.total} />
          {tally.total > 0 && (
            <span style={{ fontSize: "clamp(14px, 4cqw, 30px)" }}>↑</span>
          )}
        </div>
        <div
          className="grid grid-cols-2 gap-1.5"
          style={{ marginTop: "clamp(5px, 1.2cqh, 10px)" }}
        >
          <div className="bg-white/5 rounded px-1 py-0.5 text-center">
            <div
              className="uppercase tracking-wider text-[var(--text-muted)]"
              style={{ fontSize: "clamp(0.55rem, 1.3cqw, 0.7rem)" }}
            >
              {t("hero.won")}
            </div>
            <TickingNumber
              value={tally.won}
              className="font-black tabular text-[var(--accent-won)] block leading-none"
              style={{ fontSize: "clamp(0.95rem, 2.8cqw, 1.45rem)" }}
            />
          </div>
          <div className="bg-white/5 rounded px-1 py-0.5 text-center">
            <div
              className="uppercase tracking-wider text-[var(--text-muted)]"
              style={{ fontSize: "clamp(0.55rem, 1.3cqw, 0.7rem)" }}
            >
              {t("hero.leads")}
            </div>
            <TickingNumber
              value={tally.leading}
              className="font-black tabular text-[var(--accent-lead)] block leading-none"
              style={{ fontSize: "clamp(0.95rem, 2.8cqw, 1.45rem)" }}
            />
          </div>
        </div>
        {reachedMajority && (
          <div
            className="font-black uppercase tracking-widest text-[var(--accent-won)]"
            style={{
              fontSize: "clamp(0.6rem, 1.4cqw, 0.78rem)",
              marginTop: "clamp(3px, 0.8cqh, 8px),",
            }}
          >
            ★ {t("hero.majorityCrossed")}
          </div>
        )}
      </div>
    </div>
  );
}
