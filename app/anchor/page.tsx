"use client";
import { useMemo, useState } from "react";
import { useLiveData } from "@/components/LiveDataProvider";
import { useLocale } from "@/components/LocaleProvider";
import { partyById, MAJORITY_MARK, TOTAL_SEATS, FOCUS_BLOCS } from "@/lib/parties";
import { get2021ForAc } from "@/lib/historical-by-ac";
import { HISTORICAL_2021 } from "@/lib/historical";
import { formatIndian } from "@/lib/cn";

const HIST_VOTE_SHARE: Record<string, number> = Object.fromEntries(
  HISTORICAL_2021.map((h) => [h.partyId, h.voteShare]),
);

/**
 * Anchor cue-cards page — the THREE most-narratable stories right now.
 * Designed to be open on the anchor's prompter laptop (or beside the camera).
 * No charts, no clutter — each card is a one-line headline + supporting
 * details + a copy-pastable line for the anchor to actually say on air.
 *
 * Surface area kept narrow on purpose: a cluttered cue page becomes a worse
 * teleprompter.
 *
 * Stories ranked by "how likely is the anchor to want to mention this in
 * the next 60 seconds":
 *   1. Most-recent declared seat (topical)
 *   2. Closest race statewide (drama)
 *   3. Biggest swing vs 2021 OR a flip (story arc)
 */
type CueCard = {
  rank: 1 | 2 | 3 | 4;
  kind: "declared" | "close" | "swing" | "majority" | "flip" | "intro" | "swingometer";
  headline: string;
  subhead: string;
  spokenLine: string;
  accent: string;
};

