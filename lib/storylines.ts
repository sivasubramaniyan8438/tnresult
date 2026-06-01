/**
 * Auto-headline / narrative engine.
 *
 * Watches the live state on every snapshot and emits "storylines" — each is
 * an event the anchor can either read on-air or fire as a chyron.
 *
 * A storyline has:
 *   id        — stable id so we don't re-emit the same story twice
 *   severity  — affects display ordering
 *   headline  — main line for the chyron
 *   subhead   — optional second line
 *   scene     — recommended scene to show with it (optional)
 *   ac        — recommended constituency (optional)
 */
import type { ConstituencySummary, StateSummary } from "./schema";
import { partyById, MAJORITY_MARK, TOTAL_SEATS } from "./parties";
import { rollupCalls } from "./calls";
import vips from "@/data/vips.json";
import bellwethers from "@/data/bellwethers.json";
import { get2021ForAc } from "./historical-by-ac";
import type { SceneId } from "./scenes";

export type Storyline = {
  id: string;
  severity: 1 | 2 | 3 | 4 | 5;
  template: "BREAKING" | "CALL" | "MILESTONE" | "QUOTE";
  /** Pre-rendered English headline (kept for backward compat / fallback) */
  headline: string;
  /** Pre-rendered English subhead */
  subhead?: string;
  /** i18n key for the headline. Display layer renders via t(headlineKey, args) */
  headlineKey?: string;
  /** i18n key for the subhead */
  subheadKey?: string;
  /** Substitution args for the i18n templates */
  args?: Record<string, string | number>;
  scene?: SceneId;
  acId?: number;
  emittedAt: number;
};

type Vip = { name: string; constituencyId: number; expectedParty: string; role: string };
type Bell = { constituencyId: number; label: string };

// Persistent set of storylines we've already emitted (to avoid spam)
const g = globalThis as unknown as { __tnStorylines?: Map<string, Storyline> };
if (!g.__tnStorylines) g.__tnStorylines = new Map();
const seen = g.__tnStorylines!;

