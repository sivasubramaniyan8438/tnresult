/**
 * Lightweight in-memory presence: who is currently editing which AC.
 *
 * Each /admin client heartbeats every 20s with { name, acId }. The server keeps
 * a Map<acId, { name, lastSeen }> and entries older than 90s are dropped on read.
 *
 * For a single-instance Railway deploy this is fine. For HA we'd need Redis.
 */

type PresenceEntry = {
  acId: number;
  name: string;
  lastSeen: number;
};

const TTL_MS = 90_000;

// keyed by `${name}:${acId}` so the same name on two ACs doesn't collide
const editing = new Map<string, PresenceEntry>();

function gc() {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of editing) {
    if (v.lastSeen < cutoff) editing.delete(k);
  }
}

export function heartbeat(name: string, acId: number) {
  const trimmedName = (name || "anonymous").slice(0, 40).trim() || "anonymous";
  if (!Number.isFinite(acId)) return;
  editing.set(`${trimmedName}:${acId}`, {
    acId,
    name: trimmedName,
    lastSeen: Date.now(),
  });
  gc();
}

export function release(name: string, acId: number) {
  editing.delete(`${name.slice(0, 40).trim()}:${acId}`);
}

export function snapshot(): Record<number, string[]> {
  gc();
  const result: Record<number, string[]> = {};
  for (const v of editing.values()) {
    if (!result[v.acId]) result[v.acId] = [];
    result[v.acId].push(v.name);
  }
  return result;
}
