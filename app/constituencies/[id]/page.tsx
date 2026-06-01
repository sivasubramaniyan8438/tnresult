"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useLiveData } from "@/components/LiveDataProvider";
import { partyById } from "@/lib/parties";
import { RoundChart } from "@/components/RoundChart";
import { StatusPill } from "@/components/StatusPill";
import { formatNumber, formatTimeAgo } from "@/lib/cn";
import { getFull2021ForAc } from "@/lib/historical-by-ac";

type Detail = {
  constituency: { id: number; name: string; district: string; reservation: string };
  state: { status: string; round: number; total_rounds: number; total_votes: number; updated_at: number };
  candidates: Array<{
    id: number;
    name: string;
    party_id: string;
    sequence: number;
    votes: number;
    party: { id: string; name: string; color: string; fullName: string };
  }>;
  rounds: Array<{ round: number; votes: Record<string, number> }>;
};

export default function ConstituencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const constituencyId = parseInt(id, 10);
  const [detail, setDetail] = useState<Detail | null>(null);
  const { constituencies } = useLiveData();
  const summary = constituencies.find((c) => c.constituencyId === constituencyId);
  const liveUpdatedAt = summary?.updatedAt ?? 0;

  // Refetch when this constituency's updatedAt advances
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

  if (!detail) {
    return <div className="text-[var(--text-muted)] py-12 text-center">Loading…</div>;
  }
  if ("error" in detail) {
    return (
      <div className="card p-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Constituency not found</h1>
        <p className="text-[var(--text-muted)]">No data for AC #{constituencyId}.</p>
        <Link
          href="/constituencies"
          className="inline-block mt-4 text-[var(--accent-lead)] hover:underline"
        >
          ← Back to all constituencies
        </Link>
      </div>
    );
  }

  const sortedCandidates = [...detail.candidates].sort((a, b) => b.votes - a.votes);
  const top = sortedCandidates[0];
  const second = sortedCandidates[1];
  const margin = top && second ? top.votes - second.votes : 0;
  const topParty = top ? partyById(top.party_id) : null;
  const hist2021 = getFull2021ForAc(constituencyId);
  const hist2021WinnerParty = hist2021 ? partyById(hist2021.winner) : null;
  const hist2021RunnerParty = hist2021 ? partyById(hist2021.runner) : null;

  const progress = detail.state.total_rounds > 0
    ? (detail.state.round / detail.state.total_rounds) * 100
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <Link href="/" className="hover:text-[var(--accent-lead)]">Overview</Link>
        <span>›</span>
        <Link href="/constituencies" className="hover:text-[var(--accent-lead)]">Constituencies</Link>
        <span>›</span>
        <span className="text-[var(--text-secondary)]">{detail.constituency.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
        <div className="card p-6">
          <div className="flex items-baseline gap-3 flex-wrap mb-1">
            <span className="text-xs font-mono text-[var(--text-muted)]">AC #{detail.constituency.id}</span>
            <StatusPill status={detail.state.status} />
            {detail.constituency.reservation !== "GEN" && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-lead)]/15 text-[var(--accent-lead)] border border-[var(--accent-lead)]/30">
                {detail.constituency.reservation} reserved
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">{detail.constituency.name}</h1>
          <div className="text-sm text-[var(--text-secondary)] mt-1">
            {detail.constituency.district} District
          </div>

          {top && topParty ? (
            <div className="mt-5 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black"
                style={{
                  background: `${topParty.color}25`,
                  color: topParty.color,
                  border: `2px solid ${topParty.color}40`,
                }}
              >
                {top.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
                  {detail.state.status === "won" ? "Winner" : "Leading"}
                </div>
                <div className="font-black text-xl">{top.name}</div>
                <div className="text-sm" style={{ color: topParty.color }}>
                  {topParty.name}
                  {margin > 0 && (
                    <span className="text-[var(--text-secondary)] ml-2">
                      · margin {formatNumber(margin)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 text-[var(--text-muted)]">No votes counted yet.</div>
          )}
        </div>

        <div className="card p-5 min-w-[260px]">
          {hist2021 && hist2021WinnerParty ? (
            <>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
                2021 Result
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className="font-black text-base"
                  style={{ color: hist2021WinnerParty.color }}
                >
                  {hist2021WinnerParty.name}
                </span>
                <span className="text-xs text-[var(--text-secondary)] tabular">
                  +{hist2021.marginPct.toFixed(1)}pp
                </span>
              </div>
              <div className="text-sm font-semibold mt-0.5">{hist2021.winnerName}</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {hist2021.winnerSharePct.toFixed(1)}% share
              </div>
              {hist2021RunnerParty && hist2021.runnerName && (
                <div className="text-[11px] text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border)]">
                  Runner-up:{" "}
                  <span style={{ color: hist2021RunnerParty.color }} className="font-semibold">
                    {hist2021RunnerParty.name}
                  </span>{" "}
                  {hist2021.runnerName} · {hist2021.runnerSharePct.toFixed(1)}%
                </div>
              )}
              <div className="border-t border-[var(--border)] mt-3 pt-3" />
            </>
          ) : null}
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            Counting Progress
          </div>
          <div className="text-3xl font-black tabular mt-1">
            R{detail.state.round} / {detail.state.total_rounds}
          </div>
          <div className="h-2 bg-[var(--bg-base)] rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-[var(--accent-lead)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-3 space-y-0.5">
            <div>
              Total votes:{" "}
              <span className="text-[var(--text-primary)] tabular font-semibold">
                {formatNumber(detail.state.total_votes)}
              </span>
            </div>
            <div>
              Updated:{" "}
              <span className="text-[var(--text-primary)]">
                {formatTimeAgo(detail.state.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate leaderboard */}
      <div className="card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Candidates
        </h3>
        <ul className="space-y-2">
          {sortedCandidates.map((c, idx) => {
            const party = partyById(c.party_id);
            const totalVotes = sortedCandidates.reduce((s, x) => s + x.votes, 0);
            const pct = totalVotes > 0 ? (c.votes / totalVotes) * 100 : 0;
            return (
              <li
                key={c.id}
                className="relative bg-[var(--bg-base)] border border-[var(--border)] rounded-lg p-3 overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-500"
                  style={{ width: `${pct}%`, background: `${party.color}18` }}
                />
                <div className="relative flex items-center gap-3">
                  <span
                    className="text-xs font-bold tabular w-6 text-center text-[var(--text-muted)]"
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="w-1 h-10 rounded shrink-0"
                    style={{ background: party.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      <span style={{ color: party.color }}>{party.name}</span>
                      {idx === 0 && detail.state.status === "won" && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-won)]/20 text-[var(--accent-won)] border border-[var(--accent-won)]/40">
                          Winner
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black tabular">
                      {formatNumber(c.votes)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] tabular">
                      {pct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Round chart */}
      <RoundChart
        candidates={detail.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          party_id: c.party_id,
          votes: c.votes,
        }))}
        rounds={detail.rounds}
      />
    </div>
  );
}
