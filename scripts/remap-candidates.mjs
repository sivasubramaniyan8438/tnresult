/**
 * One-shot remap: re-match the existing data/candidates-real.json against
 * the corrected data/constituencies.json by name. Use the same normalize +
 * alias logic as myneta-ingest.mjs so each candidate-real entry now points
 * to the *correct* officialId.
 */
import fs from "node:fs";

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/gi, "")
    .replace(/[._,()/\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// MyNeta-name (normalized) → canonical-name (normalized)
const ALIAS = {
  "thiyagarayanagar": "thiyagarayanagar",
  "t nagar": "thiyagarayanagar",
  "kancheepuram": "kancheepuram",
  "kanchipuram": "kancheepuram",
  "vedasandur": "vedasandur",
  "pappireddipatti": "pappireddippatti",
  "colachal": "colachal",
  "colachel": "colachal",
  "thally": "thalli",
  "vedharanyam": "vedaranyam",
  "paramathivelur": "paramathi velur",
  "tiruchengodu": "tiruchengodu",
  "tiruchengode": "tiruchengodu",
  "gandarvakottai": "gandarvakottai",
  "gandharvakottai": "gandarvakottai",
  "mudukulathur": "mudhukulathur",
  "sholinghur": "sholingur",
  "tirupathur": "tiruppattur", // ambiguous: AC#50 (Tirupathur dist) or AC#185 (Sivaganga). Tie-break on district below.
  "tiruppathur": "tiruppattur",
  "tirupattur": "tiruppattur",
  "bodinayakkanur": "bodinayakanur",
  "madhuravoyal": "maduravoyal",
  "madhavaram": "madavaram",
  "thiruvallur": "thiruvallur",
  "tiruvallur": "thiruvallur",
  "gudiyattam": "gudiyatham",
  "aruppukottai": "aruppukkottai",
  "tharangampadi": "poompuhar",
  "tharangambadi": "poompuhar",
  "vridhachalam": "virudhachalam",
  "thoothukudi": "thoothukkudi",
  "manapparai": "manapaarai",
  "manapparai ": "manapaarai",
  "nilakkottai": "nilakottai",
};

const data = JSON.parse(fs.readFileSync("data/candidates-real.json", "utf-8"));
const official = JSON.parse(fs.readFileSync("data/constituencies.json", "utf-8"));

const byNormName = new Map();
for (const ac of official) byNormName.set(norm(ac.name), ac);

// For ambiguous names (e.g. "Tiruppattur" exists at both AC#50 and AC#185),
// build a (name, district) keyed lookup for tie-breaking.
const byNameAndDistrict = new Map();
for (const ac of official) byNameAndDistrict.set(`${norm(ac.name)}|${norm(ac.district)}`, ac);

let remapped = 0;
let unchanged = 0;
let unmatched = [];
const seen = new Set();
const collisions = [];

for (const entry of data) {
  // Use the MyNeta name as authoritative, fall back to officialName
  const candName = entry.mynetaName || entry.officialName;
  let key = norm(candName);
  if (ALIAS[key]) key = ALIAS[key];

  // Try district disambiguation if we know it
  let match = null;
  if (entry.district) {
    match = byNameAndDistrict.get(`${key}|${norm(entry.district)}`);
  }
  if (!match) match = byNormName.get(key);

  if (!match) {
    unmatched.push({ mynetaName: entry.mynetaName, officialName: entry.officialName, district: entry.district });
    continue;
  }
  if (seen.has(match.id)) {
    collisions.push({ id: match.id, name: match.name, conflict: candName });
    continue;
  }
  seen.add(match.id);

  if (entry.officialId !== match.id) {
    remapped++;
    entry.officialId = match.id;
    entry.officialName = match.name;
    entry.district = match.district;
  } else {
    unchanged++;
    // Keep officialName authoritative from canonical list
    entry.officialName = match.name;
    entry.district = match.district;
  }
}

data.sort((a, b) => a.officialId - b.officialId);
fs.writeFileSync("data/candidates-real.json", JSON.stringify(data, null, 2));

console.log(`Remap done · changed=${remapped} unchanged=${unchanged} unmatched=${unmatched.length} collisions=${collisions.length}`);
if (unmatched.length) {
  console.log("\nUnmatched (these will not seed real candidates):");
  for (const u of unmatched.slice(0, 30)) console.log(`  - ${u.mynetaName} (district: ${u.district})`);
}
if (collisions.length) {
  console.log("\nCollisions (multiple sources mapped to same officialId — keeping first):");
  for (const c of collisions) console.log(`  - AC#${c.id} ${c.name} ← also matched: ${c.conflict}`);
}
