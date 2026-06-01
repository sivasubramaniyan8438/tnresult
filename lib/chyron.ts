import { publish } from "./events";

export type Chyron = {
  id: string;
  template: "BREAKING" | "CALL" | "MILESTONE" | "QUOTE";
  headline: string;
  subhead?: string;
  durationMs: number;
  createdAt: number;
};

type Store = { current: Chyron | null };

const g = globalThis as unknown as { __tnChyron?: Store };
if (!g.__tnChyron) g.__tnChyron = { current: null };
const store = g.__tnChyron!;

export function getCurrentChyron(): Chyron | null {
  if (!store.current) return null;
  // Auto-expire
  if (Date.now() - store.current.createdAt > store.current.durationMs) {
    store.current = null;
    return null;
  }
  return store.current;
}

export function pushChyron(input: Omit<Chyron, "id" | "createdAt">): Chyron {
  const chyron: Chyron = {
    ...input,
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: Date.now(),
  };
  store.current = chyron;
  publish("chyron", chyron);
  // Also auto-clear after duration
  setTimeout(() => {
    if (store.current?.id === chyron.id) {
      store.current = null;
      publish("chyron-clear", { id: chyron.id });
    }
  }, chyron.durationMs);
  return chyron;
}

export function clearChyron() {
  store.current = null;
  publish("chyron-clear", { id: "all" });
}
