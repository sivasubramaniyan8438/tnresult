/**
 * Counting-day URL/parser probe. Run this BEFORE starting scrape-loop to
 * confirm:
 *   1. Akamai isn't blocking us (HTTP 200, real HTML body)
 *   2. The URL template substitutes correctly for AC#1, mid, last
 *   3. Our parser extracts a non-empty candidates array with sane votes
 *   4. (If WRITE_API_URL set) the POST body looks correct — does NOT actually post
 *
 * Usage examples:
 *   SCRAPE_URL_TEMPLATE="https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm" \
 *     npx tsx scripts/scrape-probe.ts             # tries 1, 117, 234
 *   ... npx tsx scripts/scrape-probe.ts 13        # one specific AC
 *   ... npx tsx scripts/scrape-probe.ts --save 13 # also saves HTML to /tmp
 *
 * Exit code 0 means you can safely start scrape-loop.
 */
import { writeFileSync } from "node:fs";
import {
  buildUrl,
  fetchHtml,
  parseEciHtml,
  type ScraperConfig,
} from "../lib/scraper";

const URL_TEMPLATE = process.env.SCRAPE_URL_TEMPLATE;
const WRITE_API_URL = process.env.WRITE_API_URL;
const PAD = parseInt(process.env.SCRAPE_PAD ?? "0", 10);

if (!URL_TEMPLATE || !URL_TEMPLATE.includes("{{N}}")) {
  console.error(
    "[probe] Set SCRAPE_URL_TEMPLATE first. e.g.\n" +
      '  export SCRAPE_URL_TEMPLATE="https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"',
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const save = args.includes("--save");
const specific = args.find((a) => /^\d+$/.test(a));
const targets = specific ? [parseInt(specific, 10)] : [1, 117, 234];

const config: ScraperConfig = { urlTemplate: URL_TEMPLATE, pad: PAD || undefined };

function pretty(label: string, ok: boolean) {
  const tag = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  return `${tag} ${label}`;
}

(async () => {
  let allOk = true;
  console.log(`[probe] template: ${URL_TEMPLATE}`);
  if (WRITE_API_URL) console.log(`[probe] would POST to: ${WRITE_API_URL}/api/agent/update`);
  console.log("");

  for (const acId of targets) {
    const url = buildUrl(config, acId);
    console.log(`── AC#${acId} ─────────────────────────────────────`);
    console.log(`  URL:   ${url}`);
    let html = "";
    let bytes = 0;
    const fetchStart = Date.now();
    try {
      html = await fetchHtml(url, config);
      bytes = html.length;
      const ms = Date.now() - fetchStart;
      console.log(pretty(`fetched ${bytes} bytes in ${ms}ms`, true));
    } catch (err) {
      const ms = Date.now() - fetchStart;
      console.log(pretty(`fetch FAILED in ${ms}ms — ${(err as Error).message}`, false));
      allOk = false;
      continue;
    }
    if (save) {
      const path = `/tmp/eci-ac-${acId}.html`;
      writeFileSync(path, html);
      console.log(`  saved: ${path}`);
    }
    // Akamai sentinel: < 4KB body usually = bot challenge
    if (bytes < 4000) {
      console.log(pretty("body suspiciously small — likely Akamai challenge", false));
      allOk = false;
    }

    const parsed = parseEciHtml(html, acId);
    const cCount = parsed.candidates.length;
    const totalVotes = parsed.candidates.reduce((s, c) => s + c.votes, 0);
    if (cCount === 0) {
      console.log(pretty("parser found 0 candidates — selectors need adjusting", false));
      console.log("    -> save HTML and inspect: re-run with --save and read /tmp/eci-ac-*.html");
      allOk = false;
    } else {
      console.log(
        pretty(
          `parsed ${cCount} candidates · round ${parsed.round ?? "?"}/${parsed.totalRounds ?? "?"} · ${totalVotes.toLocaleString("en-IN")} total votes`,
          true,
        ),
      );
      // Print top 3
      const top = [...parsed.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3);
      for (const c of top) {
        console.log(`    ${c.votes.toLocaleString("en-IN").padStart(8)} · ${c.party.padEnd(40)} · ${c.name}`);
      }
    }

    // Dry-run remote POST (just to show the body — no actual fetch)
    if (WRITE_API_URL && cCount > 0) {
      console.log("  remote POST would send:");
      const aggBy: Record<string, number> = {};
      for (const c of parsed.candidates) {
        // mirror DEFAULT_PARTY_MAP (rough — for visibility only)
        aggBy[c.party] = (aggBy[c.party] ?? 0) + c.votes;
      }
      console.log(
        "    " +
          JSON.stringify({
            constituencyId: parsed.constituencyId,
            round: parsed.round ?? 1,
            totalRounds: parsed.totalRounds ?? undefined,
            status: parsed.status,
            candidatesByEciLabel: aggBy,
          }),
      );
    }
    console.log("");
  }

  console.log(allOk ? "[probe] \x1b[32mALL CHECKS PASSED\x1b[0m — safe to start scrape-loop" : "[probe] \x1b[31mFAILED\x1b[0m — fix above before running scrape-loop");
  process.exit(allOk ? 0 : 1);
})();
