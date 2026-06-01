import { NextResponse } from "next/server";
import { loadTnMap } from "@/lib/tn-map";

export const dynamic = "force-static";
export const runtime = "nodejs";

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    cached = JSON.stringify(loadTnMap());
  }
  return new NextResponse(cached, {
    headers: {
      "Content-Type": "application/json",
      // The map shapes are static — cache aggressively at the edge
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
