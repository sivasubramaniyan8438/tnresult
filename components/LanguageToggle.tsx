"use client";
import { useLocale } from "./LocaleProvider";
import { LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  return (
    <div
      className={cn(
        "inline-flex bg-black/40 border border-white/20 rounded-md overflow-hidden shadow-sm",
        compact ? "text-[11px]" : "text-xs",
      )}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l.id}
          onClick={() => setLocale(l.id)}
          className={cn(
            "font-black uppercase tracking-wider transition-all",
            compact ? "px-2 py-0.5" : "px-2.5 py-1",
            locale === l.id
              ? "bg-amber-400 text-black"
              : "text-white/60 hover:bg-white/10 hover:text-white",
          )}
          title={l.label}
          aria-pressed={locale === l.id}
        >
          {l.id === "ta" ? l.nativeLabel : l.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
