import { NextResponse } from "next/server";
import { heartbeat, release, snapshot } from "@/lib/presence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, editing: snapshot() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "heartbeat";
  const name = (body.name || "anonymous").toString();
  const acId = Number(body.acId);

  if (!Number.isFinite(acId)) {
    return NextResponse.json({ error: "acId required" }, { status: 400 });
  }

  if (action === "release") release(name, acId);
  else heartbeat(name, acId);

  return NextResponse.json({ ok: true, editing: snapshot() });
}
