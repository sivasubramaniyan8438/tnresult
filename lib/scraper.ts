/**
 * ECI scraper for TN 2026 results.
 *
 * IMPORTANT — context for whoever runs this:
 *
 * 1. ECI geo-blocks non-Indian IPs at the Akamai layer. This MUST run from a
 *    Mumbai/Bangalore VPS or a residential India proxy. From the US it returns
 *    403 immediately.
 *
 * 2. ECI does NOT publish a public JSON API. We scrape HTML from
 *    results.eci.gov.in. The exact URL pattern changes every election cycle —
 *    examples seen historically:
 *      - /Constituencywise/ConstituencywiseS22XX.htm   (S22 = TN, XX = AC#)
 *      - /ResultAcGenFeb2024/ConstituencywiseS22XX.htm
 *    The current pattern is set via SCRAPE_URL_TEMPLATE below.
 *
 * 3. We poll politely (default every 30s/AC) with a real User-Agent. Pushing
 *    much faster risks Akamai rate-limiting the scraper IP.
 *
 * Set the URL template via the SCRAPE_URL_TEMPLATE env var, with {{N}} as
 * placeholder for the AC number padded as needed:
 *
 *   SCRAPE_URL_TEMPLATE="https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"
 *
 * Then run: `npx tsx scripts/scrape-once.ts`  (one-shot)
 *      or:  `npx tsx scripts/scrape-loop.ts`   (long-running)
 */
import * as cheerio from "cheerio";
import { applyRoundUpdate } from "./writer";
import { getDb } from "./db";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export type ScrapedCandidate = {
  name: string;
  party: string; // raw party label as ECI prints it
  votes: number;
};

export type ScrapeResult = {
  constituencyId: number;
  round: number | null;
  totalRounds: number | null;
  status: "pending" | "counting" | "leading" | "won";
  candidates: ScrapedCandidate[];
};

export type ScraperConfig = {
  urlTemplate: string; // e.g. "https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"
  pad?: number; // pad AC number, e.g. 2 → "01", "23"
  userAgent?: string;
  fetchTimeoutMs?: number;
  partyMap?: Record<string, string>; // ECI label → our party id
};

const DEFAULT_PARTY_MAP: Record<string, string> = {
  "Dravida Munnetra Kazhagam": "DMK",
  "All India Anna Dravida Munnetra Kazhagam": "AIADMK",
  "Bharatiya Janata Party": "BJP",
  "Indian National Congress": "INC",
  "Tamilaga Vettri Kazhagam": "TVK",
  "Naam Tamilar Katchi": "NTK",
  "Viduthalai Chiruthaigal Katchi": "VCK",
  "Pattali Makkal Katchi": "PMK",
  "Amma Makkal Munnetra Kazhagam": "AMMK",
  "Desiya Murpokku Dravida Kazhagam": "DMDK",
  // MDMK contests on DMK's symbol in TN 2026 — collapse at scrape time so
  // the writer never sees a separate MDMK row.
  "Marumalarchi Dravida Munnetra Kazhagam": "DMK",
  "Communist Party Of India": "CPI",
  "Communist Party Of India  (Marxist)": "CPM",
  "Tamil Maanila Congress (Moopanar)": "TMC",
  "Tamil Maanila Congress": "TMC",
  "Kongunadu Makkal Desia Katchi": "KMDK",
  "Indian Union Muslim League": "IUML",
  Independent: "IND",
};

export function buildUrl(config: ScraperConfig, acNumber: number): string {
  const padded = config.pad
    ? String(acNumber).padStart(config.pad, "0")
    : String(acNumber);
  return config.urlTemplate.replace(/\{\{N\}\}/g, padded);
}

// Full browser fingerprint — ECI's Akamai layer rejects requests that don't
// look like a real Chrome/Safari load. Verified empirically (memory:
// "full browser header set bypasses it"). Keep these in sync; dropping any
// one of Sec-Fetch-* or sec-ch-ua tends to flip back to 403.
const BROWSER_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not.A/Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

export async function fetchHtml(url: string, config: ScraperConfig): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.fetchTimeoutMs ?? 12000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent ?? DEFAULT_USER_AGENT,
        ...BROWSER_HEADERS,
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * ECI HTML has historically structured results as:
 *   .const-name → constituency name
 *   .total-round → "Round 12 of 22"  (rough)
 *   table with rows: candidate, party, votes (current), trend
 *
 * The selectors below are best-effort heuristics. ON LAUNCH DAY:
 *   1. Save a sample HTML response from the real URL.
 *   2. Run scripts/inspect-html.ts to see what classes / tables ECI used this time.
 *   3. Adjust the parse function below.
 */
