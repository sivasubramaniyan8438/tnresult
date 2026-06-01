import { getDb } from "./db";

export const MAX_SLOTS = 6;
export const DEFAULT_SLOT_TENANT = "naadhas";

export type BroadcastSlot = {
  slotIndex: number;
  sourceUrl: string;
  sourceType: string;
  muted: boolean;
  volume: number;
  label: string;
  fit: "cover" | "contain";
  updatedAt: number;
};

export type BroadcastSlotPreset = {
  id: number;
  label: string;
  sourceUrl: string;
  muted: boolean;
  sequence: number;
  createdAt: number;
};

type SlotRow = {
  tenant_id: string;
  slot_index: number;
  source_url: string;
  source_type: string;
  muted: number;
  volume: number;
  label: string;
  fit: string;
  updated_at: number;
};

function rowToSlot(r: SlotRow): BroadcastSlot {
  return {
    slotIndex: r.slot_index,
    sourceUrl: r.source_url,
    sourceType: r.source_type,
    muted: r.muted !== 0,
    volume: r.volume,
    label: r.label,
    fit: r.fit === "contain" ? "contain" : "cover",
    updatedAt: r.updated_at,
  };
}

function emptySlot(idx: number): BroadcastSlot {
  return {
    slotIndex: idx,
    sourceUrl: "",
    sourceType: "",
    muted: true,
    volume: 1,
    label: "",
    fit: "cover",
    updatedAt: 0,
  };
}

/** Returns one entry per slot 0..MAX_SLOTS-1 for the given tenant,
 *  with empty defaults for slots that have never been configured. */
export function listSlots(tenantId: string): BroadcastSlot[] {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const rows = getDb()
    .prepare(
      "SELECT * FROM broadcast_slots WHERE tenant_id = ? ORDER BY slot_index ASC",
    )
    .all(tid) as SlotRow[];
  const byIdx = new Map(rows.map((r) => [r.slot_index, rowToSlot(r)]));
  const out: BroadcastSlot[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    out.push(byIdx.get(i) ?? emptySlot(i));
  }
  return out;
}

export function upsertSlot(
  tenantId: string,
  input: {
    slotIndex: number;
    sourceUrl: string;
    sourceType: string;
    muted?: boolean;
    volume?: number;
    label?: string;
    fit?: "cover" | "contain";
  },
): BroadcastSlot {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const idx = Math.max(0, Math.min(MAX_SLOTS - 1, input.slotIndex | 0));
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO broadcast_slots
         (tenant_id, slot_index, source_url, source_type, muted, volume, label, fit, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, slot_index) DO UPDATE SET
         source_url = excluded.source_url,
         source_type = excluded.source_type,
         muted = excluded.muted,
         volume = excluded.volume,
         label = excluded.label,
         fit = excluded.fit,
         updated_at = excluded.updated_at`,
    )
    .run(
      tid,
      idx,
      input.sourceUrl ?? "",
      input.sourceType ?? "",
      input.muted === false ? 0 : 1,
      typeof input.volume === "number" ? Math.max(0, Math.min(1, input.volume)) : 1,
      (input.label ?? "").slice(0, 80),
      input.fit === "contain" ? "contain" : "cover",
      now,
    );
  return {
    slotIndex: idx,
    sourceUrl: input.sourceUrl ?? "",
    sourceType: input.sourceType ?? "",
    muted: input.muted !== false,
    volume: typeof input.volume === "number" ? input.volume : 1,
    label: input.label ?? "",
    fit: input.fit === "contain" ? "contain" : "cover",
    updatedAt: now,
  };
}

export function clearSlot(tenantId: string, slotIndex: number): void {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const idx = Math.max(0, Math.min(MAX_SLOTS - 1, slotIndex | 0));
  getDb()
    .prepare("DELETE FROM broadcast_slots WHERE tenant_id = ? AND slot_index = ?")
    .run(tid, idx);
}

/** Mute every slot for one tenant (panic button). */
export function muteAllSlots(tenantId: string): void {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const now = Date.now();
  getDb()
    .prepare("UPDATE broadcast_slots SET muted = 1, updated_at = ? WHERE tenant_id = ?")
    .run(now, tid);
}

/** Unmute one slot, mute all others (audio "solo") for one tenant. */
export function soloSlot(tenantId: string, slotIndex: number): void {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const idx = Math.max(0, Math.min(MAX_SLOTS - 1, slotIndex | 0));
  const now = Date.now();
  const db = getDb();
  db.prepare("UPDATE broadcast_slots SET muted = 1, updated_at = ? WHERE tenant_id = ?").run(now, tid);
  db.prepare(
    "UPDATE broadcast_slots SET muted = 0, updated_at = ? WHERE tenant_id = ? AND slot_index = ?",
  ).run(now, tid, idx);
}

// ── Presets ─────────────────────────────────────────────────────────

type PresetRow = {
  id: number;
  tenant_id: string;
  label: string;
  source_url: string;
  muted: number;
  sequence: number;
  created_at: number;
};

function rowToPreset(r: PresetRow): BroadcastSlotPreset {
  return {
    id: r.id,
    label: r.label,
    sourceUrl: r.source_url,
    muted: r.muted !== 0,
    sequence: r.sequence,
    createdAt: r.created_at,
  };
}

export function listPresets(tenantId: string): BroadcastSlotPreset[] {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const rows = getDb()
    .prepare(
      "SELECT * FROM broadcast_slot_presets WHERE tenant_id = ? ORDER BY sequence ASC, created_at ASC",
    )
    .all(tid) as PresetRow[];
  return rows.map(rowToPreset);
}

export function createPreset(
  tenantId: string,
  input: {
    label: string;
    sourceUrl: string;
    muted?: boolean;
    sequence?: number;
  },
): BroadcastSlotPreset {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  const info = getDb()
    .prepare(
      `INSERT INTO broadcast_slot_presets (tenant_id, label, source_url, muted, sequence, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tid,
      input.label.slice(0, 80),
      input.sourceUrl,
      input.muted === false ? 0 : 1,
      input.sequence ?? 99,
      Date.now(),
    );
  return {
    id: Number(info.lastInsertRowid),
    label: input.label,
    sourceUrl: input.sourceUrl,
    muted: input.muted !== false,
    sequence: input.sequence ?? 99,
    createdAt: Date.now(),
  };
}

export function deletePreset(tenantId: string, id: number): void {
  const tid = tenantId || DEFAULT_SLOT_TENANT;
  getDb()
    .prepare("DELETE FROM broadcast_slot_presets WHERE tenant_id = ? AND id = ?")
    .run(tid, id);
}
