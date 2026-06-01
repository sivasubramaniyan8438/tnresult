import { NextResponse } from "next/server";
import { getRecentStorylines, clearStorylines } from "@/lib/storylines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ storylines: getRecentStorylines(40) });
}

export async function DELETE() {
  clearStorylines();
  return NextResponse.json({ ok: true });
}
