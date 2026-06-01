"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveData } from "./LiveDataProvider";
import { useLocale } from "./LocaleProvider";
import { SCENES } from "@/lib/scenes";
import { PARTIES, partyById } from "@/lib/parties";
import { cn , formatIndian} from "@/lib/cn";

type Item = {
  id: string;
  label: string;
  hint?: string;
  type: "scene" | "constituency" | "candidate" | "party" | "action";
  icon?: string;
  href: string;
  color?: string;
};

export function CommandPalette() {
  const router = useRouter();
  const { constituencies } = useLiveData();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build full index
  const items = useMemo<Item[]>(() => {
    const all: Item[] = [];
    for (const s of SCENES) {
      all.push({
        id: `scene:${s.id}`,
        label: `Scene · ${s.label}`,
        hint: `${s.description} · Alt+${s.hotkey}`,
        type: "scene",
        icon: "🎬",
        href: `/broadcast?scene=${s.id}`,
      });
    }
    for (const c of constituencies) {
      const lead = c.leadingCandidate;
      const party = lead ? partyById(lead.partyId) : null;
      all.push({
        id: `con:${c.constituencyId}`,
        label: c.constituencyName,
        hint: `AC#${c.constituencyId} · ${c.district}${
          lead ? ` · ${party?.name} +${formatIndian(lead.margin)}` : ""
        }`,
        type: "constituency",
        icon: "📍",
        href: `/broadcast/ac/${c.constituencyId}`,
        color: party?.color,
      });
      if (lead) {
        all.push({
          id: `cand:${c.constituencyId}`,
          label: lead.name,
          hint: `${party?.name} · ${c.constituencyName}`,
          type: "candidate",
          icon: "👤",
          href: `/broadcast/ac/${c.constituencyId}`,
          color: party?.color,
        });
      }
    }
    for (const p of PARTIES) {
      all.push({
        id: `party:${p.id}`,
        label: p.name,
        hint: p.fullName,
        type: "party",
        icon: "🏛️",
        href: `/parties#${p.id}`,
        color: p.color,
      });
    }
    all.push({
      id: "action:home",
      label: "Go to overview",
      hint: "Main dashboard",
      type: "action",
      icon: "🏠",
      href: "/",
    });
    all.push({
      id: "action:constituencies",
      label: "All constituencies",
      hint: "Browse all 234 ACs",
      type: "action",
      icon: "📋",
      href: "/constituencies",
    });
    all.push({
      id: "action:admin",
      label: "Admin console",
      hint: "Simulator + manual override",
      type: "action",
      icon: "🛠️",
      href: "/admin",
    });
    all.push({
      id: "action:broadcast",
      label: "Broadcast view",
      hint: "OBS-friendly overlay",
      type: "action",
      icon: "📺",
      href: "/broadcast",
    });
    return all;
  }, [constituencies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    const scored = items
      .map((it) => {
        const hay = `${it.label} ${it.hint ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return null;
        // Score: exact label match > startsWith > contains
        let score = 0;
        if (it.label.toLowerCase() === q) score = 100;
        else if (it.label.toLowerCase().startsWith(q)) score = 60;
        else if (it.label.toLowerCase().includes(q)) score = 40;
        else score = 20;
        // Boost scenes
        if (it.type === "scene") score += 5;
        return { it, score };
      })
      .filter(Boolean) as { it: Item; score: number }[];
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30).map((x) => x.it);
  }, [items, query]);

  // Keyboard: Cmd+K to open, navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      // Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" to open (but not in fields)
      if (e.key === "/" && !inField && !open) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // Esc to close
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset on open + focus input
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  function selectItem(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIdx];
      if (item) selectItem(item);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] backdrop-blur-md bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <span className="text-[var(--text-muted)]">⌘K</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t("palette.placeholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onInputKey}
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-[var(--text-muted)]"
          />
          <kbd className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
              {t("palette.empty")}
            </div>
          ) : (
            <ul>
              {filtered.map((it, i) => (
                <li key={it.id}>
                  <button
                    onClick={() => selectItem(it)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-[var(--border)]/50 last:border-b-0",
                      activeIdx === i && "bg-[var(--bg-card-hover)]",
                    )}
                  >
                    <span className="text-base shrink-0">{it.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-semibold truncate"
                        style={{ color: it.color ?? "var(--text-primary)" }}
                      >
                        {it.label}
                      </div>
                      {it.hint && (
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {it.hint}
                        </div>
                      )}
                    </div>
                    <span
                      className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] shrink-0"
                    >
                      {it.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--text-muted)] flex justify-between">
          <span>↑↓ navigate · ↵ select</span>
          <span>{filtered.length} matches</span>
        </div>
      </div>
    </div>
  );
}
