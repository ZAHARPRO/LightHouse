import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
import { awardBadge, awardBilliardsEloBadges } from "@/lib/awardBadge";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.billiardsRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === session.user.id;
  const isGuest = room.guestId === session.user.id;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  if (room.status === "WAITING") {
    if (isHost) await prisma.billiardsRoom.delete({ where: { id } });
    else await prisma.billiardsRoom.update({ where: { id }, data: { guestId: null, guestReady: false } });
  } else if (room.status === "PLAYING") {
    const myRole      = isHost ? "host" : "guest";
    const winnerRole  = myRole === "host" ? "guest" : "host";
    await prisma.billiardsRoom.update({
      where: { id },
      data: { status: "FINISHED", winner: winnerRole, winReason: "resigned", endedAt: new Date() },
    });

    const loserId  = session.user.id;
    const winnerId = loserId === room.hostId ? room.guestId! : room.hostId;
    await awardBadge(prisma, winnerId, "BILLIARDS_ONLINE_WIN");

    if (room.rated && room.guestId) {
      const [winner, loser] = await Promise.all([
        prisma.user.findUnique({ where: { id: winnerId }, select: { billiardsElo: true } }),
        prisma.user.findUnique({ where: { id: loserId  }, select: { billiardsElo: true } }),
      ]);
      if (winner && loser) {
        const [delta] = calculateEloDelta(winner.billiardsElo, loser.billiardsElo);
        const hostIsWinner = winnerId === room.hostId;
        const winnerNew = Math.max(100, winner.billiardsElo + delta);
        await prisma.$transaction([
          prisma.user.update({ where: { id: winnerId }, data: { billiardsElo: winnerNew } }),
          prisma.user.update({ where: { id: loserId  }, data: { billiardsElo: Math.max(100, loser.billiardsElo - delta) } }),
          prisma.billiardsRoom.update({ where: { id }, data: {
            hostEloDelta:  hostIsWinner ?  delta : -delta,
            guestEloDelta: hostIsWinner ? -delta :  delta,
          }}),
        ]);
        await awardBilliardsEloBadges(prisma, winnerId, winnerNew);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
