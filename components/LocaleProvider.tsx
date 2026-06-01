"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  type Locale,
  t as tFn,
  tParty as tPartyFn,
  tPartyFull as tPartyFullFn,
  tPartyLeader as tPartyLeaderFn,
  tAlliance as tAllianceFn,
  tAllianceById as tAllianceByIdFn,
  tConstituency as tConstituencyFn,
  tDistrict as tDistrictFn,
  tStatus as tStatusFn,
  tSceneLabel as tSceneLabelFn,
  tChyronTemplate as tChyronTemplateFn,
} from "@/lib/i18n";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tParty: (partyId: string, fallback: string) => string;
  tPartyFull: (partyId: string, fallback: string) => string;
  tPartyLeader: (partyId: string, fallback?: string) => string;
  tAlliance: (partyId: string, fallback: string) => string;
  tAllianceById: (id: string, fallback: string) => string;
  tConstituency: (id: number, fallback: string) => string;
  tDistrict: (name: string) => string;
  tStatus: (status: string) => string;
  tScene: (sceneId: string) => string;
  tChyron: (template: string) => string;
};

const LocaleCtx = createContext<Ctx | null>(null);

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) {
    // Sensible defaults if used outside the provider (e.g. in storybook)
    const locale: Locale = "en";
    return {
      locale,
      setLocale: () => {},
      t: (k: string, r?: Record<string, string | number>) => tFn(k, locale, r),
      tParty: (id: string, f: string) => tPartyFn(id, locale, f),
      tPartyFull: (id: string, f: string) => tPartyFullFn(id, locale, f),
      tPartyLeader: (id: string, f?: string) => tPartyLeaderFn(id, locale, f),
      tAlliance: (id: string, f: string) => tAllianceFn(id, locale, f),
      tAllianceById: (id: string, f: string) => tAllianceByIdFn(id, locale, f),
      tConstituency: (id: number, f: string) => tConstituencyFn(id, locale, f),
      tDistrict: (name: string) => tDistrictFn(name, locale),
      tStatus: (s: string) => tStatusFn(s, locale),
      tScene: (s: string) => tSceneLabelFn(s, locale),
      tChyron: (s: string) => tChyronTemplateFn(s, locale),
    };
  }
  return ctx;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Read localStorage SYNCHRONOUSLY on first client render to avoid the prior
  // race where an "en" writeback effect would overwrite a saved "ta" before
  // the read effect could apply it. SSR still defaults to 'en' (no window).
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("tn-locale");
    return saved === "ta" || saved === "en" ? saved : "en";
  });
  const [hydrated, setHydrated] = useState(false);

  // Once we know the client value, re-pick from localStorage in case React
  // hydrated with the SSR default. After hydration, all writes flush normally.
  useEffect(() => {
    const saved = window.localStorage.getItem("tn-locale");
    if ((saved === "ta" || saved === "en") && saved !== locale) {
      setLocaleState(saved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale;
    window.localStorage.setItem("tn-locale", locale);
  }, [locale, hydrated]);

  const value: Ctx = {
    locale,
    setLocale: setLocaleState,
    t: (k, r) => tFn(k, locale, r),
    tParty: (id, f) => tPartyFn(id, locale, f),
    tPartyFull: (id, f) => tPartyFullFn(id, locale, f),
    tPartyLeader: (id, f) => tPartyLeaderFn(id, locale, f),
    tAlliance: (id, f) => tAllianceFn(id, locale, f),
    tAllianceById: (id, f) => tAllianceByIdFn(id, locale, f),
    tConstituency: (id, f) => tConstituencyFn(id, locale, f),
    tDistrict: (name) => tDistrictFn(name, locale),
    tStatus: (s) => tStatusFn(s, locale),
    tScene: (s) => tSceneLabelFn(s, locale),
    tChyron: (s) => tChyronTemplateFn(s, locale),
  };

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}
