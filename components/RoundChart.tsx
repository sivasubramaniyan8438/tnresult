"use client";
import { partyById } from "@/lib/parties";
import { formatNumber } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";

type Candidate = {
  id: number;
  name: string;
  party_id: string;
  votes: number;
};

type RoundData = {
  round: number;
  votes: Record<string, number>;
};

export function RoundChart({
  candidates,
  rounds,
}: {
  candidates: Candidate[];
  rounds: RoundData[];
}) {
  const { t } = useLocale();
  if (rounds.length === 0) {
    return (
      <div className="card p-5 text-center py-12 text-[var(--text-muted)]">
        {t("round.empty")}
      </div>
    );
  }

  const maxVotes = Math.max(
    1,
    ...rounds.flatMap((r) => Object.values(r.votes)),
  );

  // Plot top 5 candidates by current votes
  const topCandidates = [...candidates]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);

  // Compute leader per round (winner of votes that round) and lead-change events
  const roundLeaders: { round: number; leaderId: number; margin: number }[] = [];
  for (const r of rounds) {
    let bestId = -1;
    let bestVotes = -1;
    let secondVotes = 0;
    for (const c of candidates) {
      const v = r.votes[c.id] ?? 0;
      if (v > bestVotes) {
        secondVotes = bestVotes >= 0 ? bestVotes : 0;
        bestVotes = v;
        bestId = c.id;
      } else if (v > secondVotes) {
        secondVotes = v;
      }
    }
    roundLeaders.push({ round: r.round, leaderId: bestId, margin: bestVotes - secondVotes });
  }
  const leadChanges = roundLeaders.filter(
    (r, i) => i > 0 && r.leaderId !== roundLeaders[i - 1].leaderId,
  );

  // Chart dims
  const W = 800;
  const H = 280;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 30;

  const xFor = (round: number) =>
    padL + ((round - 1) / Math.max(1, rounds.length - 1)) * (W - padL - padR);
  const yFor = (votes: number) =>
    padT + (1 - votes / maxVotes) * (H - padT - padB);

  return (
    <div className="space-y-3">
      {/* Vote trend chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Round-by-round vote trend
          </h3>
          {leadChanges.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-counting)]/20 text-[var(--accent-counting)] border border-[var(--accent-counting)]/40">
              {leadChanges.length} lead change{leadChanges.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" preserveAspectRatio="none">
            {/* gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line
                key={t}
                x1={padL}
                x2={W - padR}
                y1={padT + t * (H - padT - padB)}
                y2={padT + t * (H - padT - padB)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            ))}
            {/* y-axis labels */}
            {[0, 0.5, 1].map((t) => (
              <text
                key={t}
                x={4}
                y={padT + (1 - t) * (H - padT - padB) + 4}
                fill="rgba(148,163,184,0.6)"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {formatNumber(Math.round(maxVotes * t))}
              </text>
            ))}

            {/* x-axis round labels */}
            {rounds.map((r) => (
              <text
                key={r.round}
                x={xFor(r.round)}
                y={H - 8}
                fill="rgba(148,163,184,0.6)"
                fontSize={10}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                R{r.round}
              </text>
            ))}

            {/* Lead change vertical markers */}
            {leadChanges.map((c) => {
              const x = xFor(c.round);
              return (
                <g key={c.round}>
                  <line
                    x1={x}
                    x2={x}
                    y1={padT}
                    y2={H - padB}
                    stroke="rgba(245, 158, 11, 0.35)"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                  />
                  <text
                    x={x}
                    y={padT + 12}
                    fontSize={9}
                    fill="#f59e0b"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    ↻ flip
                  </text>
                </g>
              );
            })}

            {/* Lines + areas */}
            {topCandidates.map((c) => {
              const party = partyById(c.party_id);
              const points = rounds
                .map((r) => {
                  const v = r.votes[c.id] ?? 0;
                  return `${xFor(r.round)},${yFor(v)}`;
                })
                .join(" ");
              const areaPoints = `${xFor(rounds[0].round)},${H - padB} ${points} ${xFor(rounds[rounds.length - 1].round)},${H - padB}`;
              return (
                <g key={c.id}>
                  <polyline
                    points={areaPoints}
                    fill={party.color}
                    fillOpacity={0.06}
                    stroke="none"
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={party.color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {rounds.map((r) => {
                    const v = r.votes[c.id] ?? 0;
                    return (
                      <circle
                        key={r.round}
                        cx={xFor(r.round)}
                        cy={yFor(v)}
                        r={3}
                        fill={party.color}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
          {topCandidates.map((c) => {
            const party = partyById(c.party_id);
            return (
              <div key={c.id} className="flex items-center gap-1.5">
                <span className="w-3 h-1 rounded" style={{ background: party.color }} />
                <span className="text-[var(--text-primary)]">{c.name}</span>
                <span className="text-[var(--text-muted)]">({party.name})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Margin of leader chart */}
      <MarginChart candidates={candidates} rounds={rounds} />

      {/* Lead history timeline */}
      <div className="card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Lead history
        </h3>
        <div className="flex flex-wrap gap-1">
          {roundLeaders.map((rl, i) => {
            const cand = candidates.find((c) => c.id === rl.leaderId);
            const party = cand ? partyById(cand.party_id) : null;
            const flipped = i > 0 && rl.leaderId !== roundLeaders[i - 1].leaderId;
            return (
              <div
                key={rl.round}
                className="flex flex-col items-center gap-1"
                title={cand ? `R${rl.round}: ${cand.name} +${formatNumber(rl.margin)}` : `R${rl.round}`}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black tabular shrink-0"
                  style={{
                    background: party ? `${party.color}` : "rgba(255,255,255,0.06)",
                    color: party?.textColor ?? "var(--text-muted)",
                    border: flipped ? "2px solid #f59e0b" : "1px solid transparent",
                  }}
                >
                  {rl.round}
                </div>
                {flipped && (
                  <span className="text-[8px] text-[#f59e0b] font-bold uppercase">{t("label.flipShort")}</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          {t("round.legend")}
        </p>
      </div>
    </div>
  );
}

function MarginChart({
  candidates,
  rounds,
}: {
  candidates: Candidate[];
  rounds: RoundData[];
}) {
  // For each round, compute leader's margin over runner-up
  const points = rounds.map((r) => {
    let bestVotes = -1;
    let secondVotes = 0;
    let leaderId = -1;
    for (const c of candidates) {
      const v = r.votes[c.id] ?? 0;
      if (v > bestVotes) {
        secondVotes = bestVotes >= 0 ? bestVotes : 0;
        bestVotes = v;
        leaderId = c.id;
      } else if (v > secondVotes) {
        secondVotes = v;
      }
    }
    return { round: r.round, margin: bestVotes - secondVotes, leaderId };
  });

  const maxMargin = Math.max(1, ...points.map((p) => p.margin));

  const W = 800;
  const H = 160;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 30;

  const xFor = (round: number) =>
    padL + ((round - 1) / Math.max(1, rounds.length - 1)) * (W - padL - padR);
  const yFor = (m: number) => padT + (1 - m / maxMargin) * (H - padT - padB);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        Lead margin per round
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" preserveAspectRatio="none">
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={padL}
              x2={W - padR}
              y1={padT + t * (H - padT - padB)}
              y2={padT + t * (H - padT - padB)}
              stroke="rgba(255,255,255,0.06)"
            />
          ))}
          {[0, 0.5, 1].map((t) => (
            <text
              key={t}
              x={4}
              y={padT + (1 - t) * (H - padT - padB) + 4}
              fill="rgba(148,163,184,0.6)"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
            >
              {formatNumber(Math.round(maxMargin * t))}
            </text>
          ))}
          {points.map((p, i) => {
            const cand = candidates.find((c) => c.id === p.leaderId);
            const party = cand ? partyById(cand.party_id) : null;
            const x = xFor(p.round);
            const y = yFor(p.margin);
            const w = (W - padL - padR) / Math.max(rounds.length, 1) * 0.7;
            return (
              <g key={p.round}>
                <rect
                  x={x - w / 2}
                  y={y}
                  width={w}
                  height={H - padB - y}
                  fill={party?.color ?? "#64748b"}
                  rx={2}
                  opacity={0.85}
                />
                <text
                  x={x}
                  y={H - 8}
                  fill="rgba(148,163,184,0.6)"
                  fontSize={10}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  R{p.round}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        Bar height = leader's margin over runner-up. Bar colour = leading party that round.
      </p>
    </div>
  );
}
