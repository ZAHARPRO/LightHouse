export type MatchGame = "chess" | "checkers" | "billiards" | "battleship";

export type NotifEvent =
  | { type: "badge"; id: string; rewardType: string; pointsValue: number; description: string; earnedAt: string }
  | { type: "dm"; id: string; convId: string; senderName: string | null; senderImage: string | null; senderTier: string; content: string }
  | { type: "stream_live"; streamId: string; title: string; thumbnail: string | null; authorName: string | null; authorImage: string | null; viewerCount: number; likeCount: number }
  | { type: "match_result"; game: MatchGame; roomId: string; outcome: "win" | "loss" | "draw"; opponentName: string | null; reason: string };

type Subscriber = (event: NotifEvent) => void;

declare global {
  var __notifSSE: Map<string, Set<Subscriber>> | undefined;
}

function getRegistry(): Map<string, Set<Subscriber>> {
  if (!global.__notifSSE) global.__notifSSE = new Map();
  return global.__notifSSE;
}

export function subscribeNotif(userId: string, cb: Subscriber): () => void {
  const reg = getRegistry();
  if (!reg.has(userId)) reg.set(userId, new Set());
  reg.get(userId)!.add(cb);
  return () => {
    reg.get(userId)?.delete(cb);
    if (reg.get(userId)?.size === 0) reg.delete(userId);
  };
}

export function notifyUser(userId: string, event: NotifEvent): void {
  getRegistry().get(userId)?.forEach(cb => cb(event));
}

export function notifyAll(event: NotifEvent): void {
  getRegistry().forEach(subs => subs.forEach(cb => cb(event)));
}

export function notifyAllExcept(excludeUserId: string, event: NotifEvent): void {
  getRegistry().forEach((subs, userId) => {
    if (userId !== excludeUserId) subs.forEach(cb => cb(event));
  });
}
