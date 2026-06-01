"use client";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { cn } from "@/lib/cn";

const TEMPLATE_STYLES: Record<
  string,
  { labelKey: string; bg: string; accent: string; text: string }
> = {
  BREAKING: {
    labelKey: "chyron.breaking",
    bg: "bg-gradient-to-r from-[#dc2626] via-[#b91c1c] to-[#991b1b]",
    accent: "bg-yellow-400 text-black",
    text: "text-white",
  },
  CALL: {
    labelKey: "chyron.call",
    bg: "bg-gradient-to-r from-[#10b981] via-[#059669] to-[#047857]",
    accent: "bg-black text-white",
    text: "text-white",
  },
  MILESTONE: {
    labelKey: "chyron.milestone",
    bg: "bg-gradient-to-r from-[#f59e0b] via-[#d97706] to-[#b45309]",
    accent: "bg-black text-yellow-300",
    text: "text-black",
  },
  QUOTE: {
    labelKey: "chyron.quote",
    bg: "bg-gradient-to-r from-[#0c1e4a] via-[#10286b] to-[#0c1e4a]",
    accent: "bg-yellow-400 text-black",
    text: "text-white",
  },
};

export function ChyronOverlay() {
  const { chyron } = useLiveData();
  const { t } = useLocale();
  if (!chyron) return null;
  const style = TEMPLATE_STYLES[chyron.template] ?? TEMPLATE_STYLES.BREAKING;

  return (
    <div className="fixed left-0 right-0 bottom-6 z-50 px-6 pointer-events-none animate-[chyronIn_400ms_ease-out]">
      <div
        className={cn(
          "max-w-[90%] mx-auto rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex items-center overflow-hidden border-2 border-white/15",
          style.bg,
          style.text,
        )}
      >
        <div
          className={cn(
            "px-5 py-4 font-black uppercase tracking-[0.3em] text-base shrink-0",
            style.accent,
          )}
        >
          {t(style.labelKey)}
        </div>
        <div className="flex-1 px-6 py-3 min-w-0">
          <div className="font-black text-2xl uppercase leading-tight tracking-wide truncate">
            {chyron.headline}
          </div>
          {chyron.subhead && (
            <div className="text-sm uppercase tracking-widest opacity-90 truncate">
              {chyron.subhead}
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        @keyframes chyronIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
