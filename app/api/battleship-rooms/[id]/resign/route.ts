import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
import { awardBadge, awardBattleshipEloBadges } from "@/lib/awardBadge";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.battleshipRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === session.user.id;
  const isGuest = room.guestId === session.user.id;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  if (room.status === "WAITING" || room.status === "PLACEMENT") {
    if (isHost) await prisma.battleshipRoom.delete({ where: { id } });
    else await prisma.battleshipRoom.update({
      where: { id },
      data: { guestId: null, guestReady: false, status: "WAITING" },
    });
    return NextResponse.json({ ok: true });
  }

  if (room.status === "PLAYING") {
    // winner is the opponent — "host" or "guest", not "white"/"black"
    const winnerRole = isHost ? "guest" : "host";
    const isHostWinner = winnerRole === "host";

    await prisma.battleshipRoom.update({
      where: { id },
      data: {
        status:    "FINISHED",
        winner:    winnerRole,
        winReason: "resigned",
        endedAt:   new Date(),
        chatJson:  "[]",
      },
    });

    const loserId  = session.user.id;
    const winnerId = isHost ? room.guestId! : room.hostId;

    await awardBadge(prisma, winnerId, "BATTLESHIP_WIN");
    await awardBadge(prisma, winnerId, "BATTLESHIP_ONLINE_WIN");

    if (room.rated && room.guestId) {
      const [winner, loser] = await Promise.all([
        prisma.user.findUnique({ where: { id: winnerId }, select: { battleshipElo: true } }),
        prisma.user.findUnique({ where: { id: loserId  }, select: { battleshipElo: true } }),
      ]);
      if (winner && loser) {
        const [delta] = calculateEloDelta(winner.battleshipElo, loser.battleshipElo);
        const winnerNew = Math.max(100, winner.battleshipElo + delta);
        await prisma.$transaction([
          prisma.user.update({ where: { id: winnerId }, data: { battleshipElo: winnerNew } }),
          prisma.user.update({ where: { id: loserId  }, data: { battleshipElo: Math.max(100, loser.battleshipElo - delta) } }),
          prisma.battleshipRoom.update({ where: { id }, data: {
            hostEloDelta:  isHostWinner ?  delta : -delta,
            guestEloDelta: isHostWinner ? -delta :  delta,
          }}),
        ]);
        await awardBattleshipEloBadges(prisma, winnerId, winnerNew);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
