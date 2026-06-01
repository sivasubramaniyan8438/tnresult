/**
 * Scrape candidate names + parties from MyNeta TN 2026 for all 234 ACs.
 *
 * Run on the India droplet (avoids upstream throttling) — outputs
 * candidates-real.json mapping each official AC# to a list of {name, party_id}.
 *
 * MyNeta obfuscates most candidate rows via per-row JS (eval(function...))
 * that document.write()s the row HTML. We decode by running each <script>
 * in a Node vm sandbox where eval/document.write capture the produced string
 * instead of executing it.
 */
import * as cheerio from "cheerio";
import vm from "node:vm";
import fs from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-IN,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};
const BASE = "https://myneta.info/TamilNadu2026";

const PARTY_MAP = {
  "DMK": "DMK",
  "Dravida Munnetra Kazhagam": "DMK",
  "AIADMK": "AIADMK",
  "All India Anna Dravida Munnetra Kazhagam": "AIADMK",
  "BJP": "BJP",
  "Bharatiya Janata Party": "BJP",
  "INC": "INC",
  "Indian National Congress": "INC",
  "Tamilaga Vettri Kazhagam": "TVK",
  "Tamilaga Vetri Kazhagam": "TVK",
  "TVK": "TVK",
  "Naam Tamilar Katchi": "NTK",
  "NTK": "NTK",
  "Viduthalai Chiruthaigal Katchi": "VCK",
  "VCK": "VCK",
  "Pattali Makkal Katchi": "PMK",
  "PMK": "PMK",
  "Desiya Murpokku Dravida Kazhagam": "DMDK",
  "DMDK": "DMDK",
  "Marumalarchi Dravida Munnetra Kazhagam": "MDMK",
  "MDMK": "MDMK",
  "Communist Party of India": "CPI",
  "CPI": "CPI",
  "Communist Party of India  (Marxist)": "CPM",
  "Communist Party of India (Marxist)": "CPM",
  "CPM": "CPM",
  "IND": "IND",
  "Independent": "IND",
};

function partyOf(raw) {
  const t = raw.trim();
  if (PARTY_MAP[t]) return PARTY_MAP[t];
  for (const [k, v] of Object.entries(PARTY_MAP)) {
    if (k.toLowerCase() === t.toLowerCase()) return v;
  }
  return "OTH";
}

// Normalize names for matching MyNeta's "VILLIVAKKAM (SC)" → official "Villivakkam"
function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/gi, "")
    .replace(/[._,()/\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return await r.text();
      if (r.status === 429 && i < retries) {
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }
      throw new Error("HTTP " + r.status);
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  throw lastErr;
}

function decodeCandidatesFromHtml(html) {
  const $ = cheerio.load(html);
  const candidates = [];
  // Static rows in any table
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td").map((_, td) => $(td).text().trim()).get();
    if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
      candidates.push({ name: cells[1], party_raw: cells[2], party_id: partyOf(cells[2]) });
    }
  });
  // Decode obfuscated <script> blocks (each candidate is its own eval)
  const docWrites = [];
  $("script").each((_, el) => {
    const code = $(el).html() || "";
    if (!/eval\(function\(/.test(code)) return;
    const sandbox = {
      eval: (s) => {
        docWrites.push(s);
        return "";
      },
      decodeURIComponent,
      escape,
      Math,
      String,
      RegExp,
      document: { write: (s) => docWrites.push("[doc.write]" + s) },
    };
    try {
      vm.createContext(sandbox);
      vm.runInContext(code, sandbox, { timeout: 2000 });
    } catch {
      /* ignore parser errors */
    }
  });
  if (docWrites.length) {
    // Captured strings can be either:
    //   - an inner doc.write payload (prefixed with "[doc.write]"), or
    //   - the raw eval() argument like document.write(' <tr>...');  ← most common path
    // Extract the <tr>...</tr> content from either shape.
    const combined = docWrites
      .map((c) => {
        if (c.startsWith("[doc.write]")) return c.slice("[doc.write]".length);
        // pull all <tr> blocks out of the captured string
        const trs = c.match(/<tr[\s\S]*?<\/tr>/gi);
        return trs ? trs.join("") : "";
      })
      .join("");
    if (combined) {
      const $r = cheerio.load("<table>" + combined + "</table>");
      $r("tr").each((_, tr) => {
        const cells = $r(tr).find("td").map((_, td) => $r(td).text().trim()).get();
        if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
          candidates.push({ name: cells[1], party_raw: cells[2], party_id: partyOf(cells[2]) });
        }
      });
    }
  }
  // Dedupe by (name|party)
  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const k = c.name + "|" + c.party_id;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(c);
  }
  return uniq;
}

