import { NextResponse } from "next/server";
import { listOtherStates, seedOtherStatesIfEmpty } from "@/lib/states";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read-only list of non-TN states with manually-maintained party totals.
 * Powers the multi-state broadcast scene + admin editor.
 */
export async function GET() {
  // Seed on first read so a fresh deploy already has Kerala / WB / PY / AS rows.
  try {
    seedOtherStatesIfEmpty();
  } catch {
    /* ignore — table may not exist on stale schema */
  }
  const states = listOtherStates();
  return NextResponse.json({ states });
}
