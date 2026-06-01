import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import {
  listSlots,
  upsertSlot,
  clearSlot,
  muteAllSlots,
  soloSlot,
  MAX_SLOTS,
} from "@/lib/broadcast-slots";
import { parseSource } from "@/lib/broadcast-source";
import { publish } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin endpoints for the broadcast slot mixer. All writes are scoped to
 * the AUTHENTICATED tenant — Aadhan operators cannot touch Naadhas's
 * mixer or vice versa.
 *
 *   POST   { slotIndex, sourceUrl?, muted?, volume?, label?, fit? }
 *            Upsert one slot. sourceType is re-classified server-side
 *            so it can't be spoofed.
 *
 *   POST   { action: 'muteAll' }      → panic mute every slot for tenant
 *   POST   { action: 'solo', slotIndex } → unmute one, mute others
 *
 *   DELETE ?slotIndex=N               → clear a slot
 *
 * Every mutation publishes a `slots-update` SSE event TARGETED at the
 * tenant — other tenants don't see it.
 */
export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const { tenantId } = auth;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });

  if (body.action === "muteAll") {
    muteAllSlots(tenantId);
    publishUpdate(tenantId);
    return NextResponse.json({ ok: true, slots: listSlots(tenantId) });
  }

  if (body.action === "solo") {
    const idx = Number(body.slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_SLOTS) {
      return NextResponse.json({ error: "valid slotIndex required" }, { status: 400 });
    }
    soloSlot(tenantId, idx);
    publishUpdate(tenantId);
    return NextResponse.json({ ok: true, slots: listSlots(tenantId) });
  }

  const idx = Number(body.slotIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_SLOTS) {
    return NextResponse.json({ error: "valid slotIndex required" }, { status: 400 });
  }

  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
  const parsed = parseSource(sourceUrl);

  upsertSlot(tenantId, {
    slotIndex: idx,
    sourceUrl,
    sourceType: parsed.type,
    muted: body.muted === false ? false : true,
    volume:
      typeof body.volume === "number" && Number.isFinite(body.volume)
        ? Math.max(0, Math.min(1, body.volume))
        : undefined,
    label: typeof body.label === "string" ? body.label : "",
    fit: body.fit === "contain" ? "contain" : "cover",
  });

  publishUpdate(tenantId);
  return NextResponse.json({ ok: true, slots: listSlots(tenantId) });
}

export async function DELETE(req: Request) {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.response;
  const { tenantId } = auth;

  const url = new URL(req.url);
  const idx = Number(url.searchParams.get("slotIndex"));
  if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_SLOTS) {
    return NextResponse.json({ error: "valid slotIndex required" }, { status: 400 });
  }
  clearSlot(tenantId, idx);
  publishUpdate(tenantId);
  return NextResponse.json({ ok: true, slots: listSlots(tenantId) });
}

function publishUpdate(tenantId: string) {
  publish(
    "slots-update",
    { slots: listSlots(tenantId), tenantId, at: Date.now() },
    { tenantId },
  );
}
