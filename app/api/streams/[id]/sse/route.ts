import { prisma } from "@/lib/prisma";
import { streamSseSubscribe, streamSseUnsubscribe, streamSseBroadcast } from "@/lib/stream-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const enc = new TextEncoder();

  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  let ping: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
      streamSseSubscribe(id, ctrl);
      controller.enqueue(enc.encode(": connected\n\n"));

      ping = setInterval(async () => {
        try {
          // Check if broadcaster went away (no heartbeat for 5 min)
          const s = await prisma.stream.findUnique({
            where: { id },
            select: { isActive: true, lastHeartbeat: true },
          }).catch(() => null);

          if (s?.isActive && s.lastHeartbeat) {
            const age = Date.now() - s.lastHeartbeat.getTime();
            if (age > HEARTBEAT_TIMEOUT_MS) {
              await prisma.stream
                .update({ where: { id }, data: { isActive: false, endedAt: new Date() } })
                .catch(() => {});
              streamSseBroadcast(id, { type: "stream_ended" });
            }
          }

          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 30_000);
    },
    cancel() {
      clearInterval(ping);
      streamSseUnsubscribe(id, ctrl);
    },
  });

  req.signal.addEventListener("abort", () => {
    clearInterval(ping);
    streamSseUnsubscribe(id, ctrl);
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
