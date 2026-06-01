"use client";
import { useLiveData } from "@/components/LiveDataProvider";
import { BroadcastBanner } from "@/components/BroadcastBanner";
import { LeaderHeroCard } from "@/components/LeaderHeroCard";
import { MajorityBar } from "@/components/MajorityBar";
import { ComparisonStrip } from "@/components/ComparisonStrip";
import { AllianceRollup } from "@/components/AllianceRollup";
import { VoteShareDonut } from "@/components/VoteShareDonut";
import { ConstituencyTable } from "@/components/ConstituencyTable";
import { LiveTicker } from "@/components/LiveTicker";
import { ProjectionCard } from "@/components/ProjectionCard";
import { CallStatusRollup } from "@/components/CallStatusRollup";
import { VipTracker } from "@/components/VipTracker";
import { BellwetherStrip } from "@/components/BellwetherStrip";
import { Swingometer } from "@/components/Swingometer";
import { SwingMap } from "@/components/SwingMap";
import { CloseRaces } from "@/components/CloseRaces";
import { Upsets } from "@/components/Upsets";
import { StorylinesPanel } from "@/components/StorylinesPanel";
import { JustDeclared } from "@/components/JustDeclared";
import { CountingVelocity } from "@/components/CountingVelocity";
import { KnifeEdge } from "@/components/KnifeEdge";
import { RegionalTally } from "@/components/RegionalTally";
import { MajorityTimer } from "@/components/MajorityTimer";
import { StatTimestamp } from "@/components/StatTimestamp";

const FOCUS_PARTIES = ["DMK", "AIADMK", "TVK", "NTK"];

export default function Home() {
  const { state, constituencies, recentlyChanged } = useLiveData();

  if (!state) {
    return <div className="text-[var(--text-muted)] py-12 text-center">Connecting…</div>;
  }

  // Build the 4 hero cards (always show DMK, AIADMK, TVK, NTK in this order)
  const heroParties = FOCUS_PARTIES.map(
    (id) =>
      state.parties.find((p) => p.partyId === id) ?? {
        partyId: id,
        leading: 0,
        won: 0,
        total: 0,
        voteShare: 0,
      },
  );

  return (
    <div className="space-y-5">
      {/* Broadcast banner */}
      <BroadcastBanner state={state} />

      {/* Live ticker */}
      <LiveTicker constituencies={constituencies} />

      {/* 4-card hero — DMK, AIADMK, TVK, NTK. 2x2 on mobile, 4x1 on desktop */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {heroParties.map((p, i) => (
          <LeaderHeroCard key={p.partyId} tally={p} rank={i} />
        ))}
      </section>

      {/* Live projection — the headline number every news ticker uses */}
      <div>
        <ProjectionCard />
        <div className="px-1 mt-1 flex justify-end">
          <StatTimestamp ts={state.lastUpdate} />
        </div>
      </div>

      {/* Path-to-majority bar + seat distribution */}
      <div>
        <MajorityBar parties={state.parties} />
        <div className="px-1 mt-1 flex justify-end">
          <StatTimestamp ts={state.lastUpdate} />
        </div>
      </div>

      {/* Time-to-majority projection — extrapolates the leading bloc's pace */}
      <MajorityTimer />

      {/* Just-declared feed (left) + counting velocity (right) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <JustDeclared />
        <CountingVelocity />
      </section>

      {/* Knife edge — drama compounds through the day */}
      <KnifeEdge />

      {/* Regional roll-up — North/Kongu/Delta/South narrative */}
      <RegionalTally />

      {/* vs 2021 comparison */}
      <ComparisonStrip parties={state.parties} acsReporting={state.declared + state.counting} />

      {/* Race calls + Storylines */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CallStatusRollup />
        <StorylinesPanel />
      </section>

      {/* Alliance + Vote share */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AllianceRollup parties={state.parties} />
        <VoteShareDonut parties={state.parties} acsReporting={state.declared + state.counting} />
      </section>

      {/* VIPs */}
      <VipTracker />

      {/* Bellwether strip */}
      <BellwetherStrip />

      {/* Swing analysis */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Swingometer />
        <div className="grid grid-cols-1 gap-3">
          <CloseRaces />
          <Upsets />
        </div>
      </section>

      {/* Swing map */}
      <SwingMap />

      {/* Constituency table */}
      <ConstituencyTable
        constituencies={constituencies}
        recentlyChanged={recentlyChanged}
      />
    </div>
  );
}
