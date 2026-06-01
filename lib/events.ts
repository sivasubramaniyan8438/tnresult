/**
 * In-process event bus that backs the SSE channel at /api/stream.
 *
 * Events are either GLOBAL (apply to all tenants — vote updates, chyrons,
 * storylines) or TENANT-SCOPED (slot-mixer changes for one channel only).
 *
 * Subscribers register with an optional `tenantId`; tenant-scoped events
 * only reach listeners whose tenantId matches. Global events (no tenantId
 * on the publish) reach everyone, regardless of subscriber filter.
 */
type ListenerEntry = {
  cb: (data: string) => void;
  tenantId?: string | null;
};

const g = globalThis as unknown as { __tnEventBus?: Set<ListenerEntry> };
if (!g.__tnEventBus) g.__tnEventBus = new Set();
const listeners = g.__tnEventBus;

export function publish(
  event: string,
  payload: unknown,
  opts: { tenantId?: string } = {},
) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  const eventTenant = opts.tenantId;
  for (const l of listeners) {
    // Tenant-scoped event: only deliver to listeners with matching tenantId.
    // (Listener with no tenantId still receives — useful for ops/debug
    // tooling that wants to see everything.)
    if (eventTenant && l.tenantId && l.tenantId !== eventTenant) continue;
    try {
      l.cb(data);
    } catch {
      // listener detached
    }
  }
}

export function subscribe(
  cb: (data: string) => void,
  opts: { tenantId?: string | null } = {},
): () => void {
  const entry: ListenerEntry = { cb, tenantId: opts.tenantId };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

export function listenerCount() {
  return listeners.size;
}
