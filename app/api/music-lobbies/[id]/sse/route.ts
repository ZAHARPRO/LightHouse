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

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
      sseSubscribe(id, ctrl);
      // Initial heartbeat so the browser knows the connection is live
      controller.enqueue(enc.encode(": connected\n\n"));
    },
    cancel() {
      sseUnsubscribe(id, ctrl);
    },
  });

  // Also unsubscribe when the client disconnects via abort signal
  req.signal.addEventListener("abort", () => {
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
