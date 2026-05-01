import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
import { awardBadge, awardMineEloBadges } from "@/lib/awardBadge";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const room = await prisma.minesweeperRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;

  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  if (room.status === "WAITING") {
    if (isHost) {
      await prisma.minesweeperRoom.delete({ where: { id } });
    } else {
      await prisma.minesweeperRoom.update({
        where: { id },
        data: { guestId: null, guestReady: false },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (room.status !== "PLAYING") return NextResponse.json({ ok: true });

  const winnerId = isHost ? room.guestId! : room.hostId;
  const loserId  = userId;

  await prisma.minesweeperRoom.update({
    where: { id },
    data: {
      status:   "FINISHED",
      winner:   isHost ? "guest" : "host",
      winReason: "left",
      endedAt:  new Date(),
    },
  });

  // Award badge to winner
  await awardBadge(prisma, winnerId, "MINESWEEPER_WIN");
  await awardBadge(prisma, winnerId, "MINESWEEPER_ONLINE_WIN");

  // ELO update for rated games
  if (room.rated && room.guestId) {
    const [winner, loser] = await Promise.all([
      prisma.user.findUnique({ where: { id: winnerId }, select: { minesweeperElo: true } }),
      prisma.user.findUnique({ where: { id: loserId  }, select: { minesweeperElo: true } }),
    ]);
    if (winner && loser) {
      const [delta] = calculateEloDelta(winner.minesweeperElo, loser.minesweeperElo);
      const hostIsWinner = winnerId === room.hostId;
      const winnerNew = Math.max(100, winner.minesweeperElo + delta);
      await prisma.$transaction([
        prisma.user.update({ where: { id: winnerId }, data: { minesweeperElo: winnerNew } }),
        prisma.user.update({ where: { id: loserId  }, data: { minesweeperElo: Math.max(100, loser.minesweeperElo - delta) } }),
        prisma.minesweeperRoom.update({ where: { id }, data: {
          hostEloDelta:  hostIsWinner ?  delta : -delta,
          guestEloDelta: hostIsWinner ? -delta :  delta,
        }}),
      ]);
      await awardMineEloBadges(prisma, winnerId, winnerNew);
    }
  }

  return NextResponse.json({ ok: true });
}
