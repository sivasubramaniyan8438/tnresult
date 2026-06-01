/**
 * One-shot helper: fetch a single AC URL and dump its parsed structure
 * so we can adapt selectors when ECI changes the HTML layout for 2026.
 *
 * Usage: SCRAPE_URL_TEMPLATE="..." npx tsx scripts/inspect-html.ts 1
 */
import * as cheerio from "cheerio";
import { buildUrl, fetchHtml, parseEciHtml, type ScraperConfig } from "../lib/scraper";

const URL_TEMPLATE = process.env.SCRAPE_URL_TEMPLATE;
const PAD = parseInt(process.env.SCRAPE_PAD ?? "0", 10);
const acNumber = parseInt(process.argv[2] ?? "1", 10);

if (!URL_TEMPLATE) {
  console.error("Set SCRAPE_URL_TEMPLATE first.");
  process.exit(1);
}

const config: ScraperConfig = { urlTemplate: URL_TEMPLATE, pad: PAD || undefined };
const url = buildUrl(config, acNumber);
console.log(`[inspect] fetching ${url}`);

(async () => {
  const html = await fetchHtml(url, config);
  console.log(`[inspect] got ${html.length} bytes`);

  const $ = cheerio.load(html);
  console.log(`title: ${$("title").text().trim()}`);
  console.log(`tables: ${$("table").length}`);

  const parsed = parseEciHtml(html, acNumber);
  console.log("parsed:", JSON.stringify(parsed, null, 2));
})();
