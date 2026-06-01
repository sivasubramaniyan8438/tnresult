"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseSource } from "@/lib/broadcast-source";
import type { BroadcastSlot } from "@/lib/broadcast-slots";

/**
 * Renders the live streaming source for one camera slot, choosing the
 * right embed (YouTube iframe / Twitch iframe / HLS video / MP4 video /
 * sandboxed iframe) based on the URL.
 *
 * If the URL is empty or unparseable we render `fallback` (the bracket
 * camera-area hint), which preserves the existing OBS-overlay workflow.
 */
export function SlotPlayer({
  slot,
  fallback,
  index,
}: {
  slot: BroadcastSlot;
  fallback: React.ReactNode;
  index: number;
}) {
  const [parentDomain, setParentDomain] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") setParentDomain(window.location.hostname);
  }, []);

  const parsed = useMemo(
    () => parseSource(slot.sourceUrl, { muted: slot.muted, parentDomain }),
    [slot.sourceUrl, slot.muted, parentDomain],
  );

  if (!parsed.type) return <>{fallback}</>;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black rounded-md">
      {parsed.type === "youtube" && <YouTubeFrame src={parsed.embedUrl} />}
      {parsed.type === "twitch" && <PlainIframe src={parsed.embedUrl} allow="autoplay; fullscreen" />}
      {parsed.type === "hls" && <HlsVideo src={parsed.embedUrl} muted={slot.muted} volume={slot.volume} fit={slot.fit} />}
      {parsed.type === "mp4" && <PlainVideo src={parsed.embedUrl} muted={slot.muted} volume={slot.volume} fit={slot.fit} />}
      {parsed.type === "iframe" && <PlainIframe src={parsed.embedUrl} sandboxed />}

      {/* Slot label overlay — small, bottom-left */}
      {slot.label && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold uppercase tracking-wider pointer-events-none">
          {slot.label}
        </div>
      )}
      {/* Index badge (top-left) so operators can tell slot 1 from slot 2 */}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-red-600/85 text-white text-[10px] font-black tabular pointer-events-none shadow">
        {index + 1}
      </div>
      {/* Audio indicator — visible on the broadcast itself when unmuted, so
          producer can see at a glance that this slot is contributing audio */}
      {!slot.muted && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider pointer-events-none shadow animate-pulse">
          🔊 Audio
        </div>
      )}
    </div>
  );
}

function YouTubeFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      title="Broadcast slot"
      className="w-full h-full"
      style={{ border: 0 }}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      // referrerpolicy makes YouTube less likely to block embedded play
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function PlainIframe({
  src,
  sandboxed,
  allow,
}: {
  src: string;
  sandboxed?: boolean;
  allow?: string;
}) {
  return (
    <iframe
      src={src}
      title="Broadcast slot"
      className="w-full h-full"
      style={{ border: 0 }}
      sandbox={sandboxed ? "allow-scripts allow-same-origin allow-presentation" : undefined}
      allow={allow ?? "autoplay; encrypted-media; picture-in-picture; fullscreen"}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function PlainVideo({
  src,
  muted,
  volume,
  fit,
}: {
  src: string;
  muted: boolean;
  volume: number;
  fit: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);
  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted={muted}
      playsInline
      controls={false}
      className="w-full h-full"
      style={{ objectFit: fit, background: "black" }}
    />
  );
}

/**
 * HLS playback. Native in Safari; in Chrome/Edge/Firefox/OBS-browser-source we
 * load hls.js lazily on first use. Lazy import keeps the main bundle small for
 * the (common) case where no slot is using HLS.
 */
function HlsVideo({
  src,
  muted,
  volume,
  fit,
}: {
  src: string;
  muted: boolean;
  volume: number;
  fit: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    let destroyed = false;
    const video = ref.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let hls: { destroy: () => void } | null = null;
    (async () => {
      try {
        const mod = await import(/* webpackChunkName: "hls" */ "hls.js");
        const Hls = mod.default;
        if (destroyed) return;
        if (!Hls.isSupported()) {
          setError("HLS unsupported in this browser");
          return;
        }
        const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
        instance.loadSource(src);
        instance.attachMedia(video);
        hls = instance;
      } catch {
        setError("Failed to load HLS player");
      }
    })();

    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [src]);

  if (error) {
    return (
      <div className="w-full h-full grid place-items-center text-red-300 text-xs uppercase tracking-wider">
        {error}
      </div>
    );
  }

  return (
    <video
      ref={ref}
      autoPlay
      muted={muted}
      playsInline
      controls={false}
      className="w-full h-full"
      style={{ objectFit: fit, background: "black" }}
    />
  );
}
