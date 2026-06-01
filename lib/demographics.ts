/**
 * Tamil Nadu district-level demographic data — Census 2011.
 *
 * Used by the swing-map's demographic overlay modes (reservation, urban-rural,
 * literacy, sex-ratio). Constituency-level demographic precision isn't
 * available in any reliable public source (the Census reports at district +
 * sub-district, not at AC), so any AC-level overlay shows the value of its
 * **parent district**. The legend / tooltip labels each non-political mode
 * as "Census 2011 · district" so viewers don't mistake it for AC precision.
 *
 * Source: Provisional Population Totals, Census of India 2011 — Tamil Nadu.
 *   - https://www.census2011.co.in/census/state/tamil+nadu.html
 *   - District literacy: tablesC-2 of the TN handbook
 *   - District sex ratio: tablesC-1 of the TN handbook
 *
 * Some districts (Mayiladuthurai, Tenkasi, Tirupattur, Ranipet, Chengalpattu,
 * Kallakurichi) were carved out AFTER Census 2011 — for those we use the
 * value of the parent district they were spun out of, since the underlying
 * population characteristics didn't change with the boundary redraw.
 */

export type Urbanity = "urban" | "semi-urban" | "rural";

export type DistrictDemographics = {
  /** Best-fit urban classification — based on Census 2011 urban-share %. */
  urbanity: Urbanity;
  /** Total literacy rate (% age 7+), Census 2011. */
  literacyPct: number;
  /** Sex ratio: females per 1000 males, Census 2011. */
  sexRatio: number;
  /** Religion shares as % of district population, Census 2011.
   *  Numbers don't always sum to 100 — Sikhs, Buddhists, Jains, Other,
   *  and Religion-Not-Stated are folded into `otherPct`. */
  hinduPct: number;
  muslimPct: number;
  christianPct: number;
  otherPct: number;
  /** True if this row's value was inherited from a parent district that
   *  was bifurcated after Census 2011. Shown in the tooltip so it's
   *  honest about provenance. */
  inheritedFrom?: string;
};

