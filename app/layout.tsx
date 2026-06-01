import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getStateSummary, getConstituencySummaries } from "@/lib/queries";
import { LiveDataProvider } from "@/components/LiveDataProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { HeaderBar } from "@/components/HeaderBar";
import { PersistentLeaderStrip } from "@/components/PersistentLeaderStrip";
import { CommandPalette } from "@/components/CommandPalette";
import { ChyronOverlay } from "@/components/ChyronOverlay";
import { TenantProvider } from "@/components/TenantProvider";
import {
  SESSION_COOKIE_NAME,
  verifyTenantSession,
} from "@/lib/session";

export const metadata: Metadata = {
  title: "TN Election Results 2026 — Live",
  description:
    "Live results for the 2026 Tamil Nadu Legislative Assembly elections. Real-time data via SSE.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialState = getStateSummary();
  const initialConstituencies = getConstituencySummaries();
  const cookieStore = await cookies();
  const tenantId = await verifyTenantSession(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
  );

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TenantProvider tenantId={tenantId}>
        <LocaleProvider>
        <LiveDataProvider
          initialState={initialState}
          initialConstituencies={initialConstituencies}
        >
          <CommandPalette />
          <ChyronOverlay />
          <HeaderBar />
          <PersistentLeaderStrip />
          <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </main>
          <footer className="hide-on-broadcast border-t border-[var(--border)] mt-12 py-6 text-center text-xs text-[var(--text-muted)]">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span>
                Source: <span className="font-mono">results.eci.gov.in</span>
              </span>
              <span>·</span>
              <a
                href="/about"
                className="underline hover:text-[var(--text-primary)] transition-colors"
              >
                About this dashboard
              </a>
              <span>·</span>
              <span>Updates via SSE every ~30s</span>
            </div>
            <div className="mt-1">
              Live coverage of TN 2026 Assembly Elections — Naadhas Media · Powered by ProxyN.ai
            </div>
          </footer>
        </LiveDataProvider>
        </LocaleProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
