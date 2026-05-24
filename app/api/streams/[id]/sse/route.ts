import { streamSseSubscribe, streamSseUnsubscribe } from "@/lib/stream-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      ping = setInterval(() => {
        try { controller.enqueue(enc.encode(": ping\n\n")); } catch { clearInterval(ping); }
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