export const TN_DISTRICT_DEMOGRAPHICS: Record<string, DistrictDemographics> = {
  // — Pre-2011 districts (direct Census 2011 figures, religion %) —
  "Chennai":           { urbanity: "urban",      literacyPct: 90.2, sexRatio: 989,  hinduPct: 80.7, muslimPct: 9.5,  christianPct: 7.7,  otherPct: 2.1 },
  "Coimbatore":        { urbanity: "urban",      literacyPct: 84.3, sexRatio: 1000, hinduPct: 89.5, muslimPct: 6.7,  christianPct: 3.5,  otherPct: 0.3 },
  "Madurai":           { urbanity: "urban",      literacyPct: 83.4, sexRatio: 990,  hinduPct: 84.6, muslimPct: 8.7,  christianPct: 6.5,  otherPct: 0.2 },
  "Tiruppur":          { urbanity: "urban",      literacyPct: 78.7, sexRatio: 989,  hinduPct: 92.0, muslimPct: 4.9,  christianPct: 2.9,  otherPct: 0.2 },

  "Tiruchirappalli":   { urbanity: "semi-urban", literacyPct: 83.5, sexRatio: 1013, hinduPct: 84.7, muslimPct: 6.5,  christianPct: 8.6,  otherPct: 0.2 },
  "Salem":             { urbanity: "semi-urban", literacyPct: 75.4, sexRatio: 954,  hinduPct: 92.6, muslimPct: 4.3,  christianPct: 3.0,  otherPct: 0.1 },
  "Erode":             { urbanity: "semi-urban", literacyPct: 75.3, sexRatio: 996,  hinduPct: 93.2, muslimPct: 3.5,  christianPct: 3.1,  otherPct: 0.2 },
  "Tirunelveli":       { urbanity: "semi-urban", literacyPct: 82.9, sexRatio: 1024, hinduPct: 79.7, muslimPct: 6.0,  christianPct: 14.0, otherPct: 0.3 },
  "Thoothukudi":       { urbanity: "semi-urban", literacyPct: 86.2, sexRatio: 1024, hinduPct: 81.0, muslimPct: 5.3,  christianPct: 13.4, otherPct: 0.3 },
  "Vellore":           { urbanity: "semi-urban", literacyPct: 79.2, sexRatio: 1007, hinduPct: 86.7, muslimPct: 8.7,  christianPct: 4.4,  otherPct: 0.2 },
  "Kanchipuram":       { urbanity: "semi-urban", literacyPct: 84.5, sexRatio: 985,  hinduPct: 89.4, muslimPct: 5.7,  christianPct: 4.6,  otherPct: 0.3 },
  "Kancheepuram":      { urbanity: "semi-urban", literacyPct: 84.5, sexRatio: 985,  hinduPct: 89.4, muslimPct: 5.7,  christianPct: 4.6,  otherPct: 0.3 }, // alt-spelling
  "Tiruvallur":        { urbanity: "semi-urban", literacyPct: 84.0, sexRatio: 987,  hinduPct: 86.7, muslimPct: 6.6,  christianPct: 6.5,  otherPct: 0.2 },
  "Kanniyakumari":     { urbanity: "semi-urban", literacyPct: 91.7, sexRatio: 1014, hinduPct: 48.5, muslimPct: 4.2,  christianPct: 46.9, otherPct: 0.4 },
  "Nilgiris":          { urbanity: "semi-urban", literacyPct: 85.2, sexRatio: 1041, hinduPct: 76.7, muslimPct: 4.6,  christianPct: 18.1, otherPct: 0.6 },

  "Cuddalore":         { urbanity: "rural",      literacyPct: 78.2, sexRatio: 987,  hinduPct: 85.0, muslimPct: 7.5,  christianPct: 7.2,  otherPct: 0.3 },
  "Villupuram":        { urbanity: "rural",      literacyPct: 71.9, sexRatio: 987,  hinduPct: 91.2, muslimPct: 4.5,  christianPct: 4.0,  otherPct: 0.3 },
  "Viluppuram":        { urbanity: "rural",      literacyPct: 71.9, sexRatio: 987,  hinduPct: 91.2, muslimPct: 4.5,  christianPct: 4.0,  otherPct: 0.3 },  // alt-spelling
  "Dindigul":          { urbanity: "rural",      literacyPct: 76.0, sexRatio: 1003, hinduPct: 85.7, muslimPct: 8.2,  christianPct: 5.9,  otherPct: 0.2 },
  "Karur":             { urbanity: "rural",      literacyPct: 75.9, sexRatio: 1014, hinduPct: 92.1, muslimPct: 4.1,  christianPct: 3.6,  otherPct: 0.2 },
  "Namakkal":          { urbanity: "rural",      literacyPct: 73.4, sexRatio: 986,  hinduPct: 91.6, muslimPct: 4.5,  christianPct: 3.7,  otherPct: 0.2 },
  "Pudukkottai":       { urbanity: "rural",      literacyPct: 77.2, sexRatio: 1015, hinduPct: 91.6, muslimPct: 5.3,  christianPct: 2.9,  otherPct: 0.2 },
  "Ramanathapuram":    { urbanity: "rural",      literacyPct: 80.7, sexRatio: 983,  hinduPct: 75.3, muslimPct: 18.8, christianPct: 5.7,  otherPct: 0.2 },
  "Sivaganga":         { urbanity: "rural",      literacyPct: 80.5, sexRatio: 1004, hinduPct: 88.4, muslimPct: 7.3,  christianPct: 4.0,  otherPct: 0.3 },
  "Thanjavur":         { urbanity: "rural",      literacyPct: 82.6, sexRatio: 1031, hinduPct: 87.5, muslimPct: 5.6,  christianPct: 6.6,  otherPct: 0.3 },
  "Thiruvarur":        { urbanity: "rural",      literacyPct: 81.1, sexRatio: 1014, hinduPct: 87.4, muslimPct: 6.7,  christianPct: 5.6,  otherPct: 0.3 },
  "Tiruvarur":         { urbanity: "rural",      literacyPct: 81.1, sexRatio: 1014, hinduPct: 87.4, muslimPct: 6.7,  christianPct: 5.6,  otherPct: 0.3 }, // alt-spelling
  "Nagapattinam":      { urbanity: "rural",      literacyPct: 83.6, sexRatio: 1027, hinduPct: 84.8, muslimPct: 8.0,  christianPct: 6.9,  otherPct: 0.3 },
  "Theni":             { urbanity: "rural",      literacyPct: 76.7, sexRatio: 991,  hinduPct: 91.5, muslimPct: 4.6,  christianPct: 3.7,  otherPct: 0.2 },
  "Virudhunagar":      { urbanity: "rural",      literacyPct: 80.7, sexRatio: 1007, hinduPct: 85.9, muslimPct: 7.3,  christianPct: 6.6,  otherPct: 0.2 },
  "Krishnagiri":       { urbanity: "rural",      literacyPct: 71.5, sexRatio: 959,  hinduPct: 89.0, muslimPct: 5.7,  christianPct: 5.0,  otherPct: 0.3 },
  "Dharmapuri":        { urbanity: "rural",      literacyPct: 64.7, sexRatio: 946,  hinduPct: 91.7, muslimPct: 3.0,  christianPct: 5.0,  otherPct: 0.3 },
  "Tiruvannamalai":    { urbanity: "rural",      literacyPct: 74.2, sexRatio: 994,  hinduPct: 92.6, muslimPct: 5.0,  christianPct: 2.2,  otherPct: 0.2 },
  "Perambalur":        { urbanity: "rural",      literacyPct: 74.6, sexRatio: 1013, hinduPct: 90.2, muslimPct: 4.0,  christianPct: 5.6,  otherPct: 0.2 },
  "Ariyalur":          { urbanity: "rural",      literacyPct: 71.4, sexRatio: 1015, hinduPct: 87.5, muslimPct: 5.0,  christianPct: 7.3,  otherPct: 0.2 },

  // — Post-2011 carve-outs: inherit from parent district —
  "Chengalpattu":      { urbanity: "semi-urban", literacyPct: 84.5, sexRatio: 985,  hinduPct: 89.4, muslimPct: 5.7,  christianPct: 4.6,  otherPct: 0.3, inheritedFrom: "Kancheepuram" },
  "Kallakurichi":      { urbanity: "rural",      literacyPct: 71.9, sexRatio: 987,  hinduPct: 91.2, muslimPct: 4.5,  christianPct: 4.0,  otherPct: 0.3, inheritedFrom: "Villupuram" },
  "Mayiladuthurai":    { urbanity: "rural",      literacyPct: 83.6, sexRatio: 1027, hinduPct: 84.8, muslimPct: 8.0,  christianPct: 6.9,  otherPct: 0.3, inheritedFrom: "Nagapattinam" },
  "Ranipet":           { urbanity: "semi-urban", literacyPct: 79.2, sexRatio: 1007, hinduPct: 86.7, muslimPct: 8.7,  christianPct: 4.4,  otherPct: 0.2, inheritedFrom: "Vellore" },
  "Tenkasi":           { urbanity: "semi-urban", literacyPct: 82.9, sexRatio: 1024, hinduPct: 79.7, muslimPct: 6.0,  christianPct: 14.0, otherPct: 0.3, inheritedFrom: "Tirunelveli" },
  "Tirupattur":        { urbanity: "semi-urban", literacyPct: 79.2, sexRatio: 1007, hinduPct: 86.7, muslimPct: 8.7,  christianPct: 4.4,  otherPct: 0.2, inheritedFrom: "Vellore" },
};

