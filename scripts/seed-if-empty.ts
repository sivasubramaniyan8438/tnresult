/**
 * Idempotent seed: only runs if the constituencies table is empty.
 * Used as part of the Railway start command so the DB initializes on first boot
 * and is left alone on subsequent restarts.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getDb, getMeta, setMeta } from "../lib/db";

const REAL_CANDIDATES_PATH = path.join(process.cwd(), "data", "candidates-real.json");

function realDataFingerprint(): string | null {
  if (!fs.existsSync(REAL_CANDIDATES_PATH)) return null;
  const stat = fs.statSync(REAL_CANDIDATES_PATH);
  return `${stat.size}:${stat.mtimeMs}`;
}

const db = getDb();
const row = db.prepare("SELECT COUNT(*) AS n FROM constituencies").get() as { n: number };

const force = process.env.RESEED === "1";
const lastFp = getMeta("candidates_real_fingerprint");
const currentFp = realDataFingerprint();
const fpChanged = currentFp && currentFp !== lastFp;

if (row.n > 0 && !force && !fpChanged) {
  console.log(
    `[seed-if-empty] DB already has ${row.n} constituencies, candidates-real.json unchanged — skipping seed.`,
  );
  process.exit(0);
}

if (force) console.log("[seed-if-empty] RESEED=1 set, forcing reseed…");
else if (fpChanged) console.log("[seed-if-empty] candidates-real.json changed, reseeding…");
else console.log("[seed-if-empty] DB is empty, running seed…");

execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
if (currentFp) setMeta("candidates_real_fingerprint", currentFp);