async function getMynetaAcList() {
  const html = await fetchHtml(BASE + "/");
  const $ = cheerio.load(html);
  const acs = [];
  $('a[href*="action=show_candidates"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/constituency_id=(\d+)/);
    if (!m) return;
    acs.push({ mynetaId: parseInt(m[1], 10), name: $(el).text().trim() });
  });
  return acs;
}

async function getCandidatesForAc(mynetaId) {
  const html = await fetchHtml(
    BASE + "/index.php?action=show_candidates&constituency_id=" + mynetaId,
  );
  return decodeCandidatesFromHtml(html);
}

async function main() {
  const officialAcs = JSON.parse(
    fs.readFileSync("/opt/naadhas-scraper/constituencies-official.json", "utf-8"),
  );

  console.log("1) Fetching MyNeta AC list…");
  const mynetaAcs = await getMynetaAcList();
  console.log("   Got " + mynetaAcs.length + " MyNeta ACs");

  const officialByName = new Map();
  for (const ac of officialAcs) officialByName.set(norm(ac.name), ac);

  // Manual aliases for known mismatches between MyNeta naming and our official list.
  // Key = MyNeta's normalized name, value = our normalized name.
  const ALIAS = {
    "thiyagarayanagar": "t  nagar",
    "kancheepuram": "kanchipuram",
    "vedasandur": "vedasandur",
    "pappireddipatti": "pappireddippatti",
    "colachal": "colachel",
    "thally": "thalli",
    "vedharanyam": "vedaranyam",
    "paramathivelur": "paramathi velur",
    "tiruchengodu": "tiruchengode",
    "gandarvakottai": "gandharvakottai",
    "mudukulathur": "mudhukulathur",
    "sholinghur": "sholingur",
    "tiruppathur": "tirupattur",
    "bodinayakkanur": "bodinayakanur",
    "madhuravoyal": "maduravoyal",
    "thiruvallur": "tiruvallur",
    "gudiyattam": "gudiyatham",
    "aruppukottai": "aruppukkottai",
  };

  let matched = 0;
  const unmatched = [];
  for (const m of mynetaAcs) {
    const k = norm(m.name);
    const aliased = ALIAS[k] || k;
    const official = officialByName.get(aliased);
    if (official) {
      m.officialId = official.id;
      m.officialName = official.name;
      m.district = official.district;
      matched++;
    } else {
      unmatched.push(m);
    }
  }
  console.log(
    "   Matched " + matched + "/" + mynetaAcs.length + "; unmatched=" + unmatched.length,
  );
  if (unmatched.length) {
    for (const u of unmatched) console.log("     - mynetaId=" + u.mynetaId + ' "' + u.name + '"');
  }

  console.log("2) Fetching candidates (concurrency=2)…");
  const queue = mynetaAcs.filter((m) => m.officialId);
  const out = [];
  let done = 0;
  const start = Date.now();
  const fetchOne = async (m) => {
    try {
      const cands = await getCandidatesForAc(m.mynetaId);
      out.push({
        officialId: m.officialId,
        officialName: m.officialName,
        district: m.district,
        mynetaName: m.name,
        candidates: cands,
      });
    } catch (err) {
      out.push({
        officialId: m.officialId,
        officialName: m.officialName,
        district: m.district,
        mynetaName: m.name,
        candidates: [],
        error: String(err.message),
      });
    }
    done++;
    if (done % 25 === 0 || done === queue.length) {
      const dt = Math.round((Date.now() - start) / 1000);
      const empty = out.filter((o) => o.candidates.length === 0).length;
      console.log(`   ${done}/${queue.length} done in ${dt}s · empty=${empty}`);
    }
  };
  const CONC = 2;
  const workers = Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const m = queue.shift();
      if (!m) return;
      await fetchOne(m);
      await new Promise((res) => setTimeout(res, 600));
    }
  });
  await Promise.all(workers);

  out.sort((a, b) => a.officialId - b.officialId);
  fs.writeFileSync(
    "/opt/naadhas-scraper/candidates-real.json",
    JSON.stringify(out, null, 2),
  );

  const totalCands = out.reduce((s, ac) => s + ac.candidates.length, 0);
  const partyHist = {};
  for (const ac of out)
    for (const c of ac.candidates) partyHist[c.party_id] = (partyHist[c.party_id] || 0) + 1;
  console.log("3) Wrote candidates-real.json");
  console.log("   " + out.length + " ACs · " + totalCands + " candidates");
  for (const [k, v] of Object.entries(partyHist).sort((a, b) => b[1] - a[1]))
    console.log("     " + k + ": " + v);
  console.log(`   ACs with >= 1 candidate: ${out.filter((o) => o.candidates.length).length}`);
  console.log(`   ACs with 0 candidates: ${out.filter((o) => !o.candidates.length).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
