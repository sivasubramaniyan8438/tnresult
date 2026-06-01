"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveData } from "@/components/LiveDataProvider";
import { SceneSwitcher } from "@/components/SceneSwitcher";
import { ChyronOverlay } from "@/components/ChyronOverlay";
import { CommandPalette } from "@/components/CommandPalette";
import { isValidScene, SCENE_BY_ID, SCENES, type SceneId } from "@/lib/scenes";
import { useLocale } from "@/components/LocaleProvider";
import { CameraFrameWrapper } from "@/components/CameraFrameWrapper";
import { AllianceTotalsStrip } from "@/components/AllianceTotalsStrip";
import { LiveTicker } from "@/components/LiveTicker";
import { BroadcastTopStrip } from "@/components/BroadcastTopStrip";

import { BroadcastHero, BroadcastLeaderBoard, BroadcastTicker } from "@/components/BroadcastHero";
import { Swingometer } from "@/components/Swingometer";
import { TnMapCompare } from "@/components/TnMapCompare";
import { ProjectionCard } from "@/components/ProjectionCard";
import { VipTracker } from "@/components/VipTracker";
import { CloseRaces } from "@/components/CloseRaces";
import { Upsets } from "@/components/Upsets";
import { BellwetherStrip } from "@/components/BellwetherStrip";
import { KnifeEdge } from "@/components/KnifeEdge";
import { RegionalTally } from "@/components/RegionalTally";
import { MajorityTimer } from "@/components/MajorityTimer";
import { RecentChangesMap } from "@/components/RecentChangesMap";
import { MarqueeTrajectory } from "@/components/MarqueeTrajectory";
import { IncumbentTracker } from "@/components/IncumbentTracker";
import { LeaderFlipMap } from "@/components/LeaderFlipMap";

export default function BroadcastPage() {
  return (
    <Suspense fallback={null}>
      <BroadcastInner />
    </Suspense>
  );
}

