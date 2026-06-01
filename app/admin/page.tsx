"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useLiveData } from "@/components/LiveDataProvider";
import { partyById } from "@/lib/parties";
import { cn, formatNumber } from "@/lib/cn";
import { ChyronComposer } from "@/components/ChyronComposer";
import { StorylinesPanel } from "@/components/StorylinesPanel";

type SimState = {
  running: boolean;
  intervalMs: number;
  currentTick: number;
  startedAt: number | null;
};

type Tab = "manual" | "bulk" | "pending" | "audit" | "simulator";

type Detail = {
  candidates: Array<{ id: number; name: string; party_id: string; votes: number }>;
  state: { round: number; total_rounds: number; status: string };
};

type Warning = { level: "warn" | "info"; candidateId?: number; message: string };

type AuditRow = {
  id: number;
  created_at: number;
  constituency_id: number;
  candidate_id: number;
  candidate_name: string;
  party_id: string;
  round: number;
  votes_before: number;
  votes_after: number;
  delta: number;
  status_before: string | null;
  status_after: string | null;
  actor: string;
  source: string;
};

type PendingResp = {
  pending: Array<{
    constituency_id: number;
    name: string;
    district: string;
    status: string;
    round: number;
    total_rounds: number;
    updated_at: number;
    last_actor: string | null;
    last_source: string | null;
  }>;
  recentlyTouched: PendingResp["pending"];
  staleMinutes: number;
  serverTime: number;
};

function relTime(ms: number, ref: number) {
  if (!ms) return "never";
  const diff = ref - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function loadCreds() {
  if (typeof window === "undefined") return { name: "", token: "" };
  return {
    name: localStorage.getItem("admin_name") ?? "",
    token: localStorage.getItem("admin_token") ?? "",
  };
}

export default function AdminPage() {
  const { constituencies } = useLiveData();
  const [tab, setTab] = useState<Tab>("manual");

  // Name persisted for the audit log — no token needed in single-day mode
  const [name, setName] = useState("");
  useEffect(() => {
    const c = loadCreds();
    setName(c.name);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("admin_name", name);
  }, [name]);

  const authHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (name) h["x-actor"] = name;
    return h;
  }, [name]);

  // Toast
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">Admin Console</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Manual data entry, bulk paste, pending dashboard, audit log
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Your name (for audit log)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 text-xs w-52 outline-none focus:border-[var(--accent-lead)]"
          />
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border bg-[var(--accent-counting)]/10 border-[var(--accent-counting)]/40 text-[var(--accent-counting)]">
            Open mode
          </span>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {(
          [
            { id: "manual", label: "Manual entry" },
            { id: "bulk", label: "Bulk paste" },
            { id: "pending", label: "Pending" },
            { id: "audit", label: "Audit log" },
            { id: "simulator", label: "Simulator" },
          ] as Array<{ id: Tab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-[var(--accent-lead)] text-[var(--accent-lead)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            {t.label}
          </button>
        ))}
        {/* Cross-link to the non-TN states data-entry page */}
        <Link
          href="/admin/states"
          className="ml-auto px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px border-transparent text-[var(--text-muted)] hover:text-[var(--accent-counting)] hover:border-[var(--accent-counting)] transition-colors"
        >
          Other states ↗
        </Link>
      </nav>

      {message && (
        <div
          className={cn(
            "card p-3 text-sm",
            message.type === "ok"
              ? "border-[var(--accent-won)]/40 bg-[var(--accent-won)]/10"
              : "border-[var(--accent-live)]/40 bg-[var(--accent-live)]/10",
          )}
        >
          {message.text}
        </div>
      )}

      {tab === "manual" && (
        <ManualTab
          constituencies={constituencies}
          authHeaders={authHeaders}
          name={name}
          onMessage={setMessage}
        />
      )}
      {tab === "bulk" && <BulkTab authHeaders={authHeaders} onMessage={setMessage} />}
      {tab === "pending" && (
        <PendingTab
          onJump={(id) => {
            setTab("manual");
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("admin-jump-to-ac", { detail: id }));
            }, 50);
          }}
        />
      )}
      {tab === "audit" && <AuditTab constituencies={constituencies} />}
      {tab === "simulator" && (
        <SimulatorTab authHeaders={authHeaders} onMessage={setMessage} />
      )}
    </div>
  );
}

/* ─────────── Manual entry tab ─────────── */

