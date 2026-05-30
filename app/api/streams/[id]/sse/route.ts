import { prisma } from "@/lib/prisma";
import { streamSseSubscribe, streamSseUnsubscribe, streamSseBroadcast } from "@/lib/stream-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const enc = new TextEncoder();

  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  let ping: ReturnType<typeof setInterval>;

  async function adjustViewerCount(delta: 1 | -1) {
    try {
      const updated = await prisma.stream.update({
        where: { id },
        data: { viewerCount: { increment: delta } },
        select: { viewerCount: true, isActive: true },
      });
      if (updated.isActive) {
        const count = Math.max(0, updated.viewerCount);
        streamSseBroadcast(id, { type: "viewer_count", count });
      }
    } catch { /* stream may already be gone */ }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      ctrl = controller;
      streamSseSubscribe(id, ctrl);
      controller.enqueue(enc.encode(": connected\n\n"));

      // Count this connection as a viewer
      await adjustViewerCount(1);

      ping = setInterval(async () => {
        try {
          const s = await prisma.stream.findUnique({
            where: { id },
            select: { isActive: true, lastHeartbeat: true },
          }).catch(() => null);

          if (s?.isActive && s.lastHeartbeat) {
            const age = Date.now() - s.lastHeartbeat.getTime();
            if (age > HEARTBEAT_TIMEOUT_MS) {
              await prisma.stream
                .update({ where: { id }, data: { isActive: false, endedAt: new Date(), viewerCount: 0 } })
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
    async cancel() {
      clearInterval(ping);
      streamSseUnsubscribe(id, ctrl);
      await adjustViewerCount(-1);
    },
  });

  req.signal.addEventListener("abort", async () => {
    clearInterval(ping);
    streamSseUnsubscribe(id, ctrl);
    await adjustViewerCount(-1);
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
