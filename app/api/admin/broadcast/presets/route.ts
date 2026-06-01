import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { listPresets, createPreset, deletePreset } from "@/lib/broadcast-slots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ presets: listPresets(auth.tenantId) });
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const body = (await req.json().catch(() => null)) as {
    label?: string;
    sourceUrl?: string;
    muted?: boolean;
    sequence?: number;
  } | null;
  if (!body || !body.label || !body.sourceUrl) {
    return NextResponse.json({ error: "label and sourceUrl required" }, { status: 400 });
  }
  const created = createPreset(auth.tenantId, {
    label: body.label,
    sourceUrl: body.sourceUrl,
    muted: body.muted,
    sequence: body.sequence,
  });
  return NextResponse.json({ ok: true, preset: created });
}

export async function DELETE(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }
  deletePreset(auth.tenantId, id);
  return NextResponse.json({ ok: true });
}
