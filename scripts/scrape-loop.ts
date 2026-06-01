/**
 * Long-running scraper. Runs on the DigitalOcean Bangalore droplet (or any
 * India-hosted box) and writes results to the dashboard.
 *
 * Three write modes:
 *   - DUAL    (set WRITE_API_URLS=url1,url2): POSTs to BOTH targets in
 *             parallel. Use to fan-out counting-day data to AWS primary
 *             AND Railway warm standby so a failover is zero-data-lag.
 *             Same Idempotency-Key sent to both → no double-counting.
 *             A scrape is "ok" as long as AT LEAST ONE target accepts it;
 *             per-target failures are logged but don't fail the sweep.
 *   - REMOTE  (set WRITE_API_URL, single): POST to one dashboard. The
 *             original counting-day mode for the single-host era. Still
 *             supported for backward compat — equivalent to DUAL with one
 *             target.
 *   - LOCAL   (no WRITE_API_URL/URLS): writes via better-sqlite3 directly.
 *             Only works when scraper + dashboard share the same SQLite
 *             file. Used for local dev only.
 *
 * MULTI-DROPLET (sharding for resilience + Akamai rate-limit relief):
 *   Run on N droplets, each with its own slice of the 234 ACs:
 *     droplet-A:  AC_RANGE=1-78
 *     droplet-B:  AC_RANGE=79-156
 *     droplet-C:  AC_RANGE=157-234
 *   The dashboard writer is idempotent (Idempotency-Key + no-change/lock
 *   guards), so even overlapping ranges are safe — just wasteful. Each
 *   droplet has its own IP, distributing the Akamai bot-fingerprint risk.
 *   If one droplet gets blocked, the others keep flowing.
 *
 * Required env:
 *   SCRAPE_URL_TEMPLATE   e.g. "https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"
 * Optional env:
 *   WRITE_API_URLS        comma-separated, e.g.
 *                         "https://aws-host,https://railway-host"
 *                         (preferred for AWS+Railway dual-write)
 *   WRITE_API_URL         single URL — backward compat
 *   ADMIN_TOKENS          comma-separated bearer tokens, one per URL.
 *                         If shorter than URLS list, ADMIN_TOKEN is used
 *                         as the fallback for any missing slot.
 *   ADMIN_TOKEN           single bearer token — used for all targets if
 *                         ADMIN_TOKENS isn't set.
 *   WRITE_TIMEOUT_MS      per-target HTTP timeout (default 10000)
 *   SCRAPE_PAD            number of digits to pad AC# (default 0)
 *   POLL_INTERVAL_MS      delay between full sweeps (default 30000)
 *   PER_REQUEST_DELAY_MS  delay between successive constituency hits (default 250)
 *   AC_RANGE              "lo-hi" inclusive, e.g. "79-156"  (preferred for sharding)
 *   AC_IDS                comma-separated AC ids — overrides AC_RANGE if both set
 */
import {
  scrapeOne,
  applyScrapeResult,
  applyScrapeResultToAll,
  type ScraperConfig,
  type RemoteWriteTarget,
} from "../lib/scraper";

const URL_TEMPLATE = process.env.SCRAPE_URL_TEMPLATE;
const WRITE_API_URL = process.env.WRITE_API_URL;
const WRITE_API_URLS = process.env.WRITE_API_URLS;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const ADMIN_TOKENS = process.env.ADMIN_TOKENS;
const WRITE_TIMEOUT_MS = parseInt(process.env.WRITE_TIMEOUT_MS ?? "10000", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "30000", 10);
const PER_REQUEST_DELAY_MS = parseInt(process.env.PER_REQUEST_DELAY_MS ?? "250", 10);
const PAD = parseInt(process.env.SCRAPE_PAD ?? "0", 10);

/**
 * Resolve write targets in priority order:
 *   WRITE_API_URLS (comma list) → DUAL/N-way write
 *   WRITE_API_URL (single)      → backward-compat single-target write
 *   neither                     → LOCAL (no targets returned)
 *
 * Per-target tokens come from ADMIN_TOKENS (positional); any missing
 * slot falls back to ADMIN_TOKEN. Allows a setup like:
 *
 *   WRITE_API_URLS=https://aws-host,https://railway-host
 *   ADMIN_TOKENS=aws-token-here,railway-token-here
 *
 * or a simpler setup where both targets share the same token:
 *
 *   WRITE_API_URLS=https://aws-host,https://railway-host
 *   ADMIN_TOKEN=shared-token
 */
