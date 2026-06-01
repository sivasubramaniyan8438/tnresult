"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ConstituencySummary, StateSummary } from "@/lib/schema";
import type { Chyron } from "@/lib/chyron";
import type { Storyline } from "@/lib/storylines";
import type { BroadcastSlot } from "@/lib/broadcast-slots";

type Snapshot = {
  state: StateSummary | null;
  constituencies: ConstituencySummary[];
  connected: boolean;
  recentlyChanged: Set<number>;
  chyron: Chyron | null;
  storylines: Storyline[];
  slots: BroadcastSlot[];
};

const Ctx = createContext<Snapshot>({
  state: null,
  constituencies: [],
  connected: false,
  recentlyChanged: new Set(),
  chyron: null,
  storylines: [],
  slots: [],
});

export function useLiveData() {
  return useContext(Ctx);
}

export function LiveDataProvider({
  initialState,
  initialConstituencies,
  children,
}: {
  initialState: StateSummary | null;
  initialConstituencies: ConstituencySummary[];
  children: React.ReactNode;
}) {
  const [state, setState] = useState<StateSummary | null>(initialState);
  const [constituencies, setConstituencies] =
    useState<ConstituencySummary[]>(initialConstituencies);
  const [connected, setConnected] = useState(false);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<number>>(new Set());
  const [chyron, setChyron] = useState<Chyron | null>(null);
  const [storylines, setStorylines] = useState<Storyline[]>([]);
  const [slots, setSlots] = useState<BroadcastSlot[]>([]);
  const prevByIdRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const es = new EventSource("/api/stream");

    const handleData = (data: { state: StateSummary; constituencies: ConstituencySummary[] }) => {
      setState(data.state);

      // Detect which constituencies changed (updatedAt advanced)
      const prev = prevByIdRef.current;
      const next = new Map<number, number>();
      const changed = new Set<number>();
      for (const c of data.constituencies) {
        next.set(c.constituencyId, c.updatedAt);
        const prevTs = prev.get(c.constituencyId) ?? 0;
        if (c.updatedAt > prevTs) changed.add(c.constituencyId);
      }
      prevByIdRef.current = next;
      setConstituencies(data.constituencies);
      if (changed.size > 0) {
        setRecentlyChanged(changed);
        const t = setTimeout(() => setRecentlyChanged(new Set()), 1500);
        return () => clearTimeout(t);
      }
    };

    es.addEventListener("snapshot", (ev) => {
      try {
        handleData(JSON.parse((ev as MessageEvent).data));
      } catch (err) {
        console.error("snapshot parse failed", err);
      }
    });
    es.addEventListener("update", (ev) => {
      try {
        handleData(JSON.parse((ev as MessageEvent).data));
      } catch (err) {
        console.error("update parse failed", err);
      }
    });

    es.addEventListener("chyron", (ev) => {
      try {
        const c = JSON.parse((ev as MessageEvent).data) as Chyron;
        setChyron(c);
        // Auto-clear locally based on duration
        const remaining = c.durationMs - (Date.now() - c.createdAt);
        if (remaining > 0) {
          setTimeout(() => setChyron((cur) => (cur?.id === c.id ? null : cur)), remaining);
        }
      } catch (err) {
        console.error("chyron parse failed", err);
      }
    });
    es.addEventListener("chyron-clear", () => setChyron(null));
    es.addEventListener("slots-update", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { slots: BroadcastSlot[] };
        if (Array.isArray(d.slots)) setSlots(d.slots);
      } catch (err) {
        console.error("slots-update parse failed", err);
      }
    });
    es.addEventListener("storyline", (ev) => {
      try {
        const s = JSON.parse((ev as MessageEvent).data) as Storyline;
        setStorylines((prev) => [s, ...prev].slice(0, 50));
      } catch (err) {
        console.error("storyline parse failed", err);
      }
    });

    // Initial fetch of any existing storylines (won't be in SSE snapshot)
    fetch("/api/storylines")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.storylines)) setStorylines(d.storylines);
      })
      .catch(() => {});

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return (
    <Ctx.Provider value={{ state, constituencies, connected, recentlyChanged, chyron, storylines, slots }}>
      {children}
    </Ctx.Provider>
  );
}