export function parseEciHtml(html: string, constituencyId: number): ScrapeResult {
  const $ = cheerio.load(html);
  // Try multiple selector strategies
  let round: number | null = null;
  let totalRounds: number | null = null;

  const roundText = $("body").text().match(/Round\s+(\d+)\s+of\s+(\d+)/i);
  if (roundText) {
    round = parseInt(roundText[1], 10);
    totalRounds = parseInt(roundText[2], 10);
  }

  const candidates: ScrapedCandidate[] = [];
  // Look for a results table
  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    if (rows.length < 2) return;
    const headers = $(rows[0])
      .find("th")
      .map((_, th) => $(th).text().trim().toLowerCase())
      .get();
    const nameIdx = headers.findIndex((h) => /candidate|name/.test(h));
    const partyIdx = headers.findIndex((h) => /party/.test(h));
    const votesIdx = headers.findIndex((h) => /total|votes/.test(h));
    if (nameIdx < 0 || partyIdx < 0 || votesIdx < 0) return;

    for (let i = 1; i < rows.length; i++) {
      const cells = $(rows[i]).find("td").toArray();
      if (cells.length === 0) continue;
      const name = $(cells[nameIdx]).text().trim();
      const party = $(cells[partyIdx]).text().trim();
      const votesRaw = $(cells[votesIdx]).text().trim().replace(/[, ]/g, "");
      const votes = parseInt(votesRaw, 10);
      if (!name || isNaN(votes)) continue;
      candidates.push({ name, party, votes });
    }
  });

  let status: ScrapeResult["status"] = "pending";
  if (candidates.length > 0) {
    status = totalRounds && round && round >= totalRounds ? "won" : "leading";
  }

  return { constituencyId, round, totalRounds, status, candidates };
}

/**
 * Match a scraped result to candidates in our DB and apply the round update.
 * If candidate names diverge from the seed we may need a fuzzy-match step;
 * for now we match on (constituency_id, party_id) and warn on mismatches.
 */
export function applyScrapeResult(scrape: ScrapeResult, partyMap = DEFAULT_PARTY_MAP) {
  const db = getDb();
  const ourCandidates = db
    .prepare(
      "SELECT id, name, party_id FROM candidates WHERE constituency_id = ?",
    )
    .all(scrape.constituencyId) as Array<{ id: number; name: string; party_id: string }>;

  const merged: Array<{ candidateId: number; votes: number }> = [];

  for (const sc of scrape.candidates) {
    const partyId = partyMap[sc.party] ?? "IND";
    // Match by exact party + best name fuzzy
    let candidate = ourCandidates.find(
      (c) => c.party_id === partyId && c.name.toLowerCase() === sc.name.toLowerCase(),
    );
    if (!candidate) {
      // Fall back to party-only match (most common scenario in seeded data)
      candidate = ourCandidates.find((c) => c.party_id === partyId);
    }
    if (!candidate) {
      console.warn(
        `[scraper] no candidate match in AC#${scrape.constituencyId} for "${sc.name}" (${sc.party})`,
      );
      continue;
    }
    merged.push({ candidateId: candidate.id, votes: sc.votes });
  }

  if (merged.length === 0) return { applied: false, reason: "no-candidates" as const };

  // source='scraper' → writer enforces manual-lock + won-sticky + stale-round skip.
  const result = applyRoundUpdate({
    constituencyId: scrape.constituencyId,
    round: scrape.round ?? 1,
    totalRounds: scrape.totalRounds ?? undefined,
    status: scrape.status,
    candidates: merged,
    actor: "eci-scraper",
    source: "scraper",
  });
  if (!result.applied) {
    // Quiet for the common cases ('no-change', 'locked'); loud for stale-round
    if (result.reason === "stale-round") {
      console.warn(
        `[scraper] stale round skipped for AC#${scrape.constituencyId}: prior round was higher`,
      );
    }
  }
  return result;
}

export async function scrapeOne(
  constituencyId: number,
  config: ScraperConfig,
): Promise<ScrapeResult> {
  const url = buildUrl(config, constituencyId);
  const html = await fetchHtml(url, config);
  return parseEciHtml(html, constituencyId);
}

