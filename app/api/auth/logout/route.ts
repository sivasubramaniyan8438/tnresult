import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const opts = sessionCookieOptions(0);
  const store = await cookies();
  store.set({ ...opts, value: "" });
  return NextResponse.json({ ok: true });
}
