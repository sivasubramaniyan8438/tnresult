"use client";
import { useState } from "react";
import { useLiveData } from "./LiveDataProvider";
import { cn } from "@/lib/cn";

const TEMPLATES: Array<{ id: "BREAKING" | "CALL" | "MILESTONE" | "QUOTE"; label: string; color: string; hotkey: string }> = [
  { id: "BREAKING", label: "Breaking", color: "#dc2626", hotkey: "B" },
  { id: "CALL", label: "Key Call", color: "#10b981", hotkey: "C" },
  { id: "MILESTONE", label: "Milestone", color: "#f59e0b", hotkey: "M" },
  { id: "QUOTE", label: "Quote", color: "#3b82f6", hotkey: "Q" },
];

export function ChyronComposer() {
  const { chyron } = useLiveData();
  const [template, setTemplate] = useState<"BREAKING" | "CALL" | "MILESTONE" | "QUOTE">("BREAKING");
  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");
  const [duration, setDuration] = useState(8000);
  const [busy, setBusy] = useState(false);

  async function fire() {
    if (!headline.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/chyron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, headline, subhead, durationMs: duration }),
      });
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await fetch("/api/chyron", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Chyron composer
        </h3>
        {chyron && (
          <button
            onClick={clear}
            className="text-xs px-2 py-1 rounded bg-[var(--accent-live)]/20 hover:bg-[var(--accent-live)]/30 border border-[var(--accent-live)]/40 text-[var(--accent-live)] uppercase font-bold tracking-wider"
          >
            Clear on-air
          </button>
        )}
      </div>
      {chyron && (
        <div className="text-[10px] uppercase tracking-widest text-[var(--accent-counting)] mb-3 bg-[var(--accent-counting)]/10 border border-[var(--accent-counting)]/40 rounded px-2 py-1">
          On-air now: {chyron.template} · {chyron.headline}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplate(t.id)}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-colors",
            )}
            style={{
              background: template === t.id ? t.color : `${t.color}15`,
              borderColor: template === t.id ? t.color : `${t.color}40`,
              color: template === t.id ? "white" : t.color,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Headline (e.g. STALIN SET TO RETURN AS CM)"
        value={headline}
        onChange={(e) => setHeadline(e.target.value.toUpperCase())}
        className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none mb-2 uppercase tracking-wide font-bold"
      />
      <input
        type="text"
        placeholder="Sub-head (optional)"
        value={subhead}
        onChange={(e) => setSubhead(e.target.value)}
        className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none mb-3"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">
          Duration
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 8000)}
            className="ml-2 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 w-20 text-right tabular"
          />
          <span className="text-[var(--text-muted)] ml-1">ms</span>
        </label>
        <button
          onClick={fire}
          disabled={busy || !headline.trim()}
          className="ml-auto px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest text-sm disabled:opacity-50"
        >
          {busy ? "Firing…" : "Fire on-air ↗"}
        </button>
      </div>
    </div>
  );
}