const FALLBACK: DistrictDemographics = {
  urbanity: "rural",
  literacyPct: 0,
  sexRatio: 0,
  hinduPct: 0,
  muslimPct: 0,
  christianPct: 0,
  otherPct: 0,
};

export function demographicsForDistrict(district: string): DistrictDemographics {
  return TN_DISTRICT_DEMOGRAPHICS[district] ?? FALLBACK;
}

// ── Color scales for each demographic mode ─────────────────────────────

/** Three categorical colors for the SC/ST/GEN reservation mode. */
export const RESERVATION_COLORS: Record<string, { color: string; label: string }> = {
  GEN: { color: "#475569", label: "General" },        // slate
  SC:  { color: "#f59e0b", label: "SC reserved" },    // amber
  ST:  { color: "#a855f7", label: "ST reserved" },    // purple
};

/** Three categorical colors for urban / semi-urban / rural. */
export const URBANITY_COLORS: Record<Urbanity, { color: string; label: string }> = {
  "urban":      { color: "#0ea5e9", label: "Urban" },       // sky-500
  "semi-urban": { color: "#22c55e", label: "Semi-urban" },  // green-500
  "rural":      { color: "#84cc16", label: "Rural" },       // lime-500
};

/** Returns a color along a quintile gradient for literacy %. */
export function literacyColor(pct: number): string {
  // 5-step yellow → green gradient
  if (pct === 0) return "rgba(180,200,225,0.32)"; // unknown → pending grey
  if (pct < 70) return "#fde047";  // yellow-300
  if (pct < 76) return "#bef264";  // lime-300
  if (pct < 82) return "#86efac";  // green-300
  if (pct < 88) return "#4ade80";  // green-400
  return "#16a34a";                // green-600
}

