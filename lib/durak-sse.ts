// SSE broadcasting for Durak rooms (mirrors lib/billiards-sse.ts pattern).

export type DurakEvent =
  | { type: "update" }
  | { type: "cheat_alert"; cheaterName: string; cheatType: string }
  | { type: "catch"; catcherName: string; cheaterName: string };

type Subscriber = (event: DurakEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __durakSSE: Map<string, Set<Subscriber>> | undefined;
}

function getRegistry(): Map<string, Set<Subscriber>> {
  if (!global.__durakSSE) {
    global.__durakSSE = new Map();
  }
  return global.__durakSSE;
}

export function subscribe(roomId: string, cb: Subscriber): () => void {
  const registry = getRegistry();
  if (!registry.has(roomId)) registry.set(roomId, new Set());
  registry.get(roomId)!.add(cb);
  return () => {
    registry.get(roomId)?.delete(cb);
    if (registry.get(roomId)?.size === 0) registry.delete(roomId);
  };
}

export function broadcast(roomId: string, event: DurakEvent): void {
  getRegistry().get(roomId)?.forEach((cb) => cb(event));
}
