import { NextResponse } from "next/server";
import { getStateSummary, getConstituencySummaries } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = getStateSummary();
  const constituencies = getConstituencySummaries();
  return NextResponse.json({ state, constituencies });
}