export function detectStorylines(
  state: StateSummary,
  constituencies: ConstituencySummary[],
): Storyline[] {
  const newStorylines: Storyline[] = [];
  const now = Date.now();

  function emit(s: Omit<Storyline, "emittedAt">) {
    if (seen.has(s.id)) return;
    const story: Storyline = { ...s, emittedAt: now };
    seen.set(s.id, story);
    newStorylines.push(story);
  }

  // 1. First AC declared
  const declared = constituencies.filter((c) => c.status === "won");
  if (declared.length === 1) {
    const c = declared[0];
    const lead = c.leadingCandidate;
    if (lead) {
      const party = partyById(lead.partyId);
      emit({
        id: "first-declared",
        severity: 4,
        template: "CALL",
        headline: `FIRST RESULT: ${c.constituencyName.toUpperCase()}`,
        subhead: `${lead.name} (${party.name}) declared winner`,
        headlineKey: "story.firstResult",
        subheadKey: "story.firstResultSub",
        args: { ac: c.constituencyName, name: lead.name, party: party.name },
        acId: c.constituencyId,
      });
    }
  }

  // 2. Majority crossed
  for (const p of state.parties) {
    if (p.total >= MAJORITY_MARK) {
      const party = partyById(p.partyId);
      emit({
        id: `majority-crossed-${p.partyId}`,
        severity: 5,
        template: "BREAKING",
        headline: `${party.name} CROSSES ${MAJORITY_MARK} — MAJORITY SECURED`,
        subhead: `${p.total} of ${TOTAL_SEATS} seats`,
        headlineKey: "story.majorityCrossed",
        subheadKey: "story.majoritySub",
        args: { party: party.name, n: MAJORITY_MARK, total: p.total, grandTotal: TOTAL_SEATS },
        scene: "hero",
      });
    }
  }

  // 3. TVK opens account
  const tvk = state.parties.find((p) => p.partyId === "TVK");
  if (tvk && tvk.total >= 1) {
    emit({
      id: "tvk-opens",
      severity: 4,
      template: "MILESTONE",
      headline: `TVK OPENS ACCOUNT IN TN ASSEMBLY`,
      subhead: `Vijay's party wins first seat in maiden polls`,
      headlineKey: "story.tvkOpens",
      subheadKey: "story.tvkOpensSub",
    });
  }

  // 4. NTK opens account
  const ntk = state.parties.find((p) => p.partyId === "NTK");
  if (ntk && ntk.total >= 1) {
    emit({
      id: "ntk-opens",
      severity: 3,
      template: "MILESTONE",
      headline: `NTK OPENS ACCOUNT — SEEMAN'S BREAKTHROUGH`,
      subhead: `Naam Tamilar Katchi wins first ever assembly seat`,
      headlineKey: "story.ntkOpens",
      subheadKey: "story.ntkOpensSub",
    });
  }

  // 5. CM-candidate (Stalin / EPS) trailing/winning
  const vipList = vips as Vip[];
  for (const v of vipList) {
    const c = constituencies.find((x) => x.constituencyId === v.constituencyId);
    const lead = c?.leadingCandidate;
    if (!lead) continue;
    const expectedWinning = lead.partyId === v.expectedParty;
    if (!expectedWinning && c.status === "leading") {
      emit({
        id: `vip-trailing-${v.constituencyId}`,
        severity: 5,
        template: "BREAKING",
        headline: `UPSET WATCH: ${v.name.toUpperCase()} TRAILING`,
        subhead: `${v.role} behind in ${c.constituencyName}`,
        headlineKey: "story.upsetWatch",
        subheadKey: "story.upsetWatchSub",
        args: { name: v.name, role: v.role, ac: c.constituencyName },
        acId: c.constituencyId,
      });
    } else if (c.status === "won" && lead.partyId === v.expectedParty) {
      emit({
        id: `vip-won-${v.constituencyId}`,
        severity: 4,
        template: "CALL",
        headline: `${v.name.toUpperCase()} WINS ${c.constituencyName.toUpperCase()}`,
        subhead: v.role,
        headlineKey: "story.vipWins",
        args: { name: v.name, ac: c.constituencyName, role: v.role },
        acId: c.constituencyId,
      });
    } else if (c.status === "won" && lead.partyId !== v.expectedParty) {
      emit({
        id: `vip-lost-${v.constituencyId}`,
        severity: 5,
        template: "BREAKING",
        headline: `STUNNER: ${v.name.toUpperCase()} LOSES ${c.constituencyName.toUpperCase()}`,
        subhead: `${v.role} defeated by ${lead.name} (${partyById(lead.partyId).name})`,
        headlineKey: "story.vipLost",
        subheadKey: "story.vipLostSub",
        args: {
          name: v.name,
          ac: c.constituencyName,
          role: v.role,
          winner: lead.name,
          party: partyById(lead.partyId).name,
        },
        acId: c.constituencyId,
      });
    }
  }

  // 6. Bellwether flip — gated until the bellwether AC has progressed
  // through enough rounds to call a real flip (not just round-1 noise).
  const bellList = bellwethers as Bell[];
  for (const b of bellList) {
    const c = constituencies.find((x) => x.constituencyId === b.constituencyId);
    if (!c?.leadingCandidate) continue;
    // Must be at least 30% through the AC's count to trust the flip
    const acCompletion = c.totalRounds > 0 ? c.round / c.totalRounds : 0;
    if (acCompletion < 0.3 && c.status !== "won") continue;
    const hist = get2021ForAc(b.constituencyId, c.district);
    if (c.leadingCandidate.partyId !== hist.winner) {
      const oldP = partyById(hist.winner);
      const newP = partyById(c.leadingCandidate.partyId);
      emit({
        id: `bellwether-flipped-${b.constituencyId}`,
        severity: 4,
        template: "BREAKING",
        headline: `BELLWETHER FLIPS: ${b.label.toUpperCase()} ${oldP.name}→${newP.name}`,
        subhead: `Historic predictor now leans ${newP.name}`,
        headlineKey: "story.bellwetherFlip",
        subheadKey: "story.bellwetherFlipSub",
        args: { ac: b.label, old: oldP.name, new: newP.name, party: newP.name },
        scene: "bellwether",
        acId: c.constituencyId,
      });
    }
  }

  // 7. 100 races called
  const { rollup } = rollupCalls(constituencies);
  if (rollup.called >= 100) {
    emit({
      id: "100-called",
      severity: 3,
      template: "MILESTONE",
      headline: `100 RACES CALLED`,
      subhead: `Counting milestone · ${rollup.called} mathematical certainties`,
      headlineKey: "story.callMilestone",
      subheadKey: "story.callMilestone100Sub",
      args: { n: 100 },
    });
  }
  if (rollup.called >= 200) {
    emit({
      id: "200-called",
      severity: 3,
      template: "MILESTONE",
      headline: `200 RACES CALLED`,
      subhead: `Final stretch — ${TOTAL_SEATS - rollup.called} seats remaining`,
      headlineKey: "story.callMilestone",
      subheadKey: "story.callMilestone200Sub",
      args: { n: 200, remaining: TOTAL_SEATS - rollup.called },
    });
  }

  return newStorylines;
}

export function getRecentStorylines(limit = 30): Storyline[] {
  return Array.from(seen.values())
    .sort((a, b) => b.emittedAt - a.emittedAt || b.severity - a.severity)
    .slice(0, limit);
}

export function clearStorylines() {
  seen.clear();
}
