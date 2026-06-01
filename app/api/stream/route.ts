import { subscribe } from "@/lib/events";
import { getStateSummary, getConstituencySummaries } from "@/lib/queries";
import { getCurrentChyron } from "@/lib/chyron";
import { listSlots } from "@/lib/broadcast-slots";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  // Resolve tenant from session cookie at connection time. Each SSE
  // connection is bound to a single tenant; tenant-scoped publishes (slot
  // mixer changes) only reach the listeners for that tenant.
  const tenantId = await resolveTenant(req);

  let closed = false;
  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
          cleanup?.();
        }
      };

      // Initial snapshot
      const snapshot = {
        state: getStateSummary(),
        constituencies: getConstituencySummaries(),
      };
      send(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      const currentChyron = getCurrentChyron();
      if (currentChyron) {
        send(`event: chyron\ndata: ${JSON.stringify(currentChyron)}\n\n`);
      }
      // Initial slots snapshot — tenant-scoped, so this connection only
      // ever sees its own channel's slot mixer state.
      send(
        `event: slots-update\ndata: ${JSON.stringify({ slots: listSlots(tenantId), tenantId, at: Date.now() })}\n\n`,
      );

      const unsub = subscribe((data) => send(data), { tenantId });

      const keepalive = setInterval(() => {
        send(`: keepalive ${Date.now()}\n\n`);
      }, 15000);

      cleanup = () => {
        clearInterval(keepalive);
        unsub();
      };
    },
    cancel() {
      closed = true;
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
