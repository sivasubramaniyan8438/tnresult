import { NextResponse } from "next/server";
import { getCurrentChyron, pushChyron, clearChyron, type Chyron } from "@/lib/chyron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ current: getCurrentChyron() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "clear") {
    clearChyron();
    return NextResponse.json({ ok: true });
  }
  const tpl = body.template as Chyron["template"] | undefined;
  if (!tpl || !body.headline) {
    return NextResponse.json({ error: "template and headline required" }, { status: 400 });
  }
  const chyron = pushChyron({
    template: tpl,
    headline: String(body.headline),
    subhead: body.subhead ? String(body.subhead) : undefined,
    durationMs: typeof body.durationMs === "number" ? body.durationMs : 8000,
  });
  return NextResponse.json({ ok: true, chyron });
}
