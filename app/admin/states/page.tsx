"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { OtherState, OtherStatePartyRow } from "@/lib/states";

/**
 * Counting-day data entry for non-TN states.
 *
 * Operator workflow:
 *   - Numbers auto-save on blur OR when Enter is pressed (no Save click).
 *   - +/− stepper buttons next to total/delta for one-tap adjustments.
 *   - "Add state" pulls from a preset list (Kerala / WB / PY / etc.) so the
 *     party rows pre-populate with the right alliance shorthand.
 *   - Saved-flash beside each state row, plus a global activity ribbon
 *     at the top so the team can see which state was last touched.
 *
 * Broadcast view at /broadcast/multi-state polls /api/states every 8 s,
 * so changes appear on air within ~10 s of saving.
 */

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

const PRESET_STATES: Array<Omit<OtherState, "updatedAt">> = [
  {
    id: "KL",
    name: "Kerala",
    totalSeats: 140,
    reportingSeats: 0,
    sequence: 1,
    parties: [
      { partyId: "LDF", label: "LDF+", total: 0, delta: 0, color: "#dc2626" },
      { partyId: "UDF", label: "UDF+", total: 0, delta: 0, color: "#0891b2" },
      { partyId: "NDA", label: "NDA+", total: 0, delta: 0, color: "#f97316" },
      { partyId: "OTH", label: "OTH",  total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "WB",
    name: "West Bengal",
    totalSeats: 294,
    reportingSeats: 0,
    sequence: 2,
    parties: [
      { partyId: "TMC",  label: "TMC",   total: 0, delta: 0, color: "#16a34a" },
      { partyId: "BJP",  label: "BJP+",  total: 0, delta: 0, color: "#f97316" },
      { partyId: "LEFT", label: "LEFT+", total: 0, delta: 0, color: "#dc2626" },
      { partyId: "OTH",  label: "OTH",   total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "PY",
    name: "Puducherry",
    totalSeats: 30,
    reportingSeats: 0,
    sequence: 3,
    parties: [
      { partyId: "NDA", label: "NDA+", total: 0, delta: 0, color: "#f97316" },
      { partyId: "INC", label: "INC+", total: 0, delta: 0, color: "#2563eb" },
      { partyId: "OTH", label: "OTH",  total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "AS",
    name: "Assam",
    totalSeats: 126,
    reportingSeats: 0,
    sequence: 4,
    parties: [
      { partyId: "BJP", label: "BJP+", total: 0, delta: 0, color: "#f97316" },
      { partyId: "INC", label: "INC+", total: 0, delta: 0, color: "#2563eb" },
      { partyId: "OTH", label: "OTH",  total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
  {
    id: "KA",
    name: "Karnataka",
    totalSeats: 224,
    reportingSeats: 0,
    sequence: 5,
    parties: [
      { partyId: "INC", label: "INC+", total: 0, delta: 0, color: "#2563eb" },
      { partyId: "BJP", label: "BJP+", total: 0, delta: 0, color: "#f97316" },
      { partyId: "JDS", label: "JDS",  total: 0, delta: 0, color: "#16a34a" },
      { partyId: "OTH", label: "OTH",  total: 0, delta: 0, color: "#94a3b8" },
    ],
  },
];

export default function AdminStatesPage() {
  const [states, setStates] = useState<OtherState[]>([]);
  const [token, setToken] = useState<string>("");
  const [statusById, setStatusById] = useState<Record<string, SaveStatus>>({});
  const [activity, setActivity] = useState<{ stateId: string; what: string; at: number } | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const reload = useCallback(async () => {
    const r = await fetch("/api/states");
    const d = await r.json();
    setStates((d.states ?? []) as OtherState[]);
  }, []);

  useEffect(() => {
    reload();
    setToken(localStorage.getItem("tn-admin-token") ?? "");
  }, [reload]);

  const save = useCallback(
    async (s: OtherState, label: string) => {
      setStatusById((m) => ({ ...m, [s.id]: "saving" }));
      try {
        const res = await fetch("/api/admin/states", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(s),
        });
        if (!res.ok) {
          setStatusById((m) => ({ ...m, [s.id]: "error" }));
          return;
        }
        setStatusById((m) => ({ ...m, [s.id]: "saved" }));
        setActivity({ stateId: s.id, what: label, at: Date.now() });
        setTimeout(
          () =>
            setStatusById((m) => (m[s.id] === "saved" ? { ...m, [s.id]: "idle" } : m)),
          1800,
        );
      } catch {
        setStatusById((m) => ({ ...m, [s.id]: "error" }));
      }
    },
    [token],
  );

  // Debounced save when the user stops typing
  const queueSave = useCallback(
    (s: OtherState, label: string) => {
      setStatusById((m) => ({ ...m, [s.id]: "pending" }));
      if (debounceRef.current[s.id]) clearTimeout(debounceRef.current[s.id]);
      debounceRef.current[s.id] = setTimeout(() => save(s, label), 800);
    },
    [save],
  );

  // Local edits — patch state, then queue a debounced save
  const patchState = (
    id: string,
    patch: Partial<OtherState>,
    label: string,
  ) => {
    setStates((cur) => {
      const next = cur.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const updated = next.find((s) => s.id === id);
      if (updated) queueSave(updated, label);
      return next;
    });
  };

  const patchParty = (
    stateId: string,
    idx: number,
    patch: Partial<OtherStatePartyRow>,
    label: string,
  ) => {
    setStates((cur) => {
      const next = cur.map((s) =>
        s.id === stateId
          ? {
              ...s,
              parties: s.parties.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
            }
          : s,
      );
      const updated = next.find((s) => s.id === stateId);
      if (updated) queueSave(updated, label);
      return next;
    });
  };

  const addParty = (stateId: string) => {
    setStates((cur) => {
      const next = cur.map((s) =>
        s.id === stateId
          ? {
              ...s,
              parties: [
                ...s.parties,
                { partyId: "OTH", label: "OTH", total: 0, delta: 0, color: "#94a3b8" },
              ],
            }
          : s,
      );
      const updated = next.find((s) => s.id === stateId);
      if (updated) queueSave(updated, "+ party row");
      return next;
    });
  };

  const removeParty = (stateId: string, idx: number) => {
    setStates((cur) => {
      const next = cur.map((s) =>
        s.id === stateId
          ? { ...s, parties: s.parties.filter((_, i) => i !== idx) }
          : s,
      );
      const updated = next.find((s) => s.id === stateId);
      if (updated) queueSave(updated, "− party row");
      return next;
    });
  };

  const resetStateZeros = async (id: string) => {
    if (!confirm(`Reset ${id} totals + delta to zero?`)) return;
    setStates((cur) => {
      const next = cur.map((s) =>
        s.id === id
          ? {
              ...s,
              reportingSeats: 0,
              parties: s.parties.map((p) => ({ ...p, total: 0, delta: 0 })),
            }
          : s,
      );
      const updated = next.find((s) => s.id === id);
      if (updated) save(updated, "reset zeros");
      return next;
    });
  };

  const removeState = async (id: string) => {
    if (!confirm(`Remove ${id}?`)) return;
    await fetch(`/api/admin/states?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    reload();
  };

  const addPreset = async (preset: Omit<OtherState, "updatedAt">) => {
    if (states.find((s) => s.id === preset.id)) {
      alert(`${preset.id} already exists`);
      return;
    }
    const fresh = { ...preset, sequence: states.length + 1 };
    await fetch("/api/admin/states", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(fresh),
    });
    reload();
    setActivity({ stateId: preset.id, what: "added from preset", at: Date.now() });
  };

  const addCustom = async () => {
    const id = (prompt("State ID (2 letters, e.g. ML, OD)") ?? "").trim().toUpperCase();
    if (!id) return;
    const name = (prompt("State name") ?? "").trim();
    if (!name) return;
    const totalSeats = Number(prompt("Total seats", "100") ?? "100");
    const fresh: Omit<OtherState, "updatedAt"> = {
      id,
      name,
      totalSeats: Math.max(1, totalSeats),
      reportingSeats: 0,
      sequence: states.length + 1,
      parties: [
        { partyId: "BJP", label: "BJP+", total: 0, delta: 0, color: "#f97316" },
        { partyId: "INC", label: "INC+", total: 0, delta: 0, color: "#2563eb" },
        { partyId: "OTH", label: "OTH", total: 0, delta: 0, color: "#94a3b8" },
      ],
    };
    await fetch("/api/admin/states", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(fresh),
    });
    reload();
  };

  const presetsAvailable = PRESET_STATES.filter(
    (p) => !states.find((s) => s.id === p.id),
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto py-2">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Multi-state broadcast
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Other states · party totals
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-prose">
            Numbers auto-save on blur or Enter. Broadcast view{" "}
            <Link
              href="/broadcast/multi-state"
              className="text-[var(--accent-lead)] hover:underline"
            >
              /broadcast/multi-state
            </Link>{" "}
            polls every 8 s — your edit appears on air within 10 seconds. TN
            renders live from constituency data and isn&apos;t edited here.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link
            href="/admin"
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            ← Main admin
          </Link>
          <input
            type="password"
            placeholder="ADMIN_TOKEN (if set)"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem("tn-admin-token", e.target.value);
            }}
            className="bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 text-xs w-48"
          />
        </div>
      </header>

      {/* Activity ribbon — shows last save target */}
      <div className="card p-2.5 flex items-center justify-between text-xs gap-2 flex-wrap">
        <div className="text-[var(--text-muted)]">
          {activity ? (
            <>
              <span
                className="font-bold tabular px-1.5 py-0.5 rounded mr-2"
                style={{
                  background: "var(--accent-counting)",
                  color: "black",
                }}
              >
                {activity.stateId}
              </span>
              {activity.what} · just now
            </>
          ) : (
            "Edits will auto-save 0.8s after you stop typing or on blur."
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {presetsAvailable.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                const p = PRESET_STATES.find((x) => x.id === e.target.value);
                if (p) addPreset(p);
                e.target.value = "";
              }}
              className="bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 text-xs"
            >
              <option value="">+ Add preset state…</option>
              {presetsAvailable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name} ({p.totalSeats} seats)
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={addCustom}
            className="text-xs font-bold px-3 py-1.5 rounded border border-[var(--accent-lead)]/40 text-[var(--accent-lead)] hover:bg-[var(--accent-lead)]/10 transition"
          >
            + Custom state
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {states.map((s) => (
          <StateEditor
            key={s.id}
            state={s}
            status={statusById[s.id] ?? "idle"}
            onPatchState={(patch, label) => patchState(s.id, patch, label)}
            onPatchParty={(idx, patch, label) =>
              patchParty(s.id, idx, patch, label)
            }
            onAddParty={() => addParty(s.id)}
            onRemoveParty={(idx) => removeParty(s.id, idx)}
            onForceSave={(label) => save(s, label)}
            onResetZeros={() => resetStateZeros(s.id)}
            onRemove={() => removeState(s.id)}
          />
        ))}
        {states.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            No states configured yet — pick a preset above or click + Custom state.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-state row ────────────────────────────────────────

function StateEditor({
  state,
  status,
  onPatchState,
  onPatchParty,
  onAddParty,
  onRemoveParty,
  onForceSave,
  onResetZeros,
  onRemove,
}: {
  state: OtherState;
  status: SaveStatus;
  onPatchState: (patch: Partial<OtherState>, label: string) => void;
  onPatchParty: (
    idx: number,
    patch: Partial<OtherStatePartyRow>,
    label: string,
  ) => void;
  onAddParty: () => void;
  onRemoveParty: (idx: number) => void;
  onForceSave: (label: string) => void;
  onResetZeros: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
            ID
          </div>
          <div className="font-mono font-black text-base">{state.id}</div>
        </div>
        <Field label="Name" w="w-44">
          <input
            type="text"
            value={state.name}
            onChange={(e) => onPatchState({ name: e.target.value }, `name=${e.target.value}`)}
            onBlur={() => onForceSave("name (blur)")}
            onKeyDown={enterToSave(() => onForceSave("name (enter)"))}
            className={inputCls}
          />
        </Field>
        <Field label="Total seats" w="w-24">
          <input
            type="number"
            value={state.totalSeats}
            onChange={(e) =>
              onPatchState(
                { totalSeats: Number(e.target.value) || 0 },
                `totalSeats=${e.target.value}`,
              )
            }
            onBlur={() => onForceSave("totalSeats (blur)")}
            onKeyDown={enterToSave(() => onForceSave("totalSeats (enter)"))}
            className={inputCls + " tabular text-right"}
          />
        </Field>
        <Field label="Reporting / Leads" w="w-28">
          <Stepper
            value={state.reportingSeats}
            onChange={(v) =>
              onPatchState({ reportingSeats: v }, `reporting=${v}`)
            }
            onBlur={() => onForceSave("reporting (blur)")}
            onEnter={() => onForceSave("reporting (enter)")}
          />
        </Field>
        <Field label="Order" w="w-14">
          <input
            type="number"
            value={state.sequence}
            onChange={(e) =>
              onPatchState({ sequence: Number(e.target.value) || 0 }, `seq=${e.target.value}`)
            }
            onBlur={() => onForceSave("sequence (blur)")}
            className={inputCls + " tabular text-right"}
          />
        </Field>

        <div className="ml-auto flex gap-2 items-center">
          <SaveBadge status={status} />
          <button
            type="button"
            onClick={onResetZeros}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition"
            title="Wipe all totals + delta back to 0"
          >
            ↻ Reset
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="grid grid-cols-[80px_1fr_140px_140px_64px_28px] gap-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)] px-1">
          <span>Party ID</span>
          <span>Label</span>
          <span className="text-right">Total</span>
          <span className="text-right">Δ vs prev</span>
          <span>Color</span>
          <span></span>
        </div>
        {state.parties.map((p, i) => (
          <div
            key={i}
            className="grid grid-cols-[80px_1fr_140px_140px_64px_28px] gap-2 items-center"
          >
            <input
              type="text"
              value={p.partyId}
              onChange={(e) =>
                onPatchParty(i, { partyId: e.target.value }, `party.${i}.id`)
              }
              onBlur={() => onForceSave(`party.${i}.id (blur)`)}
              onKeyDown={enterToSave(() => onForceSave(`party.${i}.id (enter)`))}
              className={inputCls + " font-mono"}
            />
            <input
              type="text"
              value={p.label}
              onChange={(e) =>
                onPatchParty(i, { label: e.target.value }, `party.${i}.label`)
              }
              onBlur={() => onForceSave(`party.${i}.label (blur)`)}
              onKeyDown={enterToSave(() => onForceSave(`party.${i}.label (enter)`))}
              className={inputCls}
            />
            <Stepper
              value={p.total}
              onChange={(v) =>
                onPatchParty(i, { total: v }, `party.${i}.total=${v}`)
              }
              onBlur={() => onForceSave(`party.${i}.total (blur)`)}
              onEnter={() => onForceSave(`party.${i}.total (enter)`)}
            />
            <Stepper
              value={p.delta}
              onChange={(v) =>
                onPatchParty(i, { delta: v }, `party.${i}.delta=${v}`)
              }
              onBlur={() => onForceSave(`party.${i}.delta (blur)`)}
              onEnter={() => onForceSave(`party.${i}.delta (enter)`)}
              allowNegative
            />
            <input
              type="color"
              value={p.color ?? "#94a3b8"}
              onChange={(e) =>
                onPatchParty(i, { color: e.target.value }, `party.${i}.color`)
              }
              onBlur={() => onForceSave(`party.${i}.color (blur)`)}
              className="bg-[var(--bg-base)] border border-[var(--border)] rounded h-8 w-full cursor-pointer"
            />
            <button
              type="button"
              onClick={() => onRemoveParty(i)}
              className="text-red-400 hover:text-red-300 text-lg leading-none px-1"
              title="Remove row"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddParty}
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-white/30 transition"
        >
          + Add party
        </button>
      </div>
    </div>
  );
}

// ── Reusable inputs ──────────────────────────────────────

const inputCls =
  "bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 text-sm w-full outline-none focus:border-[var(--accent-counting)]";

function Field({
  label,
  w,
  children,
}: {
  label: string;
  w?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${w ?? ""}`}>
      <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stepper({
  value,
  onChange,
  onBlur,
  onEnter,
  allowNegative,
}: {
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  onEnter?: () => void;
  allowNegative?: boolean;
}) {
  return (
    <div className="flex items-stretch border border-[var(--border)] rounded overflow-hidden bg-[var(--bg-base)]">
      <button
        type="button"
        onClick={() => onChange(allowNegative ? value - 1 : Math.max(0, value - 1))}
        className="px-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 select-none text-sm"
        title="−1"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onBlur={onBlur}
        onKeyDown={enterToSave(() => onEnter?.())}
        className="bg-transparent border-none px-1 py-1 text-sm w-full tabular text-right outline-none focus:bg-[var(--bg-card)]/60"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 select-none text-sm"
        title="+1"
      >
        +
      </button>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { text: string; cls: string }> = {
    idle: { text: "—", cls: "text-[var(--text-muted)] border-transparent" },
    pending: { text: "↳ pending", cls: "text-amber-400 border-amber-400/40 bg-amber-500/10" },
    saving: { text: "saving…", cls: "text-amber-300 border-amber-400/40 bg-amber-500/10" },
    saved: { text: "✓ saved", cls: "text-[var(--accent-won)] border-[var(--accent-won)]/40 bg-[var(--accent-won)]/10" },
    error: { text: "✗ error", cls: "text-red-400 border-red-400/40 bg-red-500/10" },
  };
  const s = map[status];
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border min-w-[78px] text-center ${s.cls}`}
    >
      {s.text}
    </span>
  );
}

function enterToSave(handler: () => void) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur(); // triggers onBlur save too; debounced
      handler();
    }
  };
}
