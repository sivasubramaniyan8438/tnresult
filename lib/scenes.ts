export type SceneId =
  | "hero"
  | "leaders"
  | "swing"
  | "swingmap"
  | "single-ac"
  | "vips"
  | "closest"
  | "upsets"
  | "bellwether"
  | "ticker"
  | "projection"
  | "knife"
  | "regions"
  | "majority-timer"
  | "recent-map"
  | "trajectory"
  | "incumbents"
  | "flips";

/**
 * Camera-frame layout per scene. Picks WHERE the scene shrinks to so the
 * remaining area is transparent for the OBS anchor video.
 *
 *   "top-strip"     — scene becomes a top horizontal band; camera fills below.
 *                     Good for tile-style scenes (hero, projection).
 *   "left-bar"      — scene becomes a narrow left column; camera fills right.
 *   "right-bar"     — scene becomes a narrow right column; camera fills left.
 *   "l-shape"       — scene wraps top + right; camera in bottom-left.
 *   "pip-tr"        — scene shrinks to a small picture-in-picture in top-right.
 *                     Camera is the focus, scene is the inset.
 *   "camera-pip-br" — opposite: scene fills the canvas, camera is a small
 *                     picture-in-picture in the BOTTOM-RIGHT. Good for maps
 *                     where the visualisation is the story and the anchor
 *                     just needs presence.
 *   "camera-pip-tr" — same idea, camera PIP in TOP-RIGHT corner.
 *   "off"           — scene fills the canvas. Camera mode disabled.
 */
export type CameraLayout =
  | "top-strip"
  | "left-bar"
  | "right-bar"
  | "right-pane"
  | "l-shape"
  | "pip-tr"
  | "camera-pip-br"
  | "camera-pip-tr"
  | "off";

/**
 * Chrome style for the broadcast scene:
 *   "full"     — big top banner with Naadhas + ProxyN + stats strip + scene
 *                switcher. Used by most scenes.
 *   "minimal"  — banner replaced with small floating brand chips in the
 *                corners so the scene gets the full viewport. Used by
 *                map-centric scenes where vertical real-estate matters.
 */
export type SceneChrome = "full" | "minimal";

export type SceneConfig = {
  id: SceneId;
  hotkey: string;
  label: string;
  description: string;
  cameraLayout: CameraLayout;
  chrome?: SceneChrome; // default "full"
};

// All scenes use chrome: "minimal" — the big top banner ate ~150px of 1080p
// vertical space and made hero/VIPs/projection cards clip in top-strip camera
// mode. The brand stays on screen via the four floating corner chips that
// MinimalChromeOverlay draws (Naadhas top-left, LIVE+clock top-right,
// ProxyN.ai bottom-left, stats bottom-right).
export const SCENES: SceneConfig[] = [
  { id: "hero",       hotkey: "1", label: "Hero",         description: "Top 4 leader cards",     cameraLayout: "top-strip",      chrome: "minimal" },
  { id: "projection", hotkey: "2", label: "Projection",   description: "If pattern holds",        cameraLayout: "top-strip",      chrome: "minimal" },
  { id: "leaders",    hotkey: "3", label: "Leaderboard",  description: "Top parties + alliances", cameraLayout: "right-bar",      chrome: "minimal" },
  { id: "swing",      hotkey: "4", label: "Swingometer",  description: "Vote-swing arc",          cameraLayout: "left-bar",       chrome: "minimal" },
  { id: "swingmap",   hotkey: "5", label: "Swing Map",    description: "234-AC hex grid",         cameraLayout: "right-pane",     chrome: "minimal" },
  { id: "vips",       hotkey: "6", label: "VIPs",         description: "Marquee races",           cameraLayout: "top-strip",      chrome: "minimal" },
  { id: "closest",    hotkey: "7", label: "Closest",      description: "Tightest margins",        cameraLayout: "right-bar",      chrome: "minimal" },
  { id: "upsets",     hotkey: "8", label: "Upsets",       description: "Biggest swings",          cameraLayout: "right-bar",      chrome: "minimal" },
  { id: "bellwether", hotkey: "9", label: "Bellwether",   description: "Historical predictors",   cameraLayout: "right-bar",      chrome: "minimal" },
  { id: "ticker",        hotkey: "0", label: "Ticker",       description: "Full-screen marquee",                  cameraLayout: "off",        chrome: "minimal" },
  { id: "single-ac",     hotkey: "S", label: "Single AC",    description: "One constituency deep",                cameraLayout: "off",        chrome: "minimal" },
  { id: "knife",         hotkey: "K", label: "Knife edge",   description: "Razor / knife / watch margins",        cameraLayout: "right-bar",  chrome: "minimal" },
  { id: "regions",       hotkey: "R", label: "Regional",     description: "North / Kongu / Delta / South tally",  cameraLayout: "off",        chrome: "minimal" },
  { id: "majority-timer",hotkey: "T", label: "Majority ETA", description: "Time-to-118 projection",               cameraLayout: "top-strip",  chrome: "minimal" },
  { id: "recent-map",    hotkey: "L", label: "Last rounds",  description: "TN map highlighting freshly-updated ACs", cameraLayout: "right-pane", chrome: "minimal" },
  { id: "trajectory",    hotkey: "J", label: "Trajectory",   description: "Round-by-round chart for marquee races",  cameraLayout: "right-bar",  chrome: "minimal" },
  { id: "incumbents",    hotkey: "I", label: "Incumbents",   description: "Retained / ousted / flipped vs 2021",     cameraLayout: "off",        chrome: "minimal" },
  { id: "flips",         hotkey: "F", label: "Leader flips", description: "ACs whose leading bloc changed in last 10 min", cameraLayout: "right-pane", chrome: "minimal" },
];

export const SCENE_BY_HOTKEY = new Map(SCENES.map((s) => [s.hotkey, s.id]));
export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]));

export function isValidScene(id: string): id is SceneId {
  return SCENE_BY_ID.has(id as SceneId);
}
