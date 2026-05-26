import { notifyUser, type MatchGame } from "./notifications-sse";
import { prisma } from "./prisma";

export async function notifyMatchResult(
  hostId: string,
  guestId: string | null,
  winnerUserId: string | null, // null = draw
  game: MatchGame,
  roomId: string,
  reason: string,
): Promise<void> {
  if (!guestId) return;
  const [host, guest] = await Promise.all([
    prisma.user.findUnique({ where: { id: hostId  }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: guestId }, select: { name: true } }),
  ]);
  const outcome = (uid: string) =>
    winnerUserId === null ? "draw" : uid === winnerUserId ? "win" : "loss";
  notifyUser(hostId,  { type: "match_result", game, roomId, reason, outcome: outcome(hostId),  opponentName: guest?.name ?? null });
  notifyUser(guestId, { type: "match_result", game, roomId, reason, outcome: outcome(guestId), opponentName: host?.name  ?? null });
}
