/**
 * Multi-tenant branding. Each tenant gets their own logo + channel name +
 * tagline + accent colours; data is shared across tenants (same TN counting
 * results for everyone). The ProxyN.ai engineering credit stays constant —
 * it's our co-brand, not the tenant's.
 *
 * Add a tenant: drop a logo into /public/tenants/<id>.{jpg,png} and add a
 * row below. Set `AUTH_<ID_UPPER>_PASSWORD` env var on Railway to enable
 * login for that tenant.
 */

export type Tenant = {
  id: string;
  channelName: string;
  channelTagline: string;
  logoSrc: string;
  channelAccent: string;
  channelAccentDark: string;
  /** Co-brand stays constant across tenants but exposed here for completeness. */
  developerName: string;
  developerTagline: string;
  developerUrl: string;
  developerAccent: string;
  developerAccentDark: string;
};

const COMMON_DEVELOPER = {
  developerName: "ProxyN.ai",
  developerTagline: "Agentic Ops for SAP",
  developerUrl: "https://ProxyN.ai",
  developerAccent: "#6366f1",
  developerAccentDark: "#312e81",
};

export const TENANTS: Record<string, Tenant> = {
  naadhas: {
    id: "naadhas",
    channelName: "Naadhas Media",
    channelTagline: "Voice of People",
    logoSrc: "/tenants/naadhas.png",
    channelAccent: "#3a8c93",
    channelAccentDark: "#1f5a60",
    ...COMMON_DEVELOPER,
  },
  aadhan: {
    id: "aadhan",
    channelName: "Aadhan Tamil",
    channelTagline: "News in Pocket",
    logoSrc: "/tenants/aadhan.jpg",
    // Picked to contrast with Naadhas teal — Aadhan's brand is closer to red/black.
    channelAccent: "#dc2626",
    channelAccentDark: "#7f1d1d",
    ...COMMON_DEVELOPER,
  },
};

/** Default tenant — used on /login and as a fallback. */
export const DEFAULT_TENANT_ID = "naadhas";

export function getTenant(id: string | null | undefined): Tenant {
  if (!id) return TENANTS[DEFAULT_TENANT_ID];
  return TENANTS[id] ?? TENANTS[DEFAULT_TENANT_ID];
}

export function isValidTenantId(id: string | null | undefined): id is string {
  return !!id && id in TENANTS;
}

export const TENANT_IDS = Object.keys(TENANTS);
