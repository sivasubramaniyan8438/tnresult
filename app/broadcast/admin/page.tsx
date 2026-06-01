"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SCENES, isValidScene, SCENE_BY_ID, type SceneId } from "@/lib/scenes";
import { detectSourceType } from "@/lib/broadcast-source";
import type { BroadcastSlot, BroadcastSlotPreset } from "@/lib/broadcast-slots";
import { MAX_SLOTS } from "@/lib/broadcast-slots";
import { useTenant } from "@/components/TenantProvider";

/**
 * Backstage control room for the broadcast.
 *
 *   /broadcast/admin    →  this page (operator-facing controls + preview)
 *   /broadcast?live=1   →  the clean URL the OBS browser source captures
 *
 * The two tabs sync via localStorage (`tn-broadcast-camera`,
 * `tn-broadcast-scene`). A change here propagates to the live tab
 * within ~50 ms via the `storage` event — no refresh needed.
 */
export default function BroadcastAdminPage() {
  const [scene, setScene] = useState<SceneId>("hero");
  const [cameraCount, setCameraCount] = useState<number>(0);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const storedScene = localStorage.getItem("tn-broadcast-scene");
    if (storedScene && isValidScene(storedScene)) setScene(storedScene);
    const storedCam = localStorage.getItem("tn-broadcast-camera");
    if (storedCam) {
      const n = parseInt(storedCam, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) setCameraCount(n);
    }
  }, []);

  const updateScene = (id: SceneId) => {
    setScene(id);
    localStorage.setItem("tn-broadcast-scene", id);
    // Also broadcast a synthetic storage event for same-tab listeners
  };
  const updateCount = (n: number) => {
    setCameraCount(n);
    localStorage.setItem("tn-broadcast-camera", String(n));
  };

  // OBS URL: includes scene + camera so the operator can paste it once
  const obsUrl = useMemo(
    () => `${origin}/broadcast?scene=${scene}&camera=${cameraCount}&live=1`,
    [origin, scene, cameraCount],
  );

  const previewUrl = `/broadcast?scene=${scene}&camera=${cameraCount}&live=1`;
  const sceneCfg = SCENE_BY_ID.get(scene);

  return (
    <div className="space-y-4 max-w-6xl mx-auto py-2">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Broadcast control room
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">Backstage</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-prose">
            Drive the live broadcast from here. Pick a scene + camera count;
            the preview below mirrors exactly what your OBS browser source
            (top-right URL) shows. Changes sync within ~50ms.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/broadcast"
            target="_blank"
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border border-white/15 text-white/70 hover:text-white transition"
          >
            Open backstage view ↗
          </Link>
          <Link
            href={previewUrl}
            target="_blank"
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 transition"
          >
            🎬 Open live URL ↗
          </Link>
          <Link
            href="/admin/states"
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            Other states →
          </Link>
        </div>
      </header>

      {/* OBS URL row — copy-able, pre-filled with current scene + cam */}
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-red-400 shrink-0">
          🎬 OBS URL
        </span>
        <code className="flex-1 min-w-[200px] text-xs font-mono bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 truncate select-all">
          {obsUrl}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(obsUrl);
          }}
          className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-counting)] text-black hover:brightness-110 transition"
        >
          📋 Copy
        </button>
        <a
          href="#camera-sources"
          className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-indigo-500/25 border border-indigo-400/50 text-indigo-200 hover:bg-indigo-500/40"
        >
          📺 Camera sources ↓
        </a>
      </div>

      {/* Slot mixer — feed video URLs (YouTube / HLS / etc.) into camera tiles.
          Lifted above the preview pane so operators don't have to scroll
          past a 1080p iframe to find it. */}
      <SlotMixer activeSlots={cameraCount} />

      {/* Two-pane: controls on left, live preview on right */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        {/* Controls */}
        <div className="space-y-3">
          <div className="card p-3">
            <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-[var(--text-muted)] mb-2">
              Scene
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SCENES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => updateScene(s.id)}
                  className={
                    "px-2 py-2 rounded text-xs font-bold uppercase tracking-wider text-left transition " +
                    (scene === s.id
                      ? "bg-[var(--accent-lead)] text-black"
                      : "bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]")
                  }
                  title={s.description}
                >
                  <span className="font-mono text-[9px] opacity-70 mr-1">
                    ⌥{s.hotkey}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
            {sceneCfg && (
              <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                Layout when camera is on:{" "}
                <span className="font-mono text-[var(--accent-counting)]">
                  {sceneCfg.cameraLayout}
                </span>
              </div>
            )}
          </div>

          <div className="card p-3">
            <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-[var(--text-muted)] mb-2">
              Cameras on screen
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateCount(n)}
                  className={
                    "py-2 rounded text-base font-black tabular transition " +
                    (cameraCount === n
                      ? "bg-[var(--accent-counting)] text-black"
                      : "bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]")
                  }
                  title={n === 0 ? "Camera off" : `${n} camera${n === 1 ? "" : "s"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
              Camera-area rectangles tile automatically — 1 = single PIP,
              2 = side-by-side, 3 = row of three, 4 = 2×2 grid, etc.
            </div>
          </div>

          <div className="card p-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
            <div className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] mb-1.5">
              Operator workflow
            </div>
            <ol className="list-decimal list-inside space-y-1">
              <li>Pick scene + camera count here.</li>
              <li>Copy the OBS URL above.</li>
              <li>
                Paste into OBS &gt; Sources &gt; Browser source. Resolution
                1920×1080.
              </li>
              <li>
                Place anchor video sources in OBS over the camera-area
                rectangles in the dashboard.
              </li>
              <li>
                Change scene/cameras here — the live URL updates within
                ~50ms.
              </li>
            </ol>
          </div>
        </div>

        {/* Live preview iframe — shows exactly what OBS sees */}
        <div className="card p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
            <span className="font-bold">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 align-middle animate-pulse" />
              Live preview · 1920×1080 view
            </span>
            <span className="font-mono text-[9px]">
              scene={scene} · camera={cameraCount}
            </span>
          </div>
          <div className="relative border border-white/10 rounded overflow-hidden bg-black">
            <iframe
              src={previewUrl}
              title="Live broadcast preview"
              className="block w-full"
              style={{ aspectRatio: "16 / 9", minHeight: 360 }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Slot mixer — feed a YouTube / Twitch / HLS / MP4 / iframe URL into
   a particular camera tile. Empty URL = transparent (OBS overlay mode).
   Audio defaults muted; "AUDIO LIVE" indicator + panic-mute prevent
   accidental on-air audio routing through the browser.
   ──────────────────────────────────────────────────────────────────── */

function SlotMixer({ activeSlots }: { activeSlots: number }) {
  const tenant = useTenant();
  const [slots, setSlots] = useState<BroadcastSlot[]>([]);
  const [presets, setPresets] = useState<BroadcastSlotPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/broadcast/slots");
      const j = await r.json();
      if (Array.isArray(j.slots)) setSlots(j.slots);
      if (Array.isArray(j.presets)) setPresets(j.presets);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const anyAudio = slots.some((s) => s.sourceUrl && !s.muted);

  return (
    <div className="card p-3 space-y-3" id="camera-sources">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-red-400 font-bold">
            🎥 Slot mixer · live streaming sources
          </div>
          <h2 className="text-lg font-black flex items-baseline gap-2 flex-wrap">
            Camera sources
            <span
              className="text-[10px] uppercase tracking-[0.25em] px-2 py-0.5 rounded font-bold"
              style={{
                background: `${tenant.channelAccent}25`,
                color: tenant.channelAccent,
                border: `1px solid ${tenant.channelAccent}55`,
              }}
              title="Slot mixer is scoped to this tenant — Aadhan and Naadhas have independent feeds"
            >
              {tenant.channelName}
            </span>
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-prose">
            Feed a YouTube / Twitch / HLS / MP4 / iframe URL into a particular
            camera tile. Empty URL = the tile stays transparent and OBS
            overlays your anchor video as before. Audio defaults muted —
            mix sound in OBS or your audio mixer for safety. <strong>Slots,
            presets and mute state are scoped to {tenant.channelName} —
            other tenants run their own independent mixer.</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anyAudio && (
            <span
              className="px-2 py-1 rounded bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider animate-pulse"
              title="One or more slots are unmuted — browser is contributing audio to the broadcast"
            >
              🔊 Audio live
            </span>
          )}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/broadcast/slots", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "muteAll" }),
              });
              refresh();
            }}
            className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600/30 border border-red-500/50 text-red-200 hover:bg-red-600/50"
            title="Mute every slot — emergency"
          >
            🔇 Mute all
          </button>
        </div>
      </div>

      <PresetEditor
        presets={presets}
        onChange={refresh}
      />

      {loading ? (
        <div className="text-xs text-[var(--text-muted)]">Loading slots…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {slots.map((slot) => (
            <SlotEditor
              key={slot.slotIndex}
              slot={slot}
              presets={presets}
              activeOnAir={slot.slotIndex < activeSlots}
              onChange={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotEditor({
  slot,
  presets,
  activeOnAir,
  onChange,
}: {
  slot: BroadcastSlot;
  presets: BroadcastSlotPreset[];
  activeOnAir: boolean;
  onChange: () => void;
}) {
  const [url, setUrl] = useState(slot.sourceUrl);
  const [label, setLabel] = useState(slot.label);
  const [muted, setMuted] = useState(slot.muted);
  const [fit, setFit] = useState<"cover" | "contain">(slot.fit);
  const [busy, setBusy] = useState(false);

  // Resync when polled state arrives
  useEffect(() => setUrl(slot.sourceUrl), [slot.sourceUrl]);
  useEffect(() => setLabel(slot.label), [slot.label]);
  useEffect(() => setMuted(slot.muted), [slot.muted]);
  useEffect(() => setFit(slot.fit), [slot.fit]);

  const detectedType = detectSourceType(url) || "—";
  const dirty =
    url !== slot.sourceUrl ||
    label !== slot.label ||
    muted !== slot.muted ||
    fit !== slot.fit;

  async function save() {
    setBusy(true);
    await fetch("/api/admin/broadcast/slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slotIndex: slot.slotIndex,
        sourceUrl: url,
        label,
        muted,
        fit,
      }),
    });
    setBusy(false);
    onChange();
  }

  async function clear() {
    setBusy(true);
    await fetch(`/api/admin/broadcast/slots?slotIndex=${slot.slotIndex}`, {
      method: "DELETE",
    });
    setBusy(false);
    onChange();
  }

  async function solo() {
    setBusy(true);
    await fetch("/api/admin/broadcast/slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "solo", slotIndex: slot.slotIndex }),
    });
    setBusy(false);
    onChange();
  }

  return (
    <div
      className={
        "rounded-lg border p-2.5 space-y-2 " +
        (activeOnAir
          ? "border-red-500/45 bg-red-950/15"
          : "border-white/10 bg-black/25")
      }
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black">
            Cam {slot.slotIndex + 1}
          </span>
          <span className="font-mono text-white/45">{detectedType}</span>
          {!activeOnAir && (
            <span className="text-white/35">(off-air — bump camera count)</span>
          )}
          {!slot.muted && slot.sourceUrl && (
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black animate-pulse">
              🔊 Audio
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {presets.length > 0 && (
            <select
              className="text-[10px] bg-[var(--bg-base)] border border-[var(--border)] rounded px-1 py-0.5"
              value=""
              onChange={(e) => {
                const p = presets.find((x) => String(x.id) === e.target.value);
                if (!p) return;
                setUrl(p.sourceUrl);
                setLabel(p.label);
                setMuted(p.muted);
              }}
            >
              <option value="">Preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste YouTube / Twitch / .m3u8 / .mp4 URL …"
        className="w-full text-xs px-2 py-1.5 rounded bg-[var(--bg-base)] border border-[var(--border)] font-mono"
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Slot label (e.g. Studio A)"
          className="flex-1 min-w-[140px] px-2 py-1 rounded bg-[var(--bg-base)] border border-[var(--border)]"
        />
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={muted}
            onChange={(e) => setMuted(e.target.checked)}
          />
          <span className="font-bold">Muted</span>
        </label>
        <label className="flex items-center gap-1">
          <span>Fit:</span>
          <select
            value={fit}
            onChange={(e) => setFit(e.target.value as "cover" | "contain")}
            className="bg-[var(--bg-base)] border border-[var(--border)] rounded px-1 py-0.5"
          >
            <option value="cover">cover</option>
            <option value="contain">contain</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-counting)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        >
          {busy ? "Saving…" : dirty ? "Save & broadcast" : "Saved"}
        </button>
        <button
          type="button"
          disabled={!slot.sourceUrl || busy}
          onClick={clear}
          className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={!slot.sourceUrl || busy}
          onClick={solo}
          title="Unmute this slot, mute every other slot"
          className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Solo audio
        </button>
      </div>
    </div>
  );
}

function PresetEditor({
  presets,
  onChange,
}: {
  presets: BroadcastSlotPreset[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!label.trim() || !url.trim()) return;
    setBusy(true);
    await fetch("/api/admin/broadcast/presets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim(), sourceUrl: url.trim() }),
    });
    setLabel("");
    setUrl("");
    setBusy(false);
    onChange();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/broadcast/presets?id=${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-2 text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] uppercase tracking-wider font-bold text-white/65 hover:text-white"
      >
        {open ? "▾" : "▸"} Saved presets ({presets.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 rounded bg-white/8 border border-white/15 flex items-center gap-1.5"
                  title={p.sourceUrl}
                >
                  <span className="font-bold">{p.label}</span>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-white/45 hover:text-red-300"
                    aria-label="Delete preset"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Aadhan main YT)"
              className="flex-1 min-w-[140px] px-2 py-1 rounded bg-[var(--bg-base)] border border-[var(--border)]"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL"
              className="flex-1 min-w-[180px] px-2 py-1 rounded bg-[var(--bg-base)] border border-[var(--border)] font-mono"
            />
            <button
              type="button"
              disabled={busy || !label.trim() || !url.trim()}
              onClick={add}
              className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-counting)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
            >
              Save preset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
