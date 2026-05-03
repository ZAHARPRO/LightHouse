import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { awardBadge, awardCheckersEloBadges } from "@/lib/awardBadge";
import { calculateEloDelta } from "@/lib/elo";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.checkersRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session.user.id;
  const isHost  = userId === room.hostId;
  const isGuest = userId === room.guestId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  if (room.status === "WAITING") {
    if (isHost) await prisma.checkersRoom.update({ where: { id }, data: { status: "FINISHED" } });
    else await prisma.checkersRoom.update({ where: { id }, data: { guestId: null, guestReady: false } });
    return NextResponse.json({ ok: true });
  }

  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not playing" }, { status: 400 });

  const hc = room.hostColor ?? "w";
  const myColor = isHost ? hc : (hc === "w" ? "b" : "w");
  const loserColor = myColor === "w" ? "white" : "black";
  const winnerStr  = loserColor === "white" ? "black" : "white";

  await prisma.checkersRoom.update({ where: { id }, data: {
    status: "FINISHED", winner: winnerStr, winReason: "resigned",
    endedAt: new Date(), chatJson: null,
  }});

  const winnerId = isHost ? room.guestId! : room.hostId;
  await awardBadge(prisma, winnerId, "CHECKERS_WIN");
  await awardBadge(prisma, winnerId, "CHECKERS_ONLINE_WIN");

  if (room.rated && room.guestId && !room.hostEloDelta) {
    const loserId = userId;
    const [winner, loser] = await Promise.all([
      prisma.user.findUnique({ where: { id: winnerId }, select: { checkersElo: true } }),
      prisma.user.findUnique({ where: { id: loserId  }, select: { checkersElo: true } }),
    ]);
    if (winner && loser) {
      const [delta] = calculateEloDelta(winner.checkersElo, loser.checkersElo);
      const winnerNew = Math.max(100, winner.checkersElo + delta);
      const hostIsWinner = winnerId === room.hostId;
      await prisma.$transaction([
        prisma.user.update({ where: { id: winnerId }, data: { checkersElo: winnerNew } }),
        prisma.user.update({ where: { id: loserId  }, data: { checkersElo: Math.max(100, loser.checkersElo - delta) } }),
        prisma.checkersRoom.update({ where: { id }, data: {
          hostEloDelta:  hostIsWinner ?  delta : -delta,
          guestEloDelta: hostIsWinner ? -delta :  delta,
        }}),
      ]);
      await awardCheckersEloBadges(prisma, winnerId, winnerNew);
    }
  }

  return NextResponse.json({ ok: true });
}
