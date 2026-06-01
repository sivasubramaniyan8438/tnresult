"use client";
import { useMemo } from "react";
import { useLiveData } from "./LiveDataProvider";
import { partyById } from "@/lib/parties";
import { getFull2021ForAc } from "@/lib/historical-by-ac";
import { TickingNumber } from "./TickingNumber";
import Link from "next/link";

/**
 * Incumbent vs new-face tracker — for every AC where 2026 has a winning
 * candidate, compare the name with the 2021 winner. Three buckets:
 *
 *   ✅ RETAINED  — 2026 winner = 2021 winner (same name, same person)
 *   ❌ OUSTED    — 2026 winner ≠ 2021 winner of SAME party (intra-party
 *                  incumbent loss — sitting MLA dropped, party held)
 *   🔄 FLIPPED   — 2026 winner from a different party (incumbent removed,
 *                  party changed too)
 *
 * The "throw the bums out" narrative anchors love. Pure composition over
 * existing data — no schema changes.
 */

const TRIVIAL = new Set(["a", "an", "the", "of", "and", "&", ".", ","]);
// Common Tamil surname / given-name tokens that aren't distinctive on
// their own — two different people often share these. Must match on
// MORE than these alone for the incumbent classification to fire.
const COMMON_TOKENS = new Set([
  "kumar", "raja", "selvam", "selvaraj", "murugan", "raman", "ramanathan",
  "chandran", "kannan", "krishnan", "veeran", "balan", "natesan", "nathan",
  "samy", "swamy", "sami", "sivam", "moorthy", "pandian", "pandi", "babu",
  "ravi", "rajan", "raj", "guru", "ganesh", "vinod", "vijay", "kumaran",
  "lakshmanan", "anbu", "saravanan", "senthil", "muthu", "perumal", "prabhu",
]);

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|er\.?|smt\.?|shri|sri|thiru|tmt\.?|adv\.?)\s+/i, "")
    .replace(/[.,'"’()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Conservative name-equality check. False NEGATIVES are fine (we'll classify
 * as "ousted" when actually retained — slight under-count of retentions).
 * False POSITIVES are dangerous (we'd falsely call a new MLA an incumbent
 * who's been re-elected, on air). So this errs HARD on the side of "no
 * match" for ambiguous cases:
 *
 *   1. Both names normalised + tokenised (length >= 2 only).
 *   2. The last token of EACH name (surname) MUST match exactly.
 *   3. At least 2 distinctive tokens must overlap (a "distinctive" token
 *      is one not in the COMMON_TOKENS list — handles "K. Kumar" vs
 *      "M. Kumar" who are different people but share "kumar").
 *   4. If either name has a single-letter initial, the OTHER name's first
 *      meaningful token must start with that letter (handles "K. Stalin"
 *      vs "M.K. Stalin" → match because "K" matches "M K" → fail this
 *      and we'd wrongly call them different).
 */
function nameMatches(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // Tokenise: drop trivials, keep all single letters as initials too.
  const tok = (s: string) =>
    s.split(" ").filter((t) => t.length >= 1 && !TRIVIAL.has(t));
  const ta = tok(na);
  const tb = tok(nb);
  if (ta.length === 0 || tb.length === 0) return false;

  // Surname (last token) must match exactly. If either is a single letter
  // (rare for surname), this rule is skipped.
  const surA = ta[ta.length - 1];
  const surB = tb[tb.length - 1];
  const surnameLikely = surA.length >= 2 && surB.length >= 2;
  if (surnameLikely && surA !== surB) return false;

  // Distinctive token overlap: tokens that are length>=2 AND not in the
  // common pool. Need at least 2 of these matching, OR (1 distinctive
  // match + matching surname when surname is itself distinctive).
  const distinctive = (tokens: string[]) =>
    tokens.filter((t) => t.length >= 2 && !COMMON_TOKENS.has(t));
  const dA = new Set(distinctive(ta));
  const dB = distinctive(tb);
  const distOverlap = dB.filter((t) => dA.has(t)).length;
  if (distOverlap >= 2) return true;
  // Surname is distinctive (not in COMMON_TOKENS) and matched → counts as 1
  if (surnameLikely && surA === surB && !COMMON_TOKENS.has(surA) && distOverlap >= 1) {
    return true;
  }
  return false;
}

export function IncumbentTracker({ variant = "scene" }: { variant?: "scene" | "card" }) {
  const { constituencies } = useLiveData();

  const buckets = useMemo(() => {
    const retained: typeof constituencies = [];
    const ousted: typeof constituencies = [];
    const flipped: typeof constituencies = [];
    let unverified = 0;
    for (const c of constituencies) {
      if (c.status !== "won" || !c.leadingCandidate) continue;
      const hist = getFull2021ForAc(c.constituencyId);
      if (!hist || !hist.winnerName) {
        unverified++;
        continue;
      }
      if (c.leadingCandidate.partyId !== hist.winner) {
        flipped.push(c);
      } else if (nameMatches(c.leadingCandidate.name, hist.winnerName)) {
        retained.push(c);
      } else {
        ousted.push(c);
      }
    }
    return { retained, ousted, flipped, unverified };
  }, [constituencies]);

  const totalCalled =
    buckets.retained.length + buckets.ousted.length + buckets.flipped.length;
  const churnPct =
    totalCalled > 0
      ? ((buckets.ousted.length + buckets.flipped.length) / totalCalled) * 100
      : 0;

  return (
    <div className={variant === "scene" ? "card p-4 h-full overflow-auto" : "card p-4"}>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
          🪑 Incumbents vs new faces
        </h3>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
          Of <span className="text-white/80 font-bold tabular">{totalCalled}</span>{" "}
          declared races
        </span>
      </div>

      {/* Three counters */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Counter
          glyph="✅"
          label="Retained"
          sub="Same MLA, won again"
          count={buckets.retained.length}
          color="#10b981"
        />
        <Counter
          glyph="❌"
          label="Ousted"
          sub="Party held, MLA changed"
          count={buckets.ousted.length}
          color="#f59e0b"
        />
        <Counter
          glyph="🔄"
          label="Flipped"
          sub="Different party won"
          count={buckets.flipped.length}
          color="#ef4444"
        />
      </div>

      {/* Churn headline — "X% of declared seats have a new MLA" */}
      {totalCalled > 0 && (
        <div className="mb-3 text-xs sm:text-sm text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">
            {churnPct.toFixed(0)}%
          </strong>{" "}
          of declared seats so far have sent a new MLA to the assembly —{" "}
          <span className="text-amber-300 font-bold">
            {buckets.ousted.length} ousted intra-party
          </span>
          ,{" "}
          <span className="text-red-300 font-bold">
            {buckets.flipped.length} flipped to another party
          </span>
          .
        </div>
      )}

      {/* Recent activity in each bucket */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Bucket
          title="Latest retained"
          accent="#10b981"
          rows={[...buckets.retained].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)}
          tagFor={(c) => `${partyById(c.leadingCandidate!.partyId).shortName}`}
        />
        <Bucket
          title="Latest ousted"
          accent="#f59e0b"
          rows={[...buckets.ousted].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)}
          tagFor={(c) => {
            const hist = getFull2021ForAc(c.constituencyId);
            return hist?.winnerName ? `was ${hist.winnerName.split(" ").slice(-1)[0]}` : "—";
          }}
        />
        <Bucket
          title="Latest flipped"
          accent="#ef4444"
          rows={[...buckets.flipped].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)}
          tagFor={(c) => {
            const hist = getFull2021ForAc(c.constituencyId);
            const newPartyId = c.leadingCandidate!.partyId;
            return hist ? `${hist.winner} → ${newPartyId}` : "";
          }}
        />
      </div>

      <div className="mt-3 text-[10px] text-[var(--text-muted)] leading-snug border-t border-white/5 pt-2 italic">
        Based on conservative name-matching against 2021 winners. The
        retained count is a safe LOWER BOUND — different romanisations of
        the same name fall into &ldquo;ousted&rdquo; rather than risk a
        false &ldquo;same MLA returned&rdquo; call.
        {buckets.unverified > 0 && (
          <>
            {" "}
            {buckets.unverified} called race
            {buckets.unverified === 1 ? "" : "s"} couldn&apos;t be
            cross-referenced (missing 2021 record).
          </>
        )}
      </div>
    </div>
  );
}

function Counter({
  glyph,
  label,
  sub,
  count,
  color,
}: {
  glyph: string;
  label: string;
  sub: string;
  count: number;
  color: string;
}) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{ background: `${color}15`, border: `1px solid ${color}50` }}
    >
      <div
        className="text-[10px] uppercase tracking-wider font-bold"
        style={{ color }}
      >
        {glyph} {label}
      </div>
      <div
        className="text-3xl font-black tabular leading-none mt-1"
        style={{ color }}
      >
        <TickingNumber value={count} />
      </div>
      <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">{sub}</div>
    </div>
  );
}

function Bucket({
  title,
  accent,
  rows,
  tagFor,
}: {
  title: string;
  accent: string;
  rows: ReturnType<typeof useLiveData>["constituencies"];
  tagFor: (c: ReturnType<typeof useLiveData>["constituencies"][number]) => string;
}) {
  return (
    <div className="rounded-md bg-black/30 p-2.5 border border-white/10">
      <div
        className="text-[10px] uppercase tracking-wider font-bold mb-2"
        style={{ color: accent }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-[var(--text-muted)] italic">
          None yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((c) => (
            <li key={c.constituencyId} className="text-[11px]">
              <Link
                href={`/broadcast/ac/${c.constituencyId}`}
                className="block hover:bg-white/5 rounded px-1 py-0.5 leading-snug"
              >
                <span className="font-bold truncate block">
                  {c.constituencyName}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {c.leadingCandidate?.name} · {tagFor(c)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
