import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
import { awardBilliardsEloBadges } from "@/lib/awardBadge";

const DISCONNECT_MS_UNTIMED = 30_000;
const DISCONNECT_MS_TIMED   = 5 * 60 * 1000;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const room = await prisma.billiardsRoom.findUnique({ where: { id } });
  if (!room || room.status !== "PLAYING") return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  const now = new Date();
  await prisma.billiardsRoom.update({
    where: { id },
    data: isHost ? { hostLastSeen: now } : { guestLastSeen: now },
  });

  const disconnectMs = room.timeControl === "none" ? DISCONNECT_MS_UNTIMED : DISCONNECT_MS_TIMED;
  const cutoff       = new Date(Date.now() - disconnectMs);
  const oppLastSeen  = isHost ? room.guestLastSeen : room.hostLastSeen;

  if (oppLastSeen && oppLastSeen < cutoff && room.guestId) {
    const winnerRole = isHost ? "host" : "guest";
    const winnerId   = userId;
    const loserId    = isHost ? room.guestId : room.hostId;

    await prisma.billiardsRoom.update({
      where: { id },
      data: { status: "FINISHED", winner: winnerRole, winReason: "disconnected", endedAt: new Date() },
    });

    if (room.rated) {
      const [winner, loser] = await Promise.all([
        prisma.user.findUnique({ where: { id: winnerId }, select: { billiardsElo: true } }),
        prisma.user.findUnique({ where: { id: loserId  }, select: { billiardsElo: true } }),
      ]);
      if (winner && loser && !room.hostEloDelta) {
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

    return NextResponse.json({ disconnectWin: true });
  }

  return NextResponse.json({ ok: true });
}