function resolveTargets(): RemoteWriteTarget[] {
  const raw = WRITE_API_URLS ?? WRITE_API_URL;
  if (!raw) return [];
  const urls = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const tokens = (ADMIN_TOKENS ?? "").split(",").map((s) => s.trim());
  return urls.map((apiUrl, i) => ({
    apiUrl,
    token: (tokens[i] && tokens[i].length > 0 ? tokens[i] : undefined) ?? ADMIN_TOKEN,
    label: safeHost(apiUrl),
  }));
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const TARGETS = resolveTargets();

if (!URL_TEMPLATE || !URL_TEMPLATE.includes("{{N}}")) {
  console.error(
    "[scraper] SCRAPE_URL_TEMPLATE missing or malformed. Set it to e.g.\n" +
      `  SCRAPE_URL_TEMPLATE="https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"\n`,
  );
  process.exit(1);
}

const config: ScraperConfig = {
  urlTemplate: URL_TEMPLATE,
  pad: PAD || undefined,
};

// AC list — AC_IDS (explicit) > AC_RANGE (lo-hi) > all 1..234.
function resolveAcIds(): number[] {
  if (process.env.AC_IDS) {
    return process.env.AC_IDS
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n >= 1 && n <= 234);
  }
  if (process.env.AC_RANGE) {
    const m = process.env.AC_RANGE.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!m) {
      console.error(`[scraper] AC_RANGE malformed: "${process.env.AC_RANGE}" — expected "lo-hi"`);
      process.exit(1);
    }
    const lo = Math.max(1, parseInt(m[1], 10));
    const hi = Math.min(234, parseInt(m[2], 10));
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  return Array.from({ length: 234 }, (_, i) => i + 1);
}
const acIds = resolveAcIds();

const writeMode =
  TARGETS.length === 0 ? "LOCAL" : TARGETS.length === 1 ? "REMOTE" : "DUAL";
const targetsStr = TARGETS.map((t) => t.label).join(", ");
console.log(
  `[scraper] starting · ${acIds.length} ACs · ${writeMode} write` +
    (TARGETS.length > 0 ? ` → [${targetsStr}]` : "") +
    ` · ${POLL_INTERVAL_MS}ms sweep · ${PER_REQUEST_DELAY_MS}ms per req` +
    (writeMode === "DUAL" ? ` · ${WRITE_TIMEOUT_MS}ms per-target timeout` : ""),
);

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
  console.log("[scraper] stopping…");
});
process.on("SIGTERM", () => (stopping = true));

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyOne(constituencyId: number) {
  const result = await scrapeOne(constituencyId, config);
  if (TARGETS.length === 0) {
    applyScrapeResult(result);
    return;
  }

  const r = await applyScrapeResultToAll(result, TARGETS, {
    timeoutMs: WRITE_TIMEOUT_MS,
  });

  // Partial-write: at least one target accepted but at least one didn't.
  // Still counts as "ok" for the sweep — next sweep will retry the
  // failing target with the same Idempotency-Key.
  if (r.succeeded > 0 && r.failed > 0) {
    const failed = r.perTarget
      .filter((t) => !t.ok)
      .map((t) => `${t.label} (${t.status || "ERR"}${t.error ? ` ${t.error}` : ""})`)
      .join(", ");
    console.warn(
      `[scraper] AC#${constituencyId} partial-write — ok at [${r.perTarget
        .filter((t) => t.ok)
        .map((t) => t.label)
        .join(", ")}], failed at [${failed}]`,
    );
    return;
  }

  // All targets failed — throw so the sweep counter records it and the
  // 403/429/503 backoff logic in sweep() can react if it's a throttle.
  if (!r.ok) {
    const errs = r.perTarget
      .map((t) => `${t.label} HTTP ${t.status}${t.error ? ` ${t.error}` : ""}`)
      .join("; ");
    throw new Error(`all-targets-failed: ${errs}`);
  }
}

async function sweep() {
  const start = Date.now();
  let ok = 0;
  let fail = 0;
  let throttled = 0;
  for (const id of acIds) {
    if (stopping) return;
    try {
      await applyOne(id);
      ok++;
    } catch (err) {
      fail++;
      const msg = (err as Error).message;
      // 403/429/503 → ECI is throttling us. Back off this sweep.
      if (/HTTP (403|429|503)/.test(msg)) {
        throttled++;
        if (throttled >= 5) {
          console.warn(`[scraper] sustained throttling — backing off 60s`);
          await sleep(60_000);
          throttled = 0;
        }
      } else if (fail < 5) {
        console.error(`[scraper] AC#${id} failed: ${msg}`);
      }
    }
    await sleep(PER_REQUEST_DELAY_MS);
  }
  console.log(
    `[scraper] sweep done in ${Math.round((Date.now() - start) / 1000)}s · ok=${ok} fail=${fail}${
      throttled ? ` throttled=${throttled}` : ""
    }`,
  );
}

(async () => {
  while (!stopping) {
    const sweepStart = Date.now();
    await sweep();
    if (stopping) break;
    const elapsed = Date.now() - sweepStart;
    const wait = Math.max(0, POLL_INTERVAL_MS - elapsed);
    if (wait > 0) await sleep(wait);
  }
  console.log("[scraper] exited cleanly.");
  process.exit(0);
})();