function BroadcastInner() {
  const params = useSearchParams();
  const sceneParamRaw = params.get("scene");
  const cameraParam = params.get("camera");

  // Scene: ?scene= wins; else localStorage; else "hero". Stays in sync
  // with the backstage admin tab via storage events.
  const [scene, setScene] = useState<SceneId>(() => {
    if (sceneParamRaw && isValidScene(sceneParamRaw)) return sceneParamRaw;
    return "hero";
  });
  useEffect(() => {
    if (sceneParamRaw && isValidScene(sceneParamRaw)) {
      setScene(sceneParamRaw);
      return;
    }
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("tn-broadcast-scene")
        : null;
    if (stored && isValidScene(stored)) setScene(stored);
    function onStorage(e: StorageEvent) {
      if (e.key === "tn-broadcast-scene" && e.newValue && isValidScene(e.newValue)) {
        setScene(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sceneParamRaw]);
  // ?live=1 → hides operator chrome (scene switcher, camera picker, backstage
  // links). The dashboard renders only the persistent chrome bands + scene.
  // This is the URL the OBS browser source points at on counting day; the
  // operator keeps a separate /broadcast/admin tab open to drive things.
  const liveMode = params.get("live") === "1";
  const { state, connected, constituencies, slots } = useLiveData();
  const { t } = useLocale();

  // Camera count: 0..6. ?camera=N wins; else localStorage; else 0.
  const [cameraCount, setCameraCount] = useState<number>(0);
  useEffect(() => {
    if (cameraParam != null) {
      const n = parseInt(cameraParam, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) {
        setCameraCount(n);
        return;
      }
      if (cameraParam === "off") {
        setCameraCount(0);
        return;
      }
      if (cameraParam === "on") {
        setCameraCount(1);
        return;
      }
    }
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("tn-broadcast-camera")
        : null;
    if (stored != null) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) setCameraCount(n);
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "tn-broadcast-camera" && e.newValue != null) {
        const n = parseInt(e.newValue, 10);
        if (!Number.isNaN(n) && n >= 0 && n <= 6) setCameraCount(n);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cameraParam]);

  const setCount = (n: number) => {
    setCameraCount(n);
    localStorage.setItem("tn-broadcast-camera", String(n));
  };

  const sceneCfg = SCENE_BY_ID.get(scene);
  const cameraLayout = sceneCfg?.cameraLayout ?? "off";
  const cameraOn = cameraCount > 0;

  useEffect(() => {
    document.body.classList.add("broadcast");
    return () => document.body.classList.remove("broadcast");
  }, []);

  if (!state) {
    return (
      <div className="fixed inset-0 grid place-items-center text-[var(--text-muted)]">
        Connecting to live feed…
      </div>
    );
  }

  return (
    <>
      <CommandPalette />
      <ChyronOverlay />
      <div
        className="fixed inset-0 grid grid-cols-1 bg-gradient-to-br from-[#04081a] via-[#08102a] to-[#04081a] text-white"
        style={{
          // Live (OBS): no operator chrome. Backstage: extra top row for the
          // scene switcher + camera picker, and an extra bottom row for the
          // backstage links.
          //
          // The hero scene's 4 leader cards already display the per-bloc
          // headline numbers; an additional alliance-totals strip above them
          // is pure repeat. Drop the 56px alliance row in hero scene and
          // hand it to the cards instead — they need it in top-strip camera
          // mode where the bottom W/L plate would otherwise clip.
          gridTemplateRows: liveMode
            ? scene === "hero"
              ? "28px 1fr 36px"
              : "28px 56px 1fr 36px"
            : scene === "hero"
              ? "32px 28px 1fr 36px auto"
              : "32px 28px 56px 1fr 36px auto",
        }}
      >
        {/* Backstage operator row — scene switcher + camera picker.
            Only renders in non-live mode. Sits ABOVE the persistent chrome
            so it never covers alliance totals. */}
        {!liveMode && (
          <div className="flex items-center justify-center gap-2 px-3 bg-black/55 border-b border-white/10">
            <SceneSwitcher current={scene} variant="compact" />
            <span className="w-px h-5 bg-white/15" />
            <BackstageCameraPicker count={cameraCount} onChange={setCount} />
            <span className="w-px h-5 bg-white/15" />
            <a
              href="/broadcast/multi-state"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/35 hover:border-indigo-400 transition-colors whitespace-nowrap"
              title="Open the national multi-state broadcast view"
            >
              🌐 Multi-State
            </a>
          </div>
        )}
        {/* ── Band 1: Status strip (28px) ─────────────────── */}
        <BroadcastTopStrip liveMode={liveMode} connected={connected} />

        {/* ── Band 2: Alliance Totals (56px) ─────────────────
            The headline numbers — SPA · NDA · TVK · NTK with ticking
            counters and path-to-majority bars. Skipped on the hero scene
            because the 4 leader cards already carry these same totals. */}
        {scene !== "hero" && (
          <div className="bg-gradient-to-b from-black/35 to-transparent border-b border-white/5">
            <AllianceTotalsStrip />
          </div>
        )}

        {/* ── Band 3: Scene + camera frame (1fr) ─────────── */}
        <div className="overflow-hidden relative min-h-0">
          {cameraOn && cameraLayout !== "off" ? (
            <CameraFrameWrapper layout={cameraLayout} cameraCount={cameraCount} slots={slots}>
              <SceneRenderer scene={scene} />
            </CameraFrameWrapper>
          ) : (
            <SceneRenderer scene={scene} />
          )}
        </div>

        {/* ── Band 4: Breaking-news ticker (36px) ────────── */}
        <div className="overflow-hidden">
          <LiveTicker constituencies={constituencies} />
        </div>

        {/* Backstage strip — only when not in OBS live mode.
            Two rows:
              - Top: stats + Backstage / OBS URL / National / Cmd-K hint
              - Bottom: one-click scene pill buttons (Cmd-K alternative)
        */}
        {!liveMode && (
          <div className="bg-black/50 border-t border-white/10 px-3 py-1.5 flex flex-col gap-1.5 text-[10px]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-white/55 uppercase tracking-widest">
                <span>
                  <span className="text-[var(--accent-won)] font-bold">{state.declared}</span>{" "}
                  {t("label.declared")}
                </span>
                <span>
                  <span className="text-[var(--accent-counting)] font-bold">{state.counting}</span>{" "}
                  {t("label.counting")}
                </span>
                <span>
                  <span className="text-white/70 font-bold">{state.pending}</span>{" "}
                  {t("label.awaited")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/broadcast/admin"
                  className="font-bold uppercase tracking-[0.25em] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  title="Open the backstage control room"
                >
                  🎛 Backstage ↗
                </a>
                <a
                  href={`/broadcast?scene=${scene}&camera=${cameraCount}&live=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold uppercase tracking-[0.25em] px-2 py-0.5 rounded bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 transition-colors"
                  title="Clean URL for OBS browser source"
                >
                  🎬 OBS URL ↗
                </a>
                <a
                  href="/broadcast/multi-state"
                  className="font-bold uppercase tracking-[0.25em] px-2 py-0.5 rounded border border-white/15 text-white/70 hover:border-white/40 hover:text-white transition-colors"
                >
                  National ↗
                </a>
                <span className="font-mono text-white/45">{t("help.cmdK")}</span>
              </div>
            </div>
            {/* Scene pill row — one-click jump to any scene without Cmd-K */}
            <FooterSceneRow current={scene} />
          </div>
        )}
      </div>

    </>
  );
}

function SceneRenderer({ scene }: { scene: SceneId }) {
  switch (scene) {
    case "hero":
      return <BroadcastHero />;
    case "leaders":
      return <BroadcastLeaderBoard />;
    case "swing":
      return <Swingometer variant="scene" />;
    case "swingmap":
      return <TnMapCompare variant="scene" />;
    case "vips":
      return <VipTracker variant="scene" />;
    case "closest":
      return <CloseRaces variant="scene" />;
    case "upsets":
      return <Upsets variant="scene" />;
    case "bellwether":
      return <BellwetherStrip variant="scene" />;
    case "ticker":
      return <BroadcastTicker />;
    case "projection":
      return <ProjectionCard variant="scene" />;
    case "knife":
      return <KnifeEdge variant="scene" limit={20} />;
    case "regions":
      return <RegionalTally />;
    case "majority-timer":
      return <MajorityTimer />;
    case "recent-map":
      return <RecentChangesMap variant="scene" />;
    case "trajectory":
      return <MarqueeTrajectory variant="scene" />;
    case "incumbents":
      return <IncumbentTracker variant="scene" />;
    case "flips":
      return <LeaderFlipMap variant="scene" />;
    case "single-ac":
      return (
        <div className="card p-12 text-center">
          <div className="text-2xl">Use Cmd+K to pick a constituency for single-AC focus.</div>
          <div className="text-sm text-[var(--text-muted)] mt-2">
            Or visit /broadcast/ac/&lt;id&gt;
          </div>
        </div>
      );
    default:
      return <BroadcastHero />;
  }
}

function BackstageCameraPicker({
  count,
  onChange,
}: {
  count: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mr-0.5">
        📷
      </span>
      {[0, 1, 2, 3, 4].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={
            "text-[11px] font-bold tabular px-1.5 py-0.5 rounded transition-colors " +
            (count === n
              ? "bg-[var(--accent-counting)] text-black"
              : "text-white/60 hover:text-white hover:bg-white/10")
          }
          title={n === 0 ? "Camera off" : `${n} camera${n === 1 ? "" : "s"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Footer scene-jump row — one-click to any of the broadcast scenes
 *  without needing Cmd-K. Updates localStorage so the live OBS tab
 *  picks up the change via the storage event (~50 ms). */
function FooterSceneRow({ current }: { current: SceneId }) {
  const { tScene } = useLocale();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mr-1">
        Scene:
      </span>
      {SCENES.map((s) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.setItem("tn-broadcast-scene", s.id);
              }
              const url = new URL(window.location.href);
              url.searchParams.set("scene", s.id);
              window.history.replaceState({}, "", url.toString());
              // Force re-render via reload — simplest path that updates
              // every consumer (live OBS tab will pick up the storage event).
              window.location.reload();
            }}
            className={
              "font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors text-[10px] " +
              (active
                ? "bg-[var(--accent-counting)] text-black"
                : "text-white/55 hover:bg-white/10 hover:text-white border border-white/8")
            }
            title={s.description}
          >
            <span className="font-mono text-[8px] opacity-60 mr-0.5">⌥{s.hotkey}</span>
            {tScene(s.id) || s.label}
          </button>
        );
      })}
    </div>
  );
}
