// Shared forfeit logic for rated game disconnects and explicit leaves.
// Called from both the /leave and /ping (disconnect detection) endpoints.

import { PrismaClient } from "@prisma/client";
import { calculateEloDelta } from "@/lib/elo";
import { awardBadge, awardMineEloBadges, awardChessEloBadges } from "@/lib/awardBadge";

type PrismaT = PrismaClient;

export async function forfeitMinesweeper(
  prisma: PrismaT,
  roomId: string,
  winnerId: string,
  loserId: string,
  winReason: "left" | "disconnected",
  isHostWinner: boolean,
  rated: boolean,
  guestId: string | null,
) {
  await prisma.minesweeperRoom.update({
    where: { id: roomId },
    data: {
      status:   "FINISHED",
      winner:   isHostWinner ? "host" : "guest",
      winReason,
      endedAt:  new Date(),
    },
  });

  await awardBadge(prisma, winnerId, "MINESWEEPER_WIN");
  await awardBadge(prisma, winnerId, "MINESWEEPER_ONLINE_WIN");

  if (rated && guestId) {
    const [winner, loser] = await Promise.all([
      prisma.user.findUnique({ where: { id: winnerId }, select: { minesweeperElo: true } }),
      prisma.user.findUnique({ where: { id: loserId  }, select: { minesweeperElo: true } }),
    ]);
    if (winner && loser) {
      const [delta] = calculateEloDelta(winner.minesweeperElo, loser.minesweeperElo);
      const winnerNew = Math.max(100, winner.minesweeperElo + delta);
      await prisma.$transaction([
        prisma.user.update({ where: { id: winnerId }, data: { minesweeperElo: winnerNew } }),
        prisma.user.update({ where: { id: loserId  }, data: { minesweeperElo: Math.max(100, loser.minesweeperElo - delta) } }),
        prisma.minesweeperRoom.update({ where: { id: roomId }, data: {
          hostEloDelta:  isHostWinner ?  delta : -delta,
          guestEloDelta: isHostWinner ? -delta :  delta,
        }}),
      ]);
      await awardMineEloBadges(prisma, winnerId, winnerNew);
    }
  }
}

export async function forfeitChess(
  prisma: PrismaT,
  roomId: string,
  winnerId: string,
  loserId: string,
  winnerColor: "white" | "black",
  winReason: "resigned" | "disconnected",
  isHostWinner: boolean,
  rated: boolean,
  guestId: string | null,
) {
  await prisma.chessRoom.update({
    where: { id: roomId },
    data: {
      status:   "FINISHED",
      winner:   winnerColor,
      winReason,
      endedAt:  new Date(),
      chatJson: null,
    },
  });

  await awardBadge(prisma, winnerId, "CHESS_WIN");
  await awardBadge(prisma, winnerId, "CHESS_ONLINE_WIN");

  if (rated && guestId) {
    const [winner, loser] = await Promise.all([
      prisma.user.findUnique({ where: { id: winnerId }, select: { chessElo: true } }),
      prisma.user.findUnique({ where: { id: loserId  }, select: { chessElo: true } }),
    ]);
    if (winner && loser) {
      const [delta] = calculateEloDelta(winner.chessElo, loser.chessElo);
      const winnerNew = Math.max(100, winner.chessElo + delta);
      await prisma.$transaction([
        prisma.user.update({ where: { id: winnerId }, data: { chessElo: winnerNew } }),
        prisma.user.update({ where: { id: loserId  }, data: { chessElo: Math.max(100, loser.chessElo - delta) } }),
        prisma.chessRoom.update({ where: { id: roomId }, data: {
          hostEloDelta:  isHostWinner ?  delta : -delta,
          guestEloDelta: isHostWinner ? -delta :  delta,
        }}),
      ]);
      await awardChessEloBadges(prisma, winnerId, winnerNew);
    }
  }
}