export const LITERACY_LEGEND: Array<{ color: string; label: string }> = [
  { color: "#fde047", label: "<70% literate" },
  { color: "#bef264", label: "70–76%" },
  { color: "#86efac", label: "76–82%" },
  { color: "#4ade80", label: "82–88%" },
  { color: "#16a34a", label: "88%+" },
];

/** Returns a color along a 3-step male-skew → balanced → female-skew gradient. */
export function sexRatioColor(ratio: number): string {
  if (ratio === 0) return "rgba(180,200,225,0.32)"; // unknown
  if (ratio < 970) return "#3b82f6";    // blue — male-heavy
  if (ratio < 1000) return "#60a5fa";   // light blue
  if (ratio < 1015) return "#f472b6";   // light pink
  return "#ec4899";                     // strong pink — female-heavy
}

export const SEX_RATIO_LEGEND: Array<{ color: string; label: string }> = [
  { color: "#3b82f6", label: "<970 F/1000 M (M-skew)" },
  { color: "#60a5fa", label: "970–1000" },
  { color: "#f472b6", label: "1000–1015" },
  { color: "#ec4899", label: "1015+ (F-skew)" },
];

// ── Religion overlay (Census 2011, district level) ─────────────────────

/** Color a polygon by the dominant non-Hindu minority (if any) plus a
 *  faint Hindu-majority shading. We don't color "Hindu" prominently
 *  because ~88% of TN is Hindu — it's not informative. The chart
 *  highlights pockets of high Muslim or Christian share, which IS the
 *  relevant signal. */
