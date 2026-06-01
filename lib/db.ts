import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "tn.db");

let _db: Database.Database | null = null;

let _logged = false;
function logDbLocation() {
  if (_logged) return;
  _logged = true;
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME;
  const isProdLike = railwayEnv || process.env.NODE_ENV === "production";

  // Loud warning if running in production-like env without a /data-style mount.
  // Railway volumes mount under arbitrary paths but you must explicitly point
  // DB_PATH at the mount. Default ./data writes to the EPHEMERAL container FS
  // and will be wiped on every deploy/restart.
  if (isProdLike && (!process.env.DB_PATH || !path.isAbsolute(DB_PATH))) {
    console.error(
      `[db] ⚠️  DB_PATH is not absolute (=${DB_PATH}) — data will be EPHEMERAL on this host.\n` +
        `      In Railway: create a volume, mount it (e.g. /data), and set DB_PATH=/data/tn.db.`,
    );
  }
  console.log(`[db] using SQLite at ${DB_PATH}${isProdLike ? ` (env=${railwayEnv ?? "production"})` : ""}`);
}

export function getDb(): Database.Database {
  if (_db) return _db;
  logDbLocation();

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS constituencies (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      district TEXT NOT NULL,
      reservation TEXT NOT NULL DEFAULT 'GEN'
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      constituency_id INTEGER NOT NULL REFERENCES constituencies(id),
      name TEXT NOT NULL,
      party_id TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_candidates_constituency ON candidates(constituency_id);

    CREATE TABLE IF NOT EXISTS results (
      candidate_id INTEGER PRIMARY KEY REFERENCES candidates(id),
      constituency_id INTEGER NOT NULL REFERENCES constituencies(id),
      votes INTEGER NOT NULL DEFAULT 0,
      round INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_results_constituency ON results(constituency_id);

    CREATE TABLE IF NOT EXISTS constituency_state (
      constituency_id INTEGER PRIMARY KEY REFERENCES constituencies(id),
      status TEXT NOT NULL DEFAULT 'pending',
      round INTEGER NOT NULL DEFAULT 0,
      total_rounds INTEGER NOT NULL DEFAULT 20,
      total_votes INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS round_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      constituency_id INTEGER NOT NULL REFERENCES constituencies(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      round INTEGER NOT NULL,
      votes INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_round_history_constituency_round ON round_history(constituency_id, round);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      party_id TEXT NOT NULL,
      total INTEGER NOT NULL,
      vote_share REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_state_history_time ON state_history(created_at);

    CREATE TABLE IF NOT EXISTS vip_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL UNIQUE REFERENCES candidates(id),
      role TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS vote_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      constituency_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      votes_before INTEGER NOT NULL,
      votes_after INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      status_before TEXT,
      status_after TEXT,
      actor TEXT NOT NULL,
      source TEXT NOT NULL,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vote_audit_constituency ON vote_audit(constituency_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_vote_audit_time ON vote_audit(created_at);

    -- Other states' aggregated party totals — manually maintained via /admin/states
    -- so the broadcast can show TN at center alongside Kerala / WB / Puducherry / etc.
    -- Parties stored as JSON [{partyId, label, total, delta}, ...] for simplicity.
    CREATE TABLE IF NOT EXISTS other_states (
      id TEXT PRIMARY KEY,            -- 'KL', 'WB', 'PY', 'AS' etc
      name TEXT NOT NULL,             -- 'Kerala', 'West Bengal'
      total_seats INTEGER NOT NULL,
      reporting_seats INTEGER NOT NULL DEFAULT 0,
      parties_json TEXT NOT NULL DEFAULT '[]',
      sequence INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    -- Per-camera-slot streaming source for the broadcast view. Empty rows
    -- (or url='') mean "transparent slot — let OBS overlay video over it",
    -- so this feature is purely additive and doesn't break the existing
    -- OBS-composite workflow.
    --   tenant_id: 'naadhas' | 'aadhan' — slots are scoped per tenant so
    --              each channel runs an independent slot mixer
    --   slot_index: 0..5 — matches camera-tile order in CameraFrameWrapper
    --   source_type: 'youtube' | 'twitch' | 'hls' | 'mp4' | 'iframe' | ''
    --   muted: 1 (default — broadcast safety) or 0
    --   fit: 'cover' or 'contain'
    CREATE TABLE IF NOT EXISTS broadcast_slots (
      tenant_id TEXT NOT NULL DEFAULT 'naadhas',
      slot_index INTEGER NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT '',
      muted INTEGER NOT NULL DEFAULT 1,
      volume REAL NOT NULL DEFAULT 1.0,
      label TEXT NOT NULL DEFAULT '',
      fit TEXT NOT NULL DEFAULT 'cover',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, slot_index)
    );

    -- Saved presets for one-click slot loading mid-show, also tenant-scoped.
    -- (Index on (tenant_id, sequence) is created AFTER the tenant-scope
    -- migration block below, since older databases may have a presets
    -- table that's missing the tenant_id column.)
    CREATE TABLE IF NOT EXISTS broadcast_slot_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL DEFAULT 'naadhas',
      label TEXT NOT NULL,
      source_url TEXT NOT NULL,
      muted INTEGER NOT NULL DEFAULT 1,
      sequence INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    -- Migrate older databases that didn't have last_actor column
    -- (no-op for fresh installs)
  `);

  // Idempotent column add for last_actor — SQLite doesn't support IF NOT EXISTS on ADD COLUMN
  try {
    db.exec("ALTER TABLE constituency_state ADD COLUMN last_actor TEXT");
  } catch { /* column already exists */ }
  try {
    db.exec("ALTER TABLE constituency_state ADD COLUMN last_source TEXT");
  } catch { /* column already exists */ }
  try {
    db.exec("ALTER TABLE constituency_state ADD COLUMN last_manual_at INTEGER NOT NULL DEFAULT 0");
  } catch { /* column already exists */ }
  try {
    db.exec("ALTER TABLE constituency_state ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0");
  } catch { /* column already exists */ }
  try {
    db.exec("ALTER TABLE constituencies ADD COLUMN electorate INTEGER NOT NULL DEFAULT 0");
  } catch { /* column already exists */ }

  // ── broadcast_slots: tenant-scope migration ────────────────────────
  // The original v1 schema (deployed earlier today) had `slot_index` as the
  // sole PRIMARY KEY and no tenant column. SQLite can't add a column AND
  // change the primary key in place, so detect a v1 table and rebuild it.
  // No-op for fresh installs (table already created with the v2 schema).
  try {
    const slotsCols = db.prepare("PRAGMA table_info(broadcast_slots)").all() as { name: string }[];
    const hasTenant = slotsCols.some((c) => c.name === "tenant_id");
    if (slotsCols.length > 0 && !hasTenant) {
      console.log("[db] migrating broadcast_slots → tenant-scoped schema");
      db.exec(`
        ALTER TABLE broadcast_slots RENAME TO broadcast_slots_v1;
        CREATE TABLE broadcast_slots (
          tenant_id TEXT NOT NULL DEFAULT 'naadhas',
          slot_index INTEGER NOT NULL,
          source_url TEXT NOT NULL DEFAULT '',
          source_type TEXT NOT NULL DEFAULT '',
          muted INTEGER NOT NULL DEFAULT 1,
          volume REAL NOT NULL DEFAULT 1.0,
          label TEXT NOT NULL DEFAULT '',
          fit TEXT NOT NULL DEFAULT 'cover',
          updated_at INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (tenant_id, slot_index)
        );
        INSERT INTO broadcast_slots
          (tenant_id, slot_index, source_url, source_type, muted, volume, label, fit, updated_at)
          SELECT 'naadhas', slot_index, source_url, source_type, muted, volume, label, fit, updated_at
          FROM broadcast_slots_v1;
        DROP TABLE broadcast_slots_v1;
      `);
    }
  } catch (err) {
    console.error("[db] broadcast_slots tenant migration failed:", err);
  }
  try {
    const presetCols = db.prepare("PRAGMA table_info(broadcast_slot_presets)").all() as { name: string }[];
    const hasTenant = presetCols.some((c) => c.name === "tenant_id");
    if (presetCols.length > 0 && !hasTenant) {
      console.log("[db] migrating broadcast_slot_presets → tenant-scoped schema");
      db.exec("ALTER TABLE broadcast_slot_presets ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'naadhas'");
    }
  } catch (err) {
    console.error("[db] broadcast_slot_presets tenant migration failed:", err);
  }

  // Now that tenant_id is guaranteed to exist on broadcast_slot_presets,
  // create the lookup index. Safe on fresh installs too.
  try {
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_broadcast_presets_tenant_seq ON broadcast_slot_presets(tenant_id, sequence)",
    );
  } catch (err) {
    console.error("[db] broadcast_slot_presets index creation failed:", err);
  }

  _db = db;
  return db;
}

export function setMeta(key: string, value: string) {
  getDb().prepare("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)").run(key, value);
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}
