"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useLiveData } from "@/components/LiveDataProvider";
import { partyById } from "@/lib/parties";
import { LiveClock } from "@/components/LiveClock";
import { PulseDot } from "@/components/PulseDot";
import { ChyronOverlay } from "@/components/ChyronOverlay";
import { CommandPalette } from "@/components/CommandPalette";
import { decideCall } from "@/lib/calls";
import { get2021ForAc } from "@/lib/historical-by-ac";
import { formatNumber } from "@/lib/cn";
import { useTenant } from "@/components/TenantProvider";

type Detail = {
  constituency: { id: number; name: string; district: string; reservation: string };
  state: { status: string; round: number; total_rounds: number; total_votes: number; updated_at: number };
  candidates: Array<{
    id: number;
    name: string;
    party_id: string;
    sequence: number;
    votes: number;
  }>;
};

export default function BroadcastAcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const constituencyId = parseInt(id, 10);
  const [detail, setDetail] = useState<Detail | null>(null);
  const { constituencies } = useLiveData();
  const summary = constituencies.find((c) => c.constituencyId === constituencyId);
  const liveUpdatedAt = summary?.updatedAt ?? 0;

  useEffect(() => {
    document.body.classList.add("broadcast");
    return () => document.body.classList.remove("broadcast");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/constituencies/${constituencyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDetail(d);
      });
    return () => {
      cancelled = true;
    };
  }, [constituencyId, liveUpdatedAt]);

  if (!detail || "error" in detail) {
    return (
      <div className="fixed inset-0 grid place-items-center text-white/60 bg-[#04081a]">
        Loading constituency…
      </div>
    );
  }

  const BRAND = useTenant();
  const sortedCandidates = [...detail.candidates].sort((a, b) => b.votes - a.votes);
  const top = sortedCandidates[0];
  const second = sortedCandidates[1];
  const margin = top && second ? top.votes - second.votes : 0;
  const totalVotes = sortedCandidates.reduce((s, c) => s + c.votes, 0);

  const topParty = top ? partyById(top.party_id) : null;
  const secondParty = second ? partyById(second.party_id) : null;
  const hist = get2021ForAc(detail.constituency.id, detail.constituency.district);
  const hist2021Party = partyById(hist.winner);

  const decision = summary ? decideCall(summary) : null;
  const flipped = top && hist.winner !== top.party_id;

  return (
    <>
      <CommandPalette />
      <ChyronOverlay />
      <div className="fixed inset-0 p-6 grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-4 bg-gradient-to-br from-[#04081a] via-[#08102a] to-[#04081a] text-white">
        {/* Banner */}
        <div className="rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl">
          <div className="bg-gradient-to-r from-[#0c1e4a] via-[#10286b] to-[#0c1e4a] flex items-center gap-4 px-5 py-3">
            <Link
              href="/broadcast"
              className="px-4 py-2 rounded-md font-black shadow-lg flex items-center gap-3"
              style={{ background: `linear-gradient(135deg, ${BRAND.channelAccent} 0%, ${BRAND.channelAccentDark} 100%)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.logoSrc}
                alt={BRAND.channelName}
                className="w-10 h-10 rounded-full bg-white/10 object-cover"
              />
              <div className="leading-tight text-white">
                <div className="text-lg whitespace-nowrap font-black">{BRAND.channelName}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/85 whitespace-nowrap">
                  {BRAND.channelTagline}
                </div>
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-[0.3em] text-amber-400 uppercase">
                Single Constituency Focus
              </div>
              <div className="font-black text-2xl uppercase tracking-wide truncate">
                AC {detail.constituency.id} · {detail.constituency.name}
                {flipped && (
                  <span className="ml-3 text-amber-400 text-sm font-black uppercase tracking-widest">
                    ↻ flipped vs 2021
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono font-black text-xl tabular leading-tight">
                  <LiveClock />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-white/70">
                  {detail.constituency.district}
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gradient-to-r from-[#dc2626] to-[#b91c1c] px-3 py-1.5 rounded-full font-black shadow-lg">
                <PulseDot color="#ffffff" size={8} />
                <span className="text-sm tracking-widest">LIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main: head-to-head */}
        <div className="grid grid-cols-2 gap-6 overflow-hidden">
          {/* Top candidate */}
          {top && topParty && (
            <CandidateBigCard
              candidate={top}
              party={topParty}
              role={detail.state.status === "won" ? "WINNER" : "LEADING"}
              votes={top.votes}
              voteShare={totalVotes > 0 ? (top.votes / totalVotes) * 100 : 0}
              margin={margin}
              showMargin
            />
          )}
          {/* Second */}
          {second && secondParty && (
            <CandidateBigCard
              candidate={second}
              party={secondParty}
              role="TRAILING"
              votes={second.votes}
              voteShare={totalVotes > 0 ? (second.votes / totalVotes) * 100 : 0}
              margin={-margin}
            />
          )}
          {!top && (
            <div className="col-span-2 text-center self-center">
              <div className="text-3xl font-black uppercase tracking-widest text-white/60">
                Awaiting first round
              </div>
            </div>
          )}
        </div>

        {/* Footer strip: 2021 + call + counting progress */}
        <div className="grid grid-cols-4 gap-3">
          <FooterCard
            label="2021 Winner"
            value={hist.winner}
            sub={`+${hist.marginPct.toFixed(1)}pp${hist.isKnown ? "" : " (estimate)"}`}
            color={hist2021Party.color}
          />
          <FooterCard
            label="Counting Progress"
            value={`R${detail.state.round} / ${detail.state.total_rounds}`}
            sub={`${formatNumber(detail.state.total_votes)} votes counted`}
            color="var(--accent-lead)"
          />
          <FooterCard
            label="Race Status"
            value={(decision?.status ?? "uncalled").toUpperCase()}
            sub={decision?.reason ?? ""}
            color={
              decision?.status === "called"
                ? "var(--accent-won)"
                : decision?.status === "likely"
                  ? "var(--accent-counting)"
                  : decision?.status === "leaning"
                    ? "var(--accent-lead)"
                    : "var(--text-muted)"
            }
          />
          <FooterCard
            label="Margin"
            value={margin > 0 ? `+${formatNumber(margin)}` : "—"}
            sub={top && second ? `${top.party_id} over ${second.party_id}` : ""}
            color={topParty?.color ?? "white"}
          />
        </div>
      </div>
    </>
  );
}

function CandidateBigCard({
  candidate,
  party,
  role,
  votes,
  voteShare,
  margin,
  showMargin,
}: {
  candidate: { name: string; party_id: string };
  party: { name: string; color: string; textColor: string; allianceLabel: string };
  role: string;
  votes: number;
  voteShare: number;
  margin: number;
  showMargin?: boolean;
}) {
  const initials = candidate.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-3xl flex flex-col bg-gradient-to-b from-[#0e1530] to-[#04081a] border-2 overflow-hidden"
      style={{ borderColor: `${party.color}80` }}
    >
      <div
        className="px-6 py-2 font-black uppercase tracking-[0.4em] text-base shadow-lg"
        style={{ background: party.color, color: party.textColor }}
      >
        {role}
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div
            className="w-56 h-56 mx-auto rounded-full flex items-center justify-center text-9xl font-black"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${party.color}30, ${party.color}10 70%, transparent)`,
              color: party.color,
              border: `4px solid ${party.color}60`,
            }}
          >
            {initials}
          </div>
          <div className="mt-6 font-black text-3xl uppercase tracking-wide leading-tight">
            {candidate.name}
          </div>
          <div className="mt-1 text-base uppercase tracking-[0.3em] text-white/60">
            {party.name} · {party.allianceLabel}
          </div>
        </div>
      </div>
      <div className="bg-black/50 m-4 rounded-2xl p-4 text-center border border-white/5">
        <div className="text-xs uppercase tracking-[0.3em] text-white/60">Votes</div>
        <div className="text-7xl font-black tabular leading-none mt-1" style={{ color: party.color }}>
          {formatNumber(votes)}
        </div>
        <div className="text-base text-white/70 tabular mt-1">{voteShare.toFixed(2)}%</div>
        {showMargin && margin > 0 && (
          <div className="mt-3 text-base font-black uppercase tracking-wider" style={{ color: party.color }}>
            ↗ Margin +{formatNumber(margin)}
          </div>
        )}
      </div>
    </div>
  );
}

function FooterCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">{label}</div>
      <div className="font-black uppercase tracking-wide text-xl leading-none mt-1" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-white/55 mt-1 truncate">{sub}</div>
    </div>
  );
}