function ManualTab({
  constituencies,
  authHeaders,
  name,
  onMessage,
}: {
  constituencies: ReturnType<typeof useLiveData>["constituencies"];
  authHeaders: () => Record<string, string>;
  name: string;
  onMessage: (m: { type: "ok" | "err"; text: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [voteInputs, setVoteInputs] = useState<Record<number, string>>({});
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState<"counting" | "leading" | "won">("leading");
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [presence, setPresence] = useState<Record<number, string[]>>({});
  // Per-row inline save state — keyed by candidate id
  const [rowSaveState, setRowSaveState] = useState<
    Record<number, "saving" | "saved" | "error">
  >({});
  const [rowSaveAt, setRowSaveAt] = useState<Record<number, number>>({});
  // Lane filter: split workload across multiple data-entry people
  const [lane, setLane] = useState<string>("ALL");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("admin_lane");
    if (saved) setLane(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("admin_lane", lane);
  }, [lane]);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const firstVoteRef = useRef<HTMLInputElement | null>(null);

  // Allow other tabs to push us to a specific AC
  useEffect(() => {
    const fn = (e: Event) => {
      const id = (e as CustomEvent).detail as number;
      if (Number.isFinite(id)) setSelectedId(id);
    };
    window.addEventListener("admin-jump-to-ac", fn);
    return () => window.removeEventListener("admin-jump-to-ac", fn);
  }, []);

  // Load AC detail when selected
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetch(`/api/constituencies/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail({
          candidates: d.candidates.map(
            (c: { id: number; name: string; party_id: string; votes: number }) => ({
              id: c.id,
              name: c.name,
              party_id: c.party_id,
              votes: c.votes,
            }),
          ),
          state: {
            round: d.state.round,
            total_rounds: d.state.total_rounds,
            status: d.state.status,
          },
        });
        setRound(Math.max(1, (d.state.round || 0) + (d.state.round > 0 ? 1 : 0)));
        setVoteInputs(
          Object.fromEntries(
            d.candidates.map((c: { id: number; votes: number }) => [c.id, String(c.votes)]),
          ),
        );
        setWarnings([]);
        setTimeout(() => firstVoteRef.current?.focus(), 50);
      });
  }, [selectedId]);

  // Heartbeat presence every 25s while editing an AC
  useEffect(() => {
    if (!selectedId || !name) return;
    const tick = () =>
      fetch("/api/admin/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, acId: selectedId, action: "heartbeat" }),
      })
        .then((r) => r.json())
        .then((d) => setPresence(d.editing ?? {}))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 25_000);
    return () => {
      clearInterval(t);
      // best-effort release on unmount
      fetch("/api/admin/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, acId: selectedId, action: "release" }),
      }).catch(() => {});
    };
  }, [selectedId, name]);

  // Periodic refresh of presence map (so we see other people)
  useEffect(() => {
    const tick = () =>
      fetch("/api/admin/presence")
        .then((r) => r.json())
        .then((d) => setPresence(d.editing ?? {}))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);

  // Distinct districts from current state, sorted by AC count (busiest first)
  const districtCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of constituencies) m.set(c.district, (m.get(c.district) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [constituencies]);

  const RANGES = [
    { id: "R1", label: "1–50", from: 1, to: 50 },
    { id: "R2", label: "51–100", from: 51, to: 100 },
    { id: "R3", label: "101–150", from: 101, to: 150 },
    { id: "R4", label: "151–200", from: 151, to: 200 },
    { id: "R5", label: "201–234", from: 201, to: 234 },
  ];

  function inLane(c: { constituencyId: number; district: string }) {
    if (lane === "ALL") return true;
    if (lane.startsWith("D:")) return c.district === lane.slice(2);
    if (lane.startsWith("R:")) {
      const r = RANGES.find((r) => r.id === lane.slice(2));
      return r ? c.constituencyId >= r.from && c.constituencyId <= r.to : true;
    }
    return true;
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return constituencies.filter((c) => {
      if (!inLane(c)) return false;
      if (!q) return true;
      return (
        c.constituencyName.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        String(c.constituencyId).includes(q)
      );
    });
  }, [constituencies, search, lane]);

  // Lane progress (for the lane indicator)
  const laneProgress = useMemo(() => {
    if (lane === "ALL") return null;
    const acs = constituencies.filter(inLane);
    const total = acs.length;
    const won = acs.filter((c) => c.status === "won").length;
    const counting = acs.filter((c) => c.status === "leading" || c.status === "counting").length;
    return { total, won, counting, pending: total - won - counting };
  }, [constituencies, lane]);

  // List keyboard nav: arrow up/down, Enter to open
  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const ids = filtered.slice(0, 100).map((c) => c.constituencyId);
    if (!ids.length) return;
    const idx = selectedId ? ids.indexOf(selectedId) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedId(ids[Math.min(ids.length - 1, idx + 1)] ?? ids[0]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedId(ids[Math.max(0, idx - 1)] ?? ids[0]);
    }
  }

  // Save just one candidate row — fired by Enter inside a vote input.
  // Sends the full snapshot (all candidates with their current input values)
  // so the writer's no-change detection isn't confused by partial updates.
  async function submitOneRow(candidateId: number) {
    if (!selectedId || !detail) return;
    // Name is optional — audit log just records 'anonymous' if blank
    setRowSaveState((s) => ({ ...s, [candidateId]: "saving" }));
    try {
      const candidates = detail.candidates.map((c) => ({
        candidateId: c.id,
        votes: parseInt(voteInputs[c.id] ?? "0", 10) || 0,
      }));
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          constituencyId: selectedId,
          round,
          status,
          candidates,
        }),
      });
      const data = await res.json();
      if (res.ok || (res.status === 409 && data.reason === "no-change")) {
        setRowSaveState((s) => ({ ...s, [candidateId]: "saved" }));
        setRowSaveAt((s) => ({ ...s, [candidateId]: Date.now() }));
        // Show one global toast on first save in a session, then quiet
        if (data.applied) {
          onMessage({
            type: "ok",
            text: `Saved AC#${selectedId}${data.warnings?.length ? ` · ${data.warnings.length} warn` : ""}`,
          });
        }
        setWarnings(data.warnings ?? []);
      } else {
        setRowSaveState((s) => ({ ...s, [candidateId]: "error" }));
        const reasonText: Record<string, string> = {
          locked: "Manual lock active — wait 5 min",
          "stale-round": "Round older than current",
          "won-sticky": "AC declared won — Reset to change",
          "negative-votes": "Negative votes rejected",
        };
        onMessage({
          type: "err",
          text: data.reason ? reasonText[data.reason] ?? data.reason : data.error ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setRowSaveState((s) => ({ ...s, [candidateId]: "error" }));
      onMessage({ type: "err", text: String(err) });
    }
  }

  async function submit(advance: boolean) {
    if (!selectedId || !detail) return;
    // Name is optional — audit log just records 'anonymous' if blank
    setBusy(true);
    try {
      const candidates = detail.candidates.map((c) => ({
        candidateId: c.id,
        votes: parseInt(voteInputs[c.id] ?? "0", 10) || 0,
      }));
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          constituencyId: selectedId,
          round,
          status,
          candidates,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) {
        onMessage({ type: "err", text: data.error ?? `HTTP ${res.status}` });
        setBusy(false);
        return;
      }
      setWarnings(data.warnings ?? []);
      if (res.status === 409 && !data.applied) {
        const reasonText: Record<string, string> = {
          "locked": "Manual lock active — try again in 5 min",
          "stale-round": "Round is older than current — ignored",
          "won-sticky": "AC is already declared 'won' — Reset AC to change",
          "no-change": "No values changed — nothing to save",
          "negative-votes": "Negative votes rejected",
        };
        onMessage({
          type: "err",
          text: `AC#${selectedId} not saved: ${reasonText[data.reason] ?? data.reason}`,
        });
        setBusy(false);
        return;
      }
      onMessage({
        type: "ok",
        text: `Saved AC#${selectedId} round ${round}${data.warnings?.length ? ` · ${data.warnings.length} warning(s)` : ""}`,
      });

      if (advance) {
        const idx = filtered.findIndex((c) => c.constituencyId === selectedId);
        const next = filtered[idx + 1]?.constituencyId;
        if (next) setSelectedId(next);
      }
    } catch (err) {
      onMessage({ type: "err", text: String(err) });
    }
    setBusy(false);
  }

  // Cmd/Ctrl+Enter to save
  function onEditorKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit(autoAdvance);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            Your lane{laneProgress && ` · ${laneProgress.total} ACs`}
          </div>
          {laneProgress && (
            <div className="text-xs text-[var(--text-muted)] tabular">
              <span className="text-[var(--accent-won)]">{laneProgress.won}</span> won ·{" "}
              <span className="text-[var(--accent-counting)]">{laneProgress.counting}</span> counting ·{" "}
              <span>{laneProgress.pending}</span> pending
            </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <LanePill active={lane === "ALL"} onClick={() => setLane("ALL")}>
            All ({constituencies.length})
          </LanePill>
          {RANGES.map((r) => (
            <LanePill
              key={r.id}
              active={lane === `R:${r.id}`}
              onClick={() => setLane(`R:${r.id}`)}
            >
              #{r.label}
            </LanePill>
          ))}
          <span className="w-px bg-[var(--border)] mx-1 self-stretch" />
          {districtCounts.map(([d, n]) => (
            <LanePill
              key={d}
              active={lane === `D:${d}`}
              onClick={() => setLane(`D:${d}`)}
            >
              {d} ({n})
            </LanePill>
          ))}
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      <div className="space-y-2">
        <input
          ref={searchRef}
          type="search"
          placeholder="Search constituency, district, AC#"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && filtered[0]) {
              e.preventDefault();
              setSelectedId(filtered[0].constituencyId);
            }
          }}
          className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none"
        />
        <div
          className="max-h-[600px] overflow-y-auto bg-[var(--bg-base)] border border-[var(--border)] rounded-lg outline-none"
          tabIndex={0}
          onKeyDown={onListKey}
        >
          {filtered.slice(0, 100).map((c) => {
            const editors = presence[c.constituencyId] ?? [];
            const others = editors.filter((n) => n !== name);
            return (
              <button
                key={c.constituencyId}
                onClick={() => setSelectedId(c.constituencyId)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)]",
                  selectedId === c.constituencyId && "bg-[var(--bg-card-hover)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.constituencyName}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {c.district} · AC#{c.constituencyId}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {others.length > 0 && (
                      <span
                        className="text-[10px] bg-[var(--accent-counting)]/20 text-[var(--accent-counting)] border border-[var(--accent-counting)]/40 px-1.5 py-0.5 rounded uppercase tracking-wider"
                        title={others.join(", ")}
                      >
                        {others[0]}
                        {others.length > 1 ? ` +${others.length - 1}` : ""}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      {c.status}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length > 100 && (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)] text-center">
              +{filtered.length - 100} more · refine search
            </div>
          )}
        </div>
      </div>

      <div onKeyDown={onEditorKey}>
        {selectedId && detail ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-bold text-lg">
                  {constituencies.find((c) => c.constituencyId === selectedId)?.constituencyName} ·{" "}
                  <span className="text-[var(--text-muted)] font-normal text-base">
                    AC#{selectedId}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Current state: round {detail.state.round}/{detail.state.total_rounds} ·{" "}
                  status: {detail.state.status}
                </div>
              </div>
              {(presence[selectedId]?.filter((n) => n !== name) ?? []).length > 0 && (
                <span className="text-xs bg-[var(--accent-counting)]/20 text-[var(--accent-counting)] border border-[var(--accent-counting)]/40 px-2 py-1 rounded">
                  Also editing: {presence[selectedId]!.filter((n) => n !== name).join(", ")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-[var(--text-secondary)]">
                Round
                <input
                  type="number"
                  value={round}
                  onChange={(e) => setRound(parseInt(e.target.value, 10) || 1)}
                  min={1}
                  max={detail.state.total_rounds}
                  className="ml-2 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 w-20 tabular"
                />
                <span className="text-[var(--text-muted)] ml-1 tabular">
                  / {detail.state.total_rounds}
                </span>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                Status
                <select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value as "counting" | "leading" | "won";
                    setStatus(next);
                    // Auto-save the status change immediately so the operator
                    // doesn't have to also press Enter on a vote input.
                    if (selectedId && detail) {
                      const candidates = detail.candidates.map((c) => ({
                        candidateId: c.id,
                        votes: parseInt(voteInputs[c.id] ?? "0", 10) || 0,
                      }));
                      fetch("/api/admin/update", {
                        method: "POST",
                        headers: authHeaders(),
                        body: JSON.stringify({
                          constituencyId: selectedId,
                          round,
                          status: next,
                          candidates,
                        }),
                      })
                        .then((r) => r.json())
                        .then((data) => {
                          if (data.ok && data.applied) {
                            onMessage({
                              type: "ok",
                              text: `AC#${selectedId} → ${next.toUpperCase()}`,
                            });
                          } else if (!data.ok && data.reason) {
                            const reasonText: Record<string, string> = {
                              locked: "Manual lock active",
                              "stale-round": "Round older than current",
                              "won-sticky": "Already declared 'won' — Reset to change",
                              "no-change": "No change",
                              "negative-votes": "Negative votes rejected",
                            };
                            onMessage({
                              type: "err",
                              text: `Status not saved: ${reasonText[data.reason] ?? data.reason}`,
                            });
                          }
                        })
                        .catch((err) => onMessage({ type: "err", text: String(err) }));
                    }
                  }}
                  className="ml-2 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1"
                >
                  <option value="counting">counting</option>
                  <option value="leading">leading</option>
                  <option value="won">won</option>
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 ml-auto">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                />
                Save & advance to next
              </label>
            </div>

            <div className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left p-2">Candidate</th>
                    <th className="text-left p-2">Party</th>
                    <th className="text-right p-2">Current</th>
                    <th className="text-right p-2 w-44">New votes</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.candidates.map((c, i) => {
                    const party = partyById(c.party_id);
                    const candWarnings = warnings.filter((w) => w.candidateId === c.id);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-[var(--border)] last:border-b-0 align-top"
                      >
                        <td className="p-2">
                          {c.name}
                          {candWarnings.length > 0 && (
                            <div className="mt-1 text-[10px] text-[var(--accent-live)]">
                              {candWarnings.map((w) => `⚠ ${w.message}`).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td
                          className="p-2"
                          style={{ color: party.color }}
                        >
                          {party.name}
                        </td>
                        <td className="p-2 text-right tabular text-[var(--text-muted)]">
                          {formatNumber(c.votes)}
                        </td>
                        <td className="p-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              ref={i === 0 ? firstVoteRef : undefined}
                              type="number"
                              value={voteInputs[c.id] ?? "0"}
                              onChange={(e) =>
                                setVoteInputs((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value,
                                }))
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Save just this row, then move focus to the next vote input
                                  submitOneRow(c.id);
                                  const allInputs = [
                                    ...document.querySelectorAll<HTMLInputElement>(
                                      'table tbody input[type="number"]',
                                    ),
                                  ];
                                  const next = allInputs[i + 1];
                                  if (next) {
                                    next.focus();
                                    next.select();
                                  }
                                }
                              }}
                              className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1 w-28 text-right tabular"
                            />
                            <RowStatusDot
                              state={rowSaveState[c.id]}
                              ts={rowSaveAt[c.id]}
                              onClick={() => submitOneRow(c.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {warnings.filter((w) => !w.candidateId).length > 0 && (
              <div className="card p-2 text-xs space-y-1 border-[var(--accent-live)]/40 bg-[var(--accent-live)]/5">
                {warnings
                  .filter((w) => !w.candidateId)
                  .map((w, i) => (
                    <div key={i}>⚠ {w.message}</div>
                  ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => submit(autoAdvance)}
                disabled={busy}
                className="px-4 py-2 rounded-md bg-[var(--accent-lead)] text-black font-bold text-sm hover:bg-[var(--accent-lead)]/90 disabled:opacity-50"
              >
                Save & broadcast{autoAdvance ? " → next" : ""}{" "}
                <span className="opacity-60 font-normal">⌘↵</span>
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Saving as <strong>{name || "anonymous"}</strong>
              </span>
              <button
                onClick={async () => {
                  if (!selectedId) return;
                  const confirmed = window.prompt(
                    `Reset AC#${selectedId}? This wipes votes & rounds back to 0.\nType RESET to confirm:`,
                  );
                  if (confirmed !== "RESET") return;
                  setBusy(true);
                  try {
                    const res = await fetch("/api/admin/reset", {
                      method: "POST",
                      headers: authHeaders(),
                      body: JSON.stringify({ constituencyId: selectedId, confirm: "RESET" }),
                    });
                    const d = await res.json();
                    if (res.ok) {
                      onMessage({ type: "ok", text: `Reset AC#${selectedId}` });
                      // refetch detail
                      setSelectedId(null);
                      setTimeout(() => setSelectedId(selectedId), 100);
                    } else onMessage({ type: "err", text: d.error ?? "Failed" });
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="ml-auto px-3 py-1.5 rounded-md bg-[var(--accent-live)]/20 hover:bg-[var(--accent-live)]/30 text-[var(--accent-live)] border border-[var(--accent-live)]/40 text-xs font-bold uppercase tracking-wider"
                title="Wipe all votes/rounds for this AC and clear manual lock"
              >
                ↻ Reset AC
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[var(--text-muted)] text-center py-12">
            Search above (try "kolathur" or "1") and pick a constituency. ↓ arrow from
            the search box to enter the list. ⌘↵ to save.
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function RowStatusDot({
  state,
  ts,
  onClick,
}: {
  state?: "saving" | "saved" | "error";
  ts?: number;
  onClick: () => void;
}) {
  // Re-render every 5s so "n s ago" stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ts) return;
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, [ts]);
  const elapsed = ts ? Math.floor((Date.now() - ts) / 1000) : 0;
  let label = "↵";
  let title = "Press Enter to save · or click";
  let color = "var(--text-muted)";
  if (state === "saving") {
    label = "…";
    title = "saving";
    color = "var(--accent-counting)";
  } else if (state === "saved") {
    label = "✓";
    title = `saved ${elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`} ago`;
    color = "var(--accent-won)";
  } else if (state === "error") {
    label = "!";
    title = "error — click to retry";
    color = "var(--accent-live)";
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-6 h-6 rounded-full border border-[var(--border)] hover:border-[var(--accent-lead)] text-xs font-bold leading-none flex items-center justify-center transition-colors"
      style={{ color }}
    >
      {label}
    </button>
  );
}

function LanePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
        active
          ? "bg-[var(--accent-lead)] border-[var(--accent-lead)] text-black font-bold"
          : "bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]",
      )}
    >
      {children}
    </button>
  );
}

/* ─────────── Bulk paste tab ─────────── */

function BulkTab({
  authHeaders,
  onMessage,
}: {
  authHeaders: () => Record<string, string>;
  onMessage: (m: { type: "ok" | "err"; text: string }) => void;
}) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<
    Array<{ acId: number; round: number; status?: string; rows: Array<{ partyId: string; votes: number }> }>
  >([]);
  const [previewResult, setPreviewResult] = useState<{
    rowCount: number;
    results: Array<{ constituencyId: number; round: number; ok: boolean; error?: string; warnings?: Warning[] }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  function parse() {
    // Accept TSV or CSV with header line. Required columns: ac, round, party, votes
    // Optional: status, totalRounds
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      setParsed([]);
      return;
    }
    const split = (l: string) => l.split(/[\t,]/).map((s) => s.trim());
    const header = split(lines[0]).map((h) => h.toLowerCase());
    const ix = (k: string) => header.indexOf(k);
    const acIdx = Math.max(ix("ac"), ix("ac#"), ix("constituency"), ix("acid"));
    const rndIdx = Math.max(ix("round"), ix("rnd"));
    const partyIdx = Math.max(ix("party"), ix("partyid"));
    const votesIdx = Math.max(ix("votes"), ix("vote"));
    const statusIdx = ix("status");

    if (acIdx < 0 || rndIdx < 0 || partyIdx < 0 || votesIdx < 0) {
      onMessage({
        type: "err",
        text:
          "Header must include columns: ac, round, party, votes. Optional: status, totalRounds.",
      });
      setParsed([]);
      return;
    }

    type Group = {
      acId: number;
      round: number;
      status?: string;
      rows: Array<{ partyId: string; votes: number }>;
    };
    const grouped = new Map<string, Group>();
    for (let i = 1; i < lines.length; i++) {
      const cells = split(lines[i]);
      const acId = parseInt(cells[acIdx] ?? "", 10);
      const round = parseInt(cells[rndIdx] ?? "", 10);
      const party = (cells[partyIdx] ?? "").toUpperCase();
      const votes = parseInt(cells[votesIdx]?.replace(/[, ]/g, "") ?? "", 10);
      if (!Number.isFinite(acId) || !Number.isFinite(round) || !party) continue;
      const key = `${acId}:${round}`;
      if (!grouped.has(key))
        grouped.set(key, {
          acId,
          round,
          status: statusIdx >= 0 ? cells[statusIdx] : undefined,
          rows: [],
        });
      grouped.get(key)!.rows.push({ partyId: party, votes: Number.isFinite(votes) ? votes : 0 });
    }
    setParsed(Array.from(grouped.values()));
    setPreviewResult(null);
  }

  async function send(dryRun: boolean) {
    if (!parsed.length) return;
    setBusy(true);
    try {
      const rows = parsed.map((g) => ({
        constituencyId: g.acId,
        round: g.round,
        status: g.status,
        candidates: g.rows.map((r) => ({ partyId: r.partyId, votes: r.votes })),
      }));
      const res = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ rows, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        onMessage({ type: "err", text: data.error ?? `HTTP ${res.status}` });
        setBusy(false);
        return;
      }
      setPreviewResult({ rowCount: data.rowCount, results: data.results });
      const errCount = data.results.filter((r: { ok: boolean }) => !r.ok).length;
      onMessage({
        type: errCount ? "err" : "ok",
        text: `${dryRun ? "Validated" : "Applied"} ${data.rowCount} rows · ${errCount} error(s)`,
      });
    } catch (err) {
      onMessage({ type: "err", text: String(err) });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
          Paste round data
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Header line required. Tab- or comma-separated. Columns:{" "}
          <code className="bg-[var(--bg-base)] px-1 py-0.5 rounded">
            ac, round, party, votes
          </code>{" "}
          (optional: <code className="bg-[var(--bg-base)] px-1 py-0.5 rounded">status</code>).
          Rows for the same AC + round are grouped automatically.
        </p>
        <pre className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border)] rounded p-2 mb-2 overflow-x-auto">
{`ac	round	party	votes
1	3	DMK	14523
1	3	AIADMK	11890
1	3	BJP	2341
2	3	DMK	16001
2	3	AIADMK	9988`}
        </pre>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder="Paste rows here (tab- or comma-separated, with header)…"
          className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded p-2 text-sm font-mono outline-none focus:border-[var(--accent-lead)]"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={parse}
            className="px-3 py-1.5 rounded-md bg-[var(--accent-lead)]/20 hover:bg-[var(--accent-lead)]/30 text-[var(--accent-lead)] border border-[var(--accent-lead)]/40 text-xs font-bold uppercase tracking-wider"
          >
            Parse
          </button>
          <button
            onClick={() => send(true)}
            disabled={busy || !parsed.length}
            className="px-3 py-1.5 rounded-md bg-[var(--accent-counting)]/20 hover:bg-[var(--accent-counting)]/30 text-[var(--accent-counting)] border border-[var(--accent-counting)]/40 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Validate (dry-run)
          </button>
          <button
            onClick={() => send(false)}
            disabled={busy || !parsed.length}
            className="px-3 py-1.5 rounded-md bg-[var(--accent-won)]/20 hover:bg-[var(--accent-won)]/30 text-[var(--accent-won)] border border-[var(--accent-won)]/40 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Apply {parsed.length} group(s)
          </button>
          <span className="text-xs text-[var(--text-muted)] ml-auto self-center">
            {parsed.length} group(s) parsed
          </span>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Preview ({parsed.length} groups)
          </div>
          <div className="max-h-[400px] overflow-y-auto bg-[var(--bg-base)] border border-[var(--border)] rounded">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left p-2">AC</th>
                  <th className="text-left p-2">Round</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Candidates</th>
                  <th className="text-left p-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((g, i) => {
                  const r = previewResult?.results.find(
                    (x) => x.constituencyId === g.acId && x.round === g.round,
                  );
                  return (
                    <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="p-2 tabular">#{g.acId}</td>
                      <td className="p-2 tabular">{g.round}</td>
                      <td className="p-2">{g.status ?? "—"}</td>
                      <td className="p-2">
                        {g.rows
                          .map((c) => `${c.partyId}: ${c.votes.toLocaleString()}`)
                          .join(" · ")}
                      </td>
                      <td className="p-2">
                        {!r ? (
                          <span className="text-[var(--text-muted)]">pending</span>
                        ) : r.ok ? (
                          r.warnings?.length ? (
                            <span className="text-[var(--accent-counting)]">
                              ⚠ {r.warnings.length}
                            </span>
                          ) : (
                            <span className="text-[var(--accent-won)]">✓ ok</span>
                          )
                        ) : (
                          <span className="text-[var(--accent-live)]">✗ {r.error}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Pending dashboard tab ─────────── */

function PendingTab({ onJump }: { onJump: (id: number) => void }) {
  const [stale, setStale] = useState(10);
  const [data, setData] = useState<PendingResp | null>(null);

  useEffect(() => {
    const tick = () =>
      fetch(`/api/admin/pending?staleMinutes=${stale}&limit=100`)
        .then((r) => r.json())
        .then(setData);
    tick();
    const t = setInterval(tick, 5_000);
    return () => clearInterval(t);
  }, [stale]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--text-muted)]">Stale threshold</span>
        {[5, 10, 30, 60].map((m) => (
          <button
            key={m}
            onClick={() => setStale(m)}
            className={cn(
              "text-xs px-2 py-1 rounded border",
              stale === m
                ? "border-[var(--accent-lead)] text-[var(--accent-lead)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Stale ({data?.pending.length ?? 0}) · not updated in &gt; {stale}m
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {(data?.pending ?? []).map((p) => (
              <button
                key={p.constituency_id}
                onClick={() => onJump(p.constituency_id)}
                className="w-full text-left px-2 py-1.5 text-sm border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {p.name}{" "}
                      <span className="text-xs text-[var(--text-muted)]">
                        AC#{p.constituency_id}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {p.district} · round {p.round}/{p.total_rounds} · {p.status}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--accent-live)] tabular">
                    {p.updated_at
                      ? relTime(p.updated_at, data?.serverTime ?? Date.now())
                      : "never"}
                  </div>
                </div>
              </button>
            ))}
            {(data?.pending.length ?? 0) === 0 && (
              <div className="text-center text-[var(--text-muted)] text-xs py-6">
                Nothing stale 🎉
              </div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Recently touched
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {(data?.recentlyTouched ?? []).map((p) => (
              <button
                key={p.constituency_id}
                onClick={() => onJump(p.constituency_id)}
                className="w-full text-left px-2 py-1.5 text-sm border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {p.name}{" "}
                      <span className="text-xs text-[var(--text-muted)]">
                        AC#{p.constituency_id}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      r{p.round}/{p.total_rounds} · {p.status} ·{" "}
                      {p.last_actor ?? "—"}
                      {p.last_source && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider">
                          ({p.last_source})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--accent-won)] tabular">
                    {p.updated_at
                      ? relTime(p.updated_at, data?.serverTime ?? Date.now())
                      : ""}
                  </div>
                </div>
              </button>
            ))}
            {(data?.recentlyTouched.length ?? 0) === 0 && (
              <div className="text-center text-[var(--text-muted)] text-xs py-6">
                No activity in the last {stale}m
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Audit log tab ─────────── */

function AuditTab({
  constituencies,
}: {
  constituencies: ReturnType<typeof useLiveData>["constituencies"];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    fetch(`/api/admin/audit/${selectedId}?limit=300`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return constituencies.slice(0, 50);
    return constituencies
      .filter(
        (c) =>
          c.constituencyName.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          String(c.constituencyId).includes(q),
      )
      .slice(0, 50);
  }, [constituencies, search]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      <div className="space-y-2">
        <input
          type="search"
          placeholder="Search AC"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none"
        />
        <div className="max-h-[600px] overflow-y-auto bg-[var(--bg-base)] border border-[var(--border)] rounded-lg">
          {filtered.map((c) => (
            <button
              key={c.constituencyId}
              onClick={() => setSelectedId(c.constituencyId)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)]",
                selectedId === c.constituencyId && "bg-[var(--bg-card-hover)]",
              )}
            >
              <div className="font-medium truncate">{c.constituencyName}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {c.district} · #{c.constituencyId}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!selectedId ? (
          <div className="text-[var(--text-muted)] text-center py-12">
            Select an AC to see its full audit history.
          </div>
        ) : (
          <div className="card p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Audit log · {rows.length} events
            </div>
            {rows.length === 0 ? (
              <div className="text-[var(--text-muted)] text-xs py-4">
                No events yet for AC#{selectedId}.
              </div>
            ) : (
              <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                    <tr>
                      <th className="text-left p-1.5">When</th>
                      <th className="text-left p-1.5">Actor</th>
                      <th className="text-left p-1.5">Src</th>
                      <th className="text-left p-1.5">R</th>
                      <th className="text-left p-1.5">Candidate</th>
                      <th className="text-right p-1.5">Before</th>
                      <th className="text-right p-1.5">After</th>
                      <th className="text-right p-1.5">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const party = partyById(r.party_id);
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="p-1.5 tabular text-[var(--text-muted)] whitespace-nowrap">
                            {new Date(r.created_at).toLocaleTimeString()}
                          </td>
                          <td className="p-1.5">{r.actor}</td>
                          <td className="p-1.5">
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border)]">
                              {r.source}
                            </span>
                          </td>
                          <td className="p-1.5 tabular">{r.round}</td>
                          <td className="p-1.5">
                            {r.candidate_name}
                            <span className="ml-1" style={{ color: party.color }}>
                              ({party.id})
                            </span>
                          </td>
                          <td className="p-1.5 text-right tabular text-[var(--text-muted)]">
                            {r.votes_before.toLocaleString()}
                          </td>
                          <td className="p-1.5 text-right tabular">
                            {r.votes_after.toLocaleString()}
                          </td>
                          <td
                            className={cn(
                              "p-1.5 text-right tabular",
                              r.delta > 0
                                ? "text-[var(--accent-won)]"
                                : r.delta < 0
                                  ? "text-[var(--accent-live)]"
                                  : "text-[var(--text-muted)]",
                            )}
                          >
                            {r.delta > 0 ? "+" : ""}
                            {r.delta.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Simulator tab (existing controls + chyron + storylines) ─────────── */

function SimulatorTab({
  authHeaders,
  onMessage,
}: {
  authHeaders: () => Record<string, string>;
  onMessage: (m: { type: "ok" | "err"; text: string }) => void;
}) {
  const [sim, setSim] = useState<SimState | null>(null);
  const [intervalMs, setIntervalMs] = useState(800);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    fetch("/api/admin/simulator").then((r) => r.json()).then(setSim);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  async function call(action: "start" | "stop" | "reset") {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/simulator", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action, intervalMs }),
      });
      const data = await res.json();
      if (!res.ok) onMessage({ type: "err", text: data.error ?? "Failed" });
      else {
        setSim(data.state);
        onMessage({ type: "ok", text: `Simulator ${action}` });
      }
    } catch (err) {
      onMessage({ type: "err", text: String(err) });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Demo simulator
          </h2>
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
              sim?.running
                ? "bg-[var(--accent-won)]/20 text-[var(--accent-won)] border border-[var(--accent-won)]/40"
                : "bg-white/5 text-[var(--text-muted)] border border-[var(--border)]",
            )}
          >
            {sim?.running ? "Running" : "Stopped"}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Generates plausible round-by-round results across all 234 ACs. Use for
          rehearsal, NOT on counting day.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-[var(--text-secondary)]">
            Interval (ms)
            <input
              type="number"
              value={intervalMs}
              onChange={(e) => setIntervalMs(parseInt(e.target.value, 10) || 800)}
              className="ml-2 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 w-24 tabular"
            />
          </label>
          <button
            onClick={() => call("start")}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-[var(--accent-won)]/20 hover:bg-[var(--accent-won)]/30 text-[var(--accent-won)] border border-[var(--accent-won)]/40 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            ▶ Start
          </button>
          <button
            onClick={() => call("stop")}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-[var(--accent-counting)]/20 hover:bg-[var(--accent-counting)]/30 text-[var(--accent-counting)] border border-[var(--accent-counting)]/40 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            ❚❚ Stop
          </button>
          <button
            onClick={() => call("reset")}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-[var(--accent-live)]/20 hover:bg-[var(--accent-live)]/30 text-[var(--accent-live)] border border-[var(--accent-live)]/40 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            ↻ Reset
          </button>
          {sim && (
            <span className="text-xs text-[var(--text-muted)] tabular ml-auto">
              Tick {sim.currentTick} · {sim.intervalMs}ms
            </span>
          )}
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChyronComposer />
        <StorylinesPanel />
      </section>

      <VipManager onMessage={onMessage} authHeaders={authHeaders} />
    </div>
  );
}

/* ─────────── VIP Manager ─────────── */

type SearchHit = {
  id: number;
  name: string;
  party_id: string;
  constituency_id: number;
  constituency_name: string;
  district: string;
};

type ApiVip = {
  id?: string;
  name: string;
  role: string;
  constituencyId: number;
  expectedParty: string;
  source: "static" | "runtime";
};

function VipManager({
  authHeaders,
  onMessage,
}: {
  authHeaders: () => Record<string, string>;
  onMessage: (m: { type: "ok" | "err"; text: string }) => void;
}) {
  const [vips, setVips] = useState<ApiVip[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [role, setRole] = useState("Marquee race");
  const [busy, setBusy] = useState(false);

  const refreshVips = () =>
    fetch("/api/vips").then((r) => r.json()).then((d) => setVips(d.vips ?? []));
  useEffect(() => {
    refreshVips();
  }, []);

  // Live typeahead — debounced
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/candidates/search?q=${encodeURIComponent(q)}&limit=15`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  async function addVip(hit: SearchHit) {
    setBusy(true);
    try {
      const res = await fetch("/api/vips", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ candidateId: hit.id, role: role || "Marquee race" }),
      });
      const data = await res.json();
      if (res.ok) {
        onMessage({ type: "ok", text: `Added ${data.name} to VIPs` });
        setQuery("");
        setResults([]);
        refreshVips();
      } else {
        onMessage({ type: "err", text: data.error ?? "Failed" });
      }
    } catch (err) {
      onMessage({ type: "err", text: String(err) });
    }
    setBusy(false);
  }

  async function removeVip(id: string) {
    if (!id.startsWith("r:")) {
      onMessage({ type: "err", text: "Static VIPs (from data/vips.json) can't be removed via UI" });
      return;
    }
    const realId = id.slice(2);
    setBusy(true);
    try {
      const res = await fetch(`/api/vips?id=${realId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        onMessage({ type: "ok", text: `Removed VIP` });
        refreshVips();
      } else {
        onMessage({ type: "err", text: data.error ?? "Failed" });
      }
    } catch (err) {
      onMessage({ type: "err", text: String(err) });
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          VIP / Marquee races
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {vips.length} tracked
        </span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        Search any candidate by name (or AC name, or party slug) and click to add to the VIP marquee.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-2 mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search candidates — try "stalin", "vijay", "kolathur", "DMK"…'
          className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (shown under name)"
          className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent-lead)] outline-none"
        />
      </div>

      {results.length > 0 && (
        <div className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg max-h-[260px] overflow-y-auto mb-3">
          {results.map((r) => {
            const party = partyById(r.party_id);
            return (
              <button
                key={r.id}
                onClick={() => addVip(r)}
                disabled={busy}
                className="w-full text-left px-3 py-2 flex items-center gap-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: `${party.color}25`, color: party.color, border: `1px solid ${party.color}50` }}
                >
                  {party.name}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{r.name}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    AC#{r.constituency_id} {r.constituency_name} · {r.district}
                  </div>
                </div>
                <span className="text-xs text-[var(--accent-lead)] font-bold shrink-0">+ Add</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Current VIP list */}
      <div className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">AC</th>
              <th className="text-left p-2">Party</th>
              <th className="text-right p-2 w-20">Source</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {vips.map((v) => {
              const party = partyById(v.expectedParty);
              return (
                <tr key={v.id ?? `s:${v.constituencyId}`} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="p-2 font-medium">{v.name}</td>
                  <td className="p-2 text-xs text-[var(--text-secondary)]">{v.role}</td>
                  <td className="p-2 tabular text-xs">#{v.constituencyId}</td>
                  <td className="p-2" style={{ color: party.color }}>{party.name}</td>
                  <td className="p-2 text-right">
                    <span
                      className={cn(
                        "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                        v.source === "runtime"
                          ? "bg-[var(--accent-lead)]/15 border-[var(--accent-lead)]/40 text-[var(--accent-lead)]"
                          : "bg-white/5 border-[var(--border)] text-[var(--text-muted)]",
                      )}
                    >
                      {v.source}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    {v.source === "runtime" && v.id && (
                      <button
                        onClick={() => removeVip(v.id!)}
                        disabled={busy}
                        title="Remove from VIPs"
                        className="text-[var(--accent-live)] hover:text-[var(--accent-live)]/70 text-xs px-2"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {vips.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-[var(--text-muted)] py-4 text-xs">
                  No VIPs yet. Search above to add some.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
