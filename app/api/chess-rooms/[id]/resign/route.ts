import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.chessRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const isHost = room.hostId === session.user.id;
  const isGuest = room.guestId === session.user.id;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  if (room.status === "WAITING") {
    if (isHost) await prisma.chessRoom.delete({ where: { id } });
    else await prisma.chessRoom.update({ where: { id }, data: { guestId: null, guestReady: false } });
  } else if (room.status === "PLAYING") {
    const hostColor = room.hostColor ?? "w";
    const myColor = isHost ? hostColor : (hostColor === "w" ? "b" : "w");
    const winnerColor = myColor === "w" ? "black" : "white";
    await prisma.chessRoom.update({
      where: { id },
      data: { status: "FINISHED", winner: winnerColor, winReason: "resigned", endedAt: new Date() },
    });

    // ELO update
    if (room.rated && room.guestId) {
      const loserId  = session.user.id;
      const winnerId = loserId === room.hostId ? room.guestId : room.hostId;
      const [winner, loser] = await Promise.all([
        prisma.user.findUnique({ where: { id: winnerId }, select: { chessElo: true } }),
        prisma.user.findUnique({ where: { id: loserId  }, select: { chessElo: true } }),
      ]);
      if (winner && loser) {
        const [delta] = calculateEloDelta(winner.chessElo, loser.chessElo);
        const hostIsWinner = winnerId === room.hostId;
        await prisma.$transaction([
          prisma.user.update({ where: { id: winnerId }, data: { chessElo: Math.max(100, winner.chessElo + delta) } }),
          prisma.user.update({ where: { id: loserId  }, data: { chessElo: Math.max(100, loser.chessElo  - delta) } }),
          prisma.chessRoom.update({ where: { id }, data: {
            hostEloDelta:  hostIsWinner ?  delta : -delta,
            guestEloDelta: hostIsWinner ? -delta :  delta,
          }}),
        ]);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
