import { sseSubscribe, sseUnsubscribe } from "@/lib/lobby-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const enc = new TextEncoder();

  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  let pingInterval: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
      sseSubscribe(id, ctrl);
      controller.enqueue(enc.encode(": connected\n\n"));
      // Send a comment ping every 30s to prevent Render's 55s idle timeout
      pingInterval = setInterval(() => {
        try { controller.enqueue(enc.encode(": ping\n\n")); } catch { clearInterval(pingInterval); }
      }, 30_000);
    },
    cancel() {
      clearInterval(pingInterval);
      sseUnsubscribe(id, ctrl);
    },
  });

  req.signal.addEventListener("abort", () => {
    clearInterval(pingInterval);
    sseUnsubscribe(id, ctrl);
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