/**
 * Remote write — POST a scrape result to a running dashboard's /api/agent/update
 * endpoint. Used when the scraper runs on the DigitalOcean Bangalore droplet
 * (which has no local DB) and must push to the Railway-hosted dashboard.
 *
 * The dashboard API resolves partyId → first-seeded candidate of that party,
 * which matches our seeded-slate model. For minor / IND candidates ECI shows
 * but we don't have seeded, this drops them silently — same trade-off as the
 * local writer with party-only fallback.
 */
export async function applyScrapeResultRemote(
  scrape: ScrapeResult,
  opts: {
    apiUrl: string;
    token?: string;
    partyMap?: Record<string, string>;
    /** Per-call HTTP timeout. Defaults to 10s — keeps a slow target from
     *  blocking the whole scrape sweep. */
    timeoutMs?: number;
  },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const partyMap = opts.partyMap ?? DEFAULT_PARTY_MAP;
  // Aggregate by partyId — ECI may list multiple candidates per party in
  // edge cases (it shouldn't, but defensive). Sum into first occurrence.
  const byParty = new Map<string, number>();
  for (const sc of scrape.candidates) {
    const partyId = partyMap[sc.party] ?? "IND";
    byParty.set(partyId, (byParty.get(partyId) ?? 0) + sc.votes);
  }
  const candidates = Array.from(byParty, ([partyId, votes]) => ({ partyId, votes }));
  if (candidates.length === 0) {
    return { ok: false, status: 0, body: { error: "no candidates parsed" } };
  }

  const url = `${opts.apiUrl.replace(/\/$/, "")}/api/agent/update`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-actor": "agent:eci-scraper",
    // Same Idempotency-Key sent to every target → safe to retry, safe
    // to dual-write to AWS + Railway, no double-counting.
    "Idempotency-Key": `eci-${scrape.constituencyId}-r${scrape.round ?? 0}-v${
      candidates.reduce((s, c) => s + c.votes, 0)
    }`,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        constituencyId: scrape.constituencyId,
        round: scrape.round ?? 1,
        totalRounds: scrape.totalRounds ?? undefined,
        status: scrape.status,
        candidates,
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fan-out a single scrape result to N targets in parallel and report a
 * combined result. Used to dual-write counting-day data to BOTH the AWS
 * primary AND the Railway warm standby so a failover is zero-data-lag.
 *
 * Returns:
 *   ok: true if AT LEAST ONE target succeeded (or returned 409 — a
 *       409 means the writer already has a newer round / lock, which
 *       is functionally a success for the scraper's purposes).
 *   ok: false only when EVERY target failed.
 *   perTarget: per-endpoint outcome for logging.
 */
export type RemoteWriteTarget = { apiUrl: string; token?: string; label?: string };
export type DualWriteResult = {
  ok: boolean;
  succeeded: number;
  failed: number;
  perTarget: Array<{ label: string; ok: boolean; status: number; error?: string }>;
};

export async function applyScrapeResultToAll(
  scrape: ScrapeResult,
  targets: RemoteWriteTarget[],
  opts: { partyMap?: Record<string, string>; timeoutMs?: number } = {},
): Promise<DualWriteResult> {
  if (targets.length === 0) {
    return { ok: false, succeeded: 0, failed: 0, perTarget: [] };
  }

  const settled = await Promise.allSettled(
    targets.map((t) =>
      applyScrapeResultRemote(scrape, {
        apiUrl: t.apiUrl,
        token: t.token,
        partyMap: opts.partyMap,
        timeoutMs: opts.timeoutMs,
      }),
    ),
  );

  const perTarget = settled.map((s, i) => {
    const label = targets[i].label ?? safeHostFor(targets[i].apiUrl);
    if (s.status === "fulfilled") {
      // 2xx or 409 (locked / no-change / won-sticky) both count as ok
      const isAcceptable = s.value.ok || s.value.status === 409;
      return {
        label,
        ok: isAcceptable,
        status: s.value.status,
        error: isAcceptable ? undefined : safeBodyError(s.value.body),
      };
    }
    return {
      label,
      ok: false,
      status: 0,
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });

  const succeeded = perTarget.filter((r) => r.ok).length;
  return {
    ok: succeeded > 0,
    succeeded,
    failed: perTarget.length - succeeded,
    perTarget,
  };
}

function safeHostFor(rawUrl: string): string {
  try {
    return new URL(rawUrl).host;
  } catch {
    return rawUrl;
  }
}

function safeBodyError(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: unknown }).error;
    return typeof e === "string" ? e : JSON.stringify(e);
  }
  return undefined;
}
