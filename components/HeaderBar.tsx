"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, formatTimeAgo } from "@/lib/cn";
import { LiveClock } from "./LiveClock";
import { PulseDot } from "./PulseDot";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { LanguageToggle } from "./LanguageToggle";
import { useTenant } from "./TenantProvider";
import { useEffect, useState } from "react";

export function HeaderBar() {
  const pathname = usePathname();
  const { connected, state } = useLiveData();
  const { t } = useLocale();
  const BRAND = useTenant();
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const NAV = [
    { href: "/", label: t("nav.overview") },
    { href: "/constituencies", label: t("nav.constituencies") },
    { href: "/parties", label: t("nav.parties") },
    { href: "/anchor", label: t("nav.anchor") },
    { href: "/admin", label: t("nav.admin") },
    { href: "/broadcast/admin", label: t("nav.broadcastAdmin") },
    { href: "/broadcast", label: t("nav.broadcast") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-base)]/85 backdrop-blur-xl hide-on-broadcast">
      <a
        href={BRAND.developerUrl}
        target="_blank"
        rel="noreferrer"
        className="block bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] border-b border-white/10 hover:brightness-125 transition-all"
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
            Powered by
          </span>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded font-black text-sm sm:text-base shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${BRAND.developerAccent} 0%, ${BRAND.developerAccentDark} 100%)`,
                color: "white",
              }}
            >
              {BRAND.developerName}
            </span>
            <span className="text-xs uppercase tracking-widest text-white/70 hidden sm:inline">
              {BRAND.developerTagline}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            proxyn.ai →
          </span>
        </div>
      </a>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logoSrc}
            alt={BRAND.channelName}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-[var(--border)] group-hover:ring-[var(--accent-lead)] transition-all"
          />
          <div className="leading-tight min-w-0">
            <div className="font-bold text-sm sm:text-base group-hover:text-[var(--accent-lead)] transition-colors">
              {BRAND.channelName}
            </div>
            {/* On mobile show short subtitle so Tamil/long brand strings don't truncate to "தமி..." */}
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] hidden sm:block">
              {t("header.brand")} · {t("header.subtitle")}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] sm:hidden">
              {t("header.subtitle")}
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 ml-auto sm:ml-4">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/60",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          <LanguageToggle />
          <div className="flex items-center gap-2 text-xs">
            <PulseDot color={connected ? "var(--accent-live)" : "var(--text-muted)"} />
            <span className="font-bold uppercase tracking-wider">
              {connected ? t("header.live") : t("header.offline")}
            </span>
            {state?.lastUpdate ? (
              <span className="text-[var(--text-muted)] hidden sm:inline">
                · {t("header.updated")} {formatTimeAgo(state.lastUpdate)}
              </span>
            ) : null}
          </div>
          <LiveClock className="text-sm font-mono tabular text-[var(--text-secondary)] hidden md:inline" />
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