export default function AnchorPage() {
  const { state, constituencies } = useLiveData();
  const { t } = useLocale();

  const cards = useMemo<CueCard[]>(() => {
    if (!state) return [];

    const out: CueCard[] = [];

    // 1. Latest declared
    const declared = constituencies
      .filter((c) => c.status === "won" && c.leadingCandidate)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const latest = declared[0];
    if (latest && latest.leadingCandidate) {
      const lc = latest.leadingCandidate;
      const party = partyById(lc.partyId);
      const hist = get2021ForAc(latest.constituencyId, latest.district);
      const flipNote =
        hist.winner !== lc.partyId
          ? `flips from ${hist.winner} (won here in 2021)`
          : `holds for ${party.name}`;
      out.push({
        rank: 1,
        kind: "declared",
        headline: `${latest.constituencyName} → ${party.name}`,
        subhead: `${lc.name} wins by ${formatIndian(lc.margin)} votes · ${flipNote}`,
        spokenLine: `Just declared — ${latest.constituencyName} for ${lc.name} of ${party.name}, with a margin of ${formatIndian(lc.margin)} votes${flipNote.startsWith("flips") ? `, flipping from ${hist.winner} who won here in 2021` : ""}.`,
        accent: party.color,
      });
    }

    // 2. Closest currently-counting race
    const close = [...constituencies]
      .filter((c) => (c.status === "leading" || c.status === "counting") && c.leadingCandidate && c.leadingCandidate.margin > 0)
      .sort((a, b) => a.leadingCandidate!.margin - b.leadingCandidate!.margin)[0];
    if (close && close.leadingCandidate) {
      const lc = close.leadingCandidate;
      const party = partyById(lc.partyId);
      out.push({
        rank: 2,
        kind: "close",
        headline: `${close.constituencyName} — too close to call`,
        subhead: `${party.name} ahead by just ${formatIndian(lc.margin)} · round ${close.round}/${close.totalRounds || "?"}`,
        spokenLine: `Watch ${close.constituencyName} — the closest race in Tamil Nadu right now. ${party.name} leads by just ${formatIndian(lc.margin)} votes after round ${close.round}.`,
        accent: party.color,
      });
    }

    // 3. Path-to-majority status for the leading bloc — anchor's go-to line
    const blocTotals = FOCUS_BLOCS.map((bloc) => {
      const total = state.parties
        .filter((p) => bloc.members.includes(p.partyId))
        .reduce((s, p) => s + p.total, 0);
      return { bloc, total };
    }).sort((a, b) => b.total - a.total);
    const lead = blocTotals[0];
    if (lead && lead.total > 0) {
      const seatsToGo = MAJORITY_MARK - lead.total;
      const reportingPct = ((state.declared + state.counting) / TOTAL_SEATS) * 100;
      out.push({
        rank: 3,
        kind: lead.total >= MAJORITY_MARK ? "majority" : "swing",
        headline:
          lead.total >= MAJORITY_MARK
            ? `${lead.bloc.id} crosses majority — ${lead.total} of ${TOTAL_SEATS}`
            : `${lead.bloc.id} ahead — ${lead.total} seats so far`,
        subhead:
          lead.total >= MAJORITY_MARK
            ? `Majority is 118 seats, ${lead.bloc.id} is at ${lead.total}`
            : `${seatsToGo} more needed for majority · ${reportingPct.toFixed(1)}% of ACs reporting`,
        spokenLine:
          lead.total >= MAJORITY_MARK
            ? `${lead.bloc.id} has crossed the majority mark of 118 seats, currently at ${lead.total} of ${TOTAL_SEATS}.`
            : `The ${lead.bloc.id} alliance is ahead with ${lead.total} seats. They need ${seatsToGo} more to cross the 118 majority mark, with ${reportingPct.toFixed(1)} percent of constituencies reporting.`,
        accent: "#fbbf24",
      });
    }

    // 4. Swingometer reading — quantifies "is there a wave?" and gives the
    //    anchor a ready-to-say line. Mirrors the formula in Swingometer.tsx
    //    so what the anchor reads matches what the on-screen needle shows.
    const dmkLive = state.parties.find((p) => p.partyId === "DMK")?.voteShare ?? 0;
    const aiadmkLive = state.parties.find((p) => p.partyId === "AIADMK")?.voteShare ?? 0;
    const tvkLive = state.parties.find((p) => p.partyId === "TVK")?.voteShare ?? 0;
    const swing =
      dmkLive === 0 && aiadmkLive === 0
        ? 0
        : (dmkLive - HIST_VOTE_SHARE.DMK) - (aiadmkLive - HIST_VOTE_SHARE.AIADMK);
    const reportingPctNum = ((state.declared + state.counting) / TOTAL_SEATS) * 100;
    const isThin = reportingPctNum < 10;
    const towardLabel = swing >= 0 ? "DMK" : "AIADMK";
    const swingMag = Math.abs(swing);
    let swingFlavor: string;
    if (swingMag < 1) swingFlavor = "essentially flat — the headline two-bloc race looks like 2021";
    else if (swingMag < 3) swingFlavor = "modest";
    else if (swingMag < 6) swingFlavor = "real but not a wave";
    else if (swingMag < 10) swingFlavor = "a clear wave";
    else swingFlavor = "a tsunami-scale swing";
    const tvkLine =
      tvkLive >= 15
        ? ` TVK is at ${tvkLive.toFixed(1)}% statewide — above 15%, our model now starts moving seats their way.`
        : ` TVK is at ${tvkLive.toFixed(1)}% — below the 15% line where they start meaningfully changing the projection.`;
    const swingHeadline =
      swingMag < 1
        ? `Swingometer flat — no clear bloc swing yet`
        : `${swingMag.toFixed(1)}pp swing toward ${towardLabel}`;
    out.push({
      rank: 4,
      kind: "swingometer",
      headline: swingHeadline,
      subhead: isThin
        ? `Reporting ${reportingPctNum.toFixed(1)}% — needle is directional only, projection hidden under 10%.`
        : `${swingFlavor} · DMK ${dmkLive.toFixed(1)}% (was ${HIST_VOTE_SHARE.DMK.toFixed(1)}%) · AIADMK ${aiadmkLive.toFixed(1)}% (was ${HIST_VOTE_SHARE.AIADMK.toFixed(1)}%)`,
      spokenLine: isThin
        ? `Our swingometer is reading a ${swingMag.toFixed(1)} percentage point move toward ${towardLabel} versus 2021. We're under 10 percent reporting, so this is directional only — we'll bring back the seat projection once a quarter of constituencies are in.`
        : `Our swingometer reads a ${swingMag.toFixed(1)} percentage point swing toward ${towardLabel} compared to 2021 — ${swingFlavor}. DMK is at ${dmkLive.toFixed(1)} percent vote share against the ${HIST_VOTE_SHARE.DMK.toFixed(1)} they got last time, AIADMK at ${aiadmkLive.toFixed(1)} against ${HIST_VOTE_SHARE.AIADMK.toFixed(1)}.${tvkLine}`,
      accent: "#06b6d4", // teal — neutral, doesn't bias toward either party
    });

    return out;
  }, [state, constituencies]);

  if (!state) {
    return (
      <div className="text-[var(--text-muted)] py-16 text-center">
        {t("anchor.connecting")}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-3 max-w-4xl mx-auto py-2">
        <h1 className="text-2xl sm:text-3xl font-black">{t("anchor.title")}</h1>
        <div className="card p-8 text-center text-[var(--text-muted)]">
          {t("anchor.awaiting")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto py-2">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            {t("anchor.eyebrow")}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">{t("anchor.title")}</h1>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] tabular">
          {t("anchor.autoRefresh")}
        </div>
      </header>

      <div className="space-y-3">
        {cards.map((card) => (
          <CueCardView key={card.rank} card={card} />
        ))}
      </div>

      <SwingometerGuide />
    </div>
  );
}

/** Static "how to read the swingometer" panel — collapsible so it doesn't
 *  steal screen real-estate from the live cue cards once the anchor is
 *  comfortable with the visualisation. Open by default for the first show. */
function SwingometerGuide() {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);
  return (
    <div className="card p-5 sm:p-6 border-l-4" style={{ borderLeftColor: "#06b6d4" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-baseline justify-between gap-3 w-full text-left"
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-cyan-400">
            📖 {open ? "▾" : "▸"} Reference
          </div>
          <h2 className="text-lg sm:text-xl font-black mt-1">{t("anchor.guide.title")}</h2>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {t("anchor.guide.subtitle")}
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-4 text-[14px] sm:text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h3 className="font-black text-[var(--text-primary)] mb-1">The needle</h3>
            <p>
              <strong>Left = AIADMK gaining vs 2021. Right = DMK gaining vs 2021.</strong>{" "}
              Centre = no change. Maths:
              <code className="mx-1 px-1.5 py-0.5 rounded bg-black/40 text-[12px] font-mono">
                (DMK now − DMK 2021) − (AIADMK now − AIADMK 2021)
              </code>
              . Scale is <strong>±15 percentage points</strong>. A 5pp swing is a real
              story; 10pp is a tsunami.
            </p>
          </section>
          <section>
            <h3 className="font-black text-[var(--text-primary)] mb-1">The seat projection underneath</h3>
            <p>
              Uses the <strong>Uniform Swing Model</strong> — applies the same statewide
              swing to every constituency&apos;s 2021 winning margin. If a seat had a
              4pp DMK margin in 2021 and the swing is −3pp toward AIADMK, that seat
              stays DMK; if the swing is −5pp, it flips. Standard election-night
              model — but always say{" "}
              <em>&ldquo;under uniform swing, this would project to…&rdquo;</em>{" "}
              rather than &ldquo;DMK will get 145 seats.&rdquo;
            </p>
          </section>
          <section>
            <h3 className="font-black text-[var(--text-primary)] mb-1">TVK adjustment (Vijay)</h3>
            <p>
              If TVK&apos;s statewide share crosses <strong>15%</strong>, the model
              steals seats proportionally — <strong>60% from DMK, 40% from AIADMK</strong>.
              Below 15%, projection treats this as a two-bloc race.
            </p>
          </section>
          <section>
            <h3 className="font-black text-[var(--text-primary)] mb-1">The thin-data gate</h3>
            <p>
              Under <strong>10% reporting</strong>, projection is hidden — five Chennai
              ACs would project DMK 220 seats and that&apos;s meaningless. Point at the
              needle and say{" "}
              <em>&ldquo;early signals only — projection comes back online once a
              quarter of seats are in.&rdquo;</em>
            </p>
          </section>
          <section>
            <h3 className="font-black text-[var(--text-primary)] mb-1">Anchor lines (off-air → on-air)</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <em>&ldquo;The swingometer is reading 4pp toward DMK from 2021 —
                modest but consistent across both Chennai and central TN.&rdquo;</em>
              </li>
              <li>
                <em>&ldquo;Notice the AIADMK-side reading: even with NDA bloc gains
                in BJP wins, the headline DMK-vs-AIADMK swing is essentially flat.&rdquo;</em>
              </li>
              <li>
                <em>&ldquo;If TVK consolidates above 15% statewide, our projection
                model starts moving seats their way — currently they&apos;re at
                11%, so the projection still treats this as a two-bloc race.&rdquo;</em>
              </li>
              <li>
                <em>&ldquo;This is uniform swing — it doesn&apos;t know about
                Vijay&apos;s Coimbatore appeal or the Salem belt. Treat the seat
                number as a <strong>range</strong>, not a verdict.&rdquo;</em>
              </li>
            </ul>
          </section>
          <section className="text-[12px] text-[var(--text-muted)] border-t border-white/5 pt-3">
            The swingometer cue card above (rank 4) computes today&apos;s reading
            using exactly this formula and gives you a fresh spoken line every
            time the page refreshes — copy and read.
          </section>
        </div>
      )}
    </div>
  );
}

function CueCardView({ card }: { card: CueCard }) {
  const { t } = useLocale();
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.spokenLine);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="card p-5 sm:p-6 relative"
      style={{ borderLeft: `4px solid ${card.accent}` }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-base"
            style={{ background: `${card.accent}30`, color: card.accent }}
          >
            {card.rank}
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: card.accent }}>
            {t(`anchor.kind.${card.kind}`)}
          </div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded border border-white/15 text-[var(--text-muted)] hover:border-white/40 hover:text-[var(--text-primary)] transition-colors"
        >
          ⎘ {t("anchor.copy")}
        </button>
      </div>
      <h2 className="text-xl sm:text-2xl font-black leading-tight">{card.headline}</h2>
      <div className="text-sm text-[var(--text-secondary)] mt-1">{card.subhead}</div>
      <blockquote
        className="mt-4 pl-4 border-l-2 italic text-[15px] sm:text-base leading-relaxed text-[var(--text-primary)]"
        style={{ borderColor: card.accent }}
      >
        {"“"}{card.spokenLine}{"”"}
      </blockquote>
    </div>
  );
}
