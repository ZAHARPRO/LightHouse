// Global in-process SSE subscriber store.
// Works for single-instance deployments (dev + typical prod).
// For multi-instance (horizontal scaling), replace with Redis pub/sub.

type SseCtrl = ReadableStreamDefaultController<Uint8Array>;

const store = new Map<string, Set<SseCtrl>>();

export function sseSubscribe(lobbyId: string, ctrl: SseCtrl) {
  if (!store.has(lobbyId)) store.set(lobbyId, new Set());
  store.get(lobbyId)!.add(ctrl);
}

export function sseUnsubscribe(lobbyId: string, ctrl: SseCtrl) {
  const subs = store.get(lobbyId);
  if (!subs) return;
  subs.delete(ctrl);
  if (subs.size === 0) store.delete(lobbyId);
}

export function sseBroadcast(lobbyId: string, data: Record<string, unknown>) {
  const subs = store.get(lobbyId);
  if (!subs || subs.size === 0) return;
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  for (const ctrl of subs) {
    try {
      ctrl.enqueue(encoded);
    } catch {
      subs.delete(ctrl);
    }
  }
}
