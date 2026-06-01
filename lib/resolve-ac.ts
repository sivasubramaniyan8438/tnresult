/**
 * Resolve a constituency reference (name or id) to an official AC entry.
 *
 * Accepts the inputs an agent or human might naturally write:
 *   - 13                              (number)
 *   - "13"                            (string of a number)
 *   - "Kolathur" / "kolathur"         (case-insensitive name)
 *   - "T.Nagar" / "T Nagar"           (punctuation flexible)
 *   - "Thiyagarayanagar"              (canonical form, also matches T. Nagar)
 *   - "Tiruppattur, Sivaganga"        (name + district to disambiguate)
 *
 * Returns the matched AC, or a 400-style error with suggestions.
 */
import { getDb } from "./db";

export type AcEntry = {
  id: number;
  name: string;
  district: string;
  reservation: string;
};

export type ResolveResult =
  | { ok: true; ac: AcEntry }
  | { ok: false; error: string; suggestions?: string[] };

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/gi, "")
    .replace(/[._,()/\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Hand-aliased synonyms — both directions
const NAME_ALIASES: Record<string, string> = {
  "t nagar": "thiyagarayanagar",
  "thiyagarayanagar": "thiyagarayanagar",
  "kanchipuram": "kancheepuram",
  "tiruvallur": "thiruvallur",
  "madhavaram": "madavaram",
  "tharangambadi": "poompuhar",
  "tharangampadi": "poompuhar",
  "admk": "aiadmk",
};

let _cached: AcEntry[] | null = null;
function allAcs(): AcEntry[] {
  if (_cached) return _cached;
  const db = getDb();
  _cached = db
    .prepare("SELECT id, name, district, reservation FROM constituencies ORDER BY id")
    .all() as AcEntry[];
  return _cached;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = cur;
    }
  }
  return dp[n];
}

export function resolveAc(input: string | number | undefined | null): ResolveResult {
  if (input == null) return { ok: false, error: "ac required" };

  // Numeric form — direct lookup
  const asNum = typeof input === "number" ? input : Number(input);
  if (typeof input !== "string" || /^\s*\d+\s*$/.test(input)) {
    const ac = allAcs().find((a) => a.id === asNum);
    if (ac) return { ok: true, ac };
    return { ok: false, error: `no AC with id ${asNum}` };
  }

  // String form — name resolution. Extract district hint BEFORE normalizing
  // because norm() turns commas into spaces.
  let nameRaw = input;
  let districtHint: string | null = null;
  const commaIdx = input.lastIndexOf(",");
  if (commaIdx > 0) {
    districtHint = norm(input.slice(commaIdx + 1));
    nameRaw = input.slice(0, commaIdx);
  }
  let key = norm(nameRaw);
  if (NAME_ALIASES[key]) key = NAME_ALIASES[key];

  const acs = allAcs();
  // Exact (normalized) name matches — possibly multiple if name is ambiguous
  const exact = acs.filter((a) => norm(a.name) === key);
  if (exact.length === 1) return { ok: true, ac: exact[0] };
  if (exact.length > 1) {
    if (districtHint) {
      const refined = exact.find((a) => norm(a.district).includes(districtHint!));
      if (refined) return { ok: true, ac: refined };
    }
    return {
      ok: false,
      error: `"${input}" is ambiguous — matches ${exact.length} ACs; add district like "${exact[0].name}, ${exact[0].district}"`,
      suggestions: exact.map((a) => `${a.name}, ${a.district}`),
    };
  }

  // Fuzzy fallback — levenshtein distance ≤ 2 against normalized name
  const ranked = acs
    .map((a) => ({ a, d: levenshtein(key, norm(a.name)) }))
    .filter((r) => r.d <= 3)
    .sort((x, y) => x.d - y.d);
  if (ranked.length && ranked[0].d <= 1) {
    return { ok: true, ac: ranked[0].a };
  }
  return {
    ok: false,
    error: `no AC matched "${input}"`,
    suggestions: ranked.slice(0, 5).map((r) => r.a.name),
  };
}
