import { getHub } from "@/lib/server/hub";
import type { StreamMessage } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events: a full snapshot on connect, then small patches as things change. */
export async function GET(req: Request) {
  const hub = getHub();
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: StreamMessage) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(msg)}\n\n`));
      };
      send({ type: "snapshot", data: hub.snapshot });
      const unsub = hub.subscribe(send);
      // Comment heartbeat keeps proxies (Caddy/Nginx/Cloudflare) from idling the stream out
      const beat = setInterval(() => controller.enqueue(enc.encode(`: hb\n\n`)), 20000);
      cleanup = () => {
        unsub();
        clearInterval(beat);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
