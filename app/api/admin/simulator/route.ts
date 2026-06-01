import { NextResponse } from "next/server";
import { startSimulator, stopSimulator, resetSimulator, getSimulatorState } from "@/lib/simulator";
import { publish } from "@/lib/events";
import { getStateSummary, getConstituencySummaries } from "@/lib/queries";
import { checkAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getSimulatorState());
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "start" | "stop" | "reset" | undefined;
  const intervalMs = typeof body.intervalMs === "number" ? body.intervalMs : 1500;

  switch (action) {
    case "start":
      startSimulator(intervalMs);
      break;
    case "stop":
      stopSimulator();
      break;
    case "reset":
      resetSimulator();
      publish("update", {
        state: getStateSummary(),
        constituencies: getConstituencySummaries(),
      });
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, state: getSimulatorState() });
}
