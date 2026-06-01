/**
 * Tamil Nadu regional bloc grouping for the home-page regional tally.
 *
 * TN journalism / political analysis has long-standing region names
 * (North, Central / Cauvery delta, Kongu, South, Chennai metro) — the
 * AC-by-AC numbers don't tell the whole story without these. The
 * grouping below is the standard one used by The Hindu / Frontline /
 * Times of India in their constituency-belt analyses.
 *
 * Mapping is at DISTRICT level so it stays stable even as new districts
 * are carved out (post-2011 spin-offs inherit the parent region).
 */

export type RegionId =
  | "chennai"
  | "north"
  | "kongu"
  | "central"
  | "delta"
  | "south";

export const REGION_LABELS: Record<RegionId, { label: string; short: string; color: string; description: string }> = {
  chennai: {
    label: "Chennai metro",
    short: "Chennai",
    color: "#a855f7",
    description: "Chennai + suburbs (Tiruvallur, Kancheepuram, Chengalpattu)",
  },
  north: {
    label: "Northern TN",
    short: "North",
    color: "#ec4899",
    description: "Vellore-Salem-Dharmapuri belt — Vanniyar / PMK heartland",
  },
  kongu: {
    label: "Kongu (West)",
    short: "Kongu",
    color: "#a16207",
    description: "Coimbatore-Tiruppur-Erode-Salem industrial belt — Gounder",
  },
  central: {
    label: "Central TN",
    short: "Central",
    color: "#06b6d4",
    description: "Trichy-Karur-Ariyalur-Perambalur",
  },
  delta: {
    label: "Cauvery delta",
    short: "Delta",
    color: "#22c55e",
    description: "Thanjavur-Tiruvarur-Nagapattinam-Mayiladuthurai",
  },
  south: {
    label: "Southern TN",
    short: "South",
    color: "#f97316",
    description: "Madurai-Tirunelveli-Kanniyakumari belt + coastal southern districts",
  },
};

const TN_DISTRICT_REGION: Record<string, RegionId> = {
  // Chennai metro
  "Chennai": "chennai",
  "Tiruvallur": "chennai",
  "Kancheepuram": "chennai",
  "Kanchipuram": "chennai",
  "Chengalpattu": "chennai",

  // Northern TN — Vanniyar / hill country
  "Vellore": "north",
  "Ranipet": "north",
  "Tirupattur": "north",
  "Tiruvannamalai": "north",
  "Krishnagiri": "north",
  "Dharmapuri": "north",
  "Cuddalore": "north",
  "Villupuram": "north",
  "Viluppuram": "north",
  "Kallakurichi": "north",

  // Kongu — Western industrial belt
  "Salem": "kongu",
  "Namakkal": "kongu",
  "Coimbatore": "kongu",
  "Tiruppur": "kongu",
  "Erode": "kongu",
  "Karur": "kongu",
  "Nilgiris": "kongu",

  // Central TN — Trichy bowl
  "Tiruchirappalli": "central",
  "Perambalur": "central",
  "Ariyalur": "central",
  "Pudukkottai": "central",

  // Cauvery delta
  "Thanjavur": "delta",
  "Tiruvarur": "delta",
  "Thiruvarur": "delta",
  "Nagapattinam": "delta",
  "Mayiladuthurai": "delta",

  // Southern TN — Madurai region + far south
  "Madurai": "south",
  "Theni": "south",
  "Dindigul": "south",
  "Sivaganga": "south",
  "Ramanathapuram": "south",
  "Virudhunagar": "south",
  "Tirunelveli": "south",
  "Tenkasi": "south",
  "Thoothukudi": "south",
  "Kanniyakumari": "south",
};

export function regionForDistrict(district: string): RegionId {
  return TN_DISTRICT_REGION[district] ?? "central";
}

export const ALL_REGIONS: RegionId[] = ["chennai", "north", "kongu", "central", "delta", "south"];
