/**
 * URL → embeddable broadcast source classifier.
 *
 * Operators paste arbitrary URLs in the admin UI; we want one place that
 * decides "this is a YouTube live, embed it via youtube-nocookie with
 * autoplay+mute" vs "this is an HLS .m3u8, render via <video>+hls.js".
 *
 * The browser cannot play RTMP or unsigned WebRTC, so we deliberately don't
 * try to handle those — they need a media server upstream.
 */
export type SourceType = "youtube" | "twitch" | "hls" | "mp4" | "iframe" | "";

export type ParsedSource = {
  type: SourceType;
  /** Embeddable URL ready to drop into iframe.src or video.src.
   *  For YouTube/Twitch, embed-specific params are baked in. */
  embedUrl: string;
  /** Internal id when relevant — youtube videoId, twitch channel name, etc. */
  ref?: string;
  /** Whether the source supports runtime mute toggle without reload. */
  supportsMuteToggle: boolean;
};

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
]);

const TWITCH_HOSTS = new Set(["twitch.tv", "www.twitch.tv", "m.twitch.tv"]);

function safeUrl(input: string): URL | null {
  try {
    return new URL(input.trim());
  } catch {
    return null;
  }
}

function extractYouTubeId(u: URL): string | null {
  // youtu.be/<id>
  if (u.hostname === "youtu.be") {
    const id = u.pathname.replace(/^\/+/, "").split("/")[0];
    return id || null;
  }
  // youtube.com/watch?v=<id>
  const v = u.searchParams.get("v");
  if (v) return v;
  // youtube.com/embed/<id>, /live/<id>, /shorts/<id>
  const m = u.pathname.match(/\/(embed|live|shorts)\/([A-Za-z0-9_-]{6,})/);
  if (m) return m[2];
  return null;
}

function extractTwitchChannel(u: URL): string | null {
  // twitch.tv/<channel>
  const seg = u.pathname.replace(/^\/+/, "").split("/")[0];
  if (!seg) return null;
  if (["videos", "directory", "p", "downloads"].includes(seg)) return null;
  return seg;
}

/**
 * Parse a URL and return the embeddable form. `parentDomain` is required
 * for Twitch's `parent=` param — pass the broadcast page's hostname.
 *
 * Returns `{type:"", embedUrl:""}` for empty/invalid input so callers can
 * treat "no source" as a first-class state.
 */
export function parseSource(
  url: string,
  opts: { muted?: boolean; parentDomain?: string } = {},
): ParsedSource {
  const muted = opts.muted ?? true;
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return { type: "", embedUrl: "", supportsMuteToggle: false };
  }

  const u = safeUrl(trimmed);
  if (!u) {
    return { type: "", embedUrl: "", supportsMuteToggle: false };
  }

  if (YT_HOSTS.has(u.hostname)) {
    const id = extractYouTubeId(u);
    if (id) {
      const params = new URLSearchParams({
        autoplay: "1",
        mute: muted ? "1" : "0",
        controls: "0",
        modestbranding: "1",
        rel: "0",
        playsinline: "1",
        enablejsapi: "1",
        // suppress related/end-screen junk + give us an origin so the
        // postMessage API works for runtime mute toggling
        iv_load_policy: "3",
      });
      if (opts.parentDomain) params.set("origin", `https://${opts.parentDomain}`);
      return {
        type: "youtube",
        ref: id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${params}`,
        supportsMuteToggle: true,
      };
    }
  }

  if (TWITCH_HOSTS.has(u.hostname)) {
    const channel = extractTwitchChannel(u);
    if (channel) {
      const parent = opts.parentDomain ?? "localhost";
      const params = new URLSearchParams({
        channel,
        parent,
        autoplay: "true",
        muted: muted ? "true" : "false",
      });
      return {
        type: "twitch",
        ref: channel,
        embedUrl: `https://player.twitch.tv/?${params}`,
        supportsMuteToggle: true,
      };
    }
  }

  // .m3u8 → HLS, played via <video> + hls.js (or native on Safari)
  if (/\.m3u8($|\?)/i.test(u.pathname + u.search)) {
    return { type: "hls", embedUrl: u.toString(), supportsMuteToggle: true };
  }

  // direct video file
  if (/\.(mp4|webm|mov|m4v)($|\?)/i.test(u.pathname + u.search)) {
    return { type: "mp4", embedUrl: u.toString(), supportsMuteToggle: true };
  }

  // Generic — fall through to a sandboxed iframe. Mute toggle isn't
  // possible without same-origin postMessage cooperation.
  return { type: "iframe", embedUrl: u.toString(), supportsMuteToggle: false };
}

export function detectSourceType(url: string): SourceType {
  return parseSource(url).type;
}