export function religionColor(d: { hinduPct: number; muslimPct: number; christianPct: number }): string {
  if (d.muslimPct === 0 && d.christianPct === 0) return "rgba(180,200,225,0.32)";
  // 5 buckets per minority — pick the dominant minority and intensity
  const c = d.christianPct;
  const m = d.muslimPct;
  if (c >= 30) return "#a855f7";  // 30%+ Christian — purple, deep
  if (m >= 15) return "#0ea5e9";  // 15%+ Muslim — sky, deep (Ramnad-style)
  if (c >= 15) return "#c084fc";  // 15%+ Christian — purple, mid (Tirunelveli/Tuticorin)
  if (m >= 8)  return "#38bdf8";  // 8–15% Muslim — sky, mid
  if (c >= 8)  return "#d8b4fe";  // 8–15% Christian — purple, light
  if (m >= 5 || c >= 5) return "#cbd5e1"; // mixed Hindu majority with notable minorities
  return "#fde68a";  // ≥95% Hindu — light amber
}

export const RELIGION_LEGEND: Array<{ color: string; label: string }> = [
  { color: "#fde68a", label: "Hindu ≥95%" },
  { color: "#cbd5e1", label: "Hindu majority, mixed" },
  { color: "#d8b4fe", label: "Christian 8–15%" },
  { color: "#38bdf8", label: "Muslim 8–15%" },
  { color: "#c084fc", label: "Christian 15%+" },
  { color: "#0ea5e9", label: "Muslim 15%+" },
  { color: "#a855f7", label: "Christian 30%+" },
];

// ── Community heartland overlay (TIER 2 — academic / journalistic) ─────
// IMPORTANT: This is a regional-pattern classification based on widely-
// discussed TN political geography (CSDS-Lokniti analyses, Frontline /
// The Hindu reportage, sociologist M.S.S. Pandian's writing, journalist
// Rajan Kurai). It is NOT a Census enumeration — caste was last counted
// in 1931. The disclaimer banner in the UI is mandatory whenever this
// mode is active.

export type CommunityHeartland =
  | "nadar"
  | "mukkulathor"
  | "vanniyar"
  | "gounder"
  | "coastal-fisher"
  | "muslim-significant"
  | "christian-significant"
  | "urban-mixed"
  | "mixed";

export const COMMUNITY_COLORS: Record<CommunityHeartland, { color: string; label: string; tooltip: string }> = {
  "nadar":                 { color: "#f97316", label: "Nadar belt",        tooltip: "Nadar community heartland — Hindu and Christian Nadars dominant in southern districts (Kanniyakumari, Tirunelveli, Thoothukudi, Tenkasi, Virudhunagar)" },
  "mukkulathor":           { color: "#14b8a6", label: "Mukkulathor belt",  tooltip: "Mukkulathor (Thevar / Kallar / Maravar / Agamudayar) community heartland — Madurai, Theni, Sivaganga, Ramanathapuram, Pudukkottai" },
  "vanniyar":              { color: "#ec4899", label: "Vanniyar belt",     tooltip: "Vanniyar community heartland — PMK base, northern Tamil Nadu (Cuddalore, Villupuram, Kallakurichi, Tiruvannamalai, Salem, Krishnagiri, Dharmapuri)" },
  "gounder":               { color: "#a16207", label: "Kongu (Gounder)",   tooltip: "Kongu Vellala Gounder heartland — western Tamil Nadu industrial belt (Coimbatore, Tiruppur, Erode, Karur, Namakkal)" },
  "coastal-fisher":        { color: "#06b6d4", label: "Coastal / Fisher",  tooltip: "Coastal districts with significant fishing community presence (Pattanavar / Mukkuvar / Paravar) — Nagapattinam, Thoothukudi coast, Kanniyakumari, Mayiladuthurai" },
  "muslim-significant":    { color: "#0284c7", label: "Muslim-significant",tooltip: "Districts with notably higher Muslim population than TN average — Ramanathapuram, parts of Vellore/Ranipet, urban Chennai pockets" },
  "christian-significant": { color: "#9333ea", label: "Christian-significant", tooltip: "Districts with notably higher Christian population — Kanniyakumari (47%), Nilgiris (18%), Tirunelveli/Thoothukudi (13–14%)" },
  "urban-mixed":           { color: "#64748b", label: "Urban mixed",       tooltip: "Urban districts with mixed community composition — Chennai metropolitan area, Coimbatore city, Madurai city" },
  "mixed":                 { color: "#94a3b8", label: "Mixed",             tooltip: "No single community heartland — multiple groups significant" },
};

