type BilliardsEvent =
  | { type: "update" }
  | { type: "tension"; role: "host" | "guest"; power: number };

type Subscriber = (event: BilliardsEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __billiardsSSE: Map<string, Set<Subscriber>> | undefined;
}

function getRegistry(): Map<string, Set<Subscriber>> {
  if (!global.__billiardsSSE) {
    global.__billiardsSSE = new Map();
  }
  return global.__billiardsSSE;
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

export function broadcast(roomId: string, event: BilliardsEvent): void {
  getRegistry().get(roomId)?.forEach(cb => cb(event));
}
