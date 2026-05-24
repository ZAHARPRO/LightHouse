import { sseSubscribe, sseUnsubscribe, sseBroadcast } from "./lobby-sse";

// Namespace stream SSE events under "stream:<id>" so they don't
// collide with lobby IDs inside the same in-process store.
export function streamSseKey(streamId: string) {
  return `stream:${streamId}`;
}

export function streamSseSubscribe(
  streamId: string,
  ctrl: ReadableStreamDefaultController<Uint8Array>,
) {
  sseSubscribe(streamSseKey(streamId), ctrl);
}

export function streamSseUnsubscribe(
  streamId: string,
  ctrl: ReadableStreamDefaultController<Uint8Array>,
) {
  sseUnsubscribe(streamSseKey(streamId), ctrl);
}

export function streamSseBroadcast(
  streamId: string,
  data: Record<string, unknown>,
) {
  sseBroadcast(streamSseKey(streamId), data);
}