/**
 * District → primary community heartland classification. Sources:
 *   - CSDS-Lokniti TN post-poll surveys (2016, 2019, 2021)
 *   - Frontline magazine constituency profiles
 *   - The Hindu / Indian Express constituency reporting
 *   - Sociologist M.S.S. Pandian, "Brahmin & Non-Brahmin: Genealogies
 *     of the Tamil Political Present" (2007)
 *   - Hugo Gorringe (2005), "Untouchable Citizens"
 *   - Wikipedia constituency pages with cited sources
 *
 * THIS DATA IS INDICATIVE, NOT AUTHORITATIVE. Caste demographics at
 * AC-level have not been formally enumerated since 1931. Anchors should
 * always say "this region is associated with the X community" or
 * "X-leaning area" rather than treating the label as a Census fact.
 */
export const TN_DISTRICT_COMMUNITY: Record<string, CommunityHeartland> = {
  // Chennai metro — urban mixed (heavy in-migration from all communities)
  "Chennai":          "urban-mixed",
  "Tiruvallur":       "urban-mixed",
  "Kancheepuram":     "urban-mixed",
  "Kanchipuram":      "urban-mixed",
  "Chengalpattu":     "urban-mixed",

  // North TN — Vanniyar belt (PMK heartland)
  "Vellore":          "vanniyar",
  "Ranipet":          "vanniyar",
  "Tirupattur":       "vanniyar",
  "Tiruvannamalai":   "vanniyar",
  "Krishnagiri":      "vanniyar",
  "Dharmapuri":       "vanniyar",
  "Cuddalore":        "vanniyar",
  "Villupuram":       "vanniyar",
  "Viluppuram":       "vanniyar",
  "Kallakurichi":     "vanniyar",
  "Salem":            "vanniyar", // Salem also has Gounder presence — Vanniyar dominant in north
  "Perambalur":       "vanniyar",

  // Kongu belt — Gounder
  "Coimbatore":       "gounder",
  "Tiruppur":         "gounder",
  "Erode":            "gounder",
  "Karur":            "gounder",
  "Namakkal":         "gounder",

  // Central / Cauvery delta — Mixed (Brahmin pockets, mukkulathor border, fisher coastal)
  "Tiruchirappalli":  "mixed",
  "Ariyalur":         "mixed",
  "Thanjavur":        "mixed",
  "Tiruvarur":        "mixed",
  "Thiruvarur":       "mixed",

  // Coastal-fisher dominant (where the fishing community is the political identity)
  "Nagapattinam":     "coastal-fisher",
  "Mayiladuthurai":   "coastal-fisher",

  // Madurai region — Mukkulathor heartland
  "Madurai":          "mukkulathor",
  "Theni":            "mukkulathor",
  "Sivaganga":        "mukkulathor",
  "Pudukkottai":      "mukkulathor",
  "Dindigul":         "mukkulathor",

  // Ramanathapuram — Muslim-significant + Mukkulathor coast
  "Ramanathapuram":   "muslim-significant",

  // Southern TN — Nadar belt
  "Virudhunagar":     "nadar",
  "Tirunelveli":      "nadar",
  "Tenkasi":          "nadar",
  "Thoothukudi":      "nadar",

  // Christian-significant — Kanniyakumari and Nilgiris
  "Kanniyakumari":    "christian-significant",
  "Nilgiris":         "christian-significant",
};

export function communityForDistrict(district: string): CommunityHeartland {
  return TN_DISTRICT_COMMUNITY[district] ?? "mixed";
}

export function communityColor(district: string): string {
  return COMMUNITY_COLORS[communityForDistrict(district)].color;
}
