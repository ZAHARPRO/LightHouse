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

    if (room.rated && room.guestId && room.hostEloSnapshot != null && room.guestEloSnapshot != null) {
      const winnerSnap = isHostWinner ? room.hostEloSnapshot : room.guestEloSnapshot;
      const loserSnap  = isHostWinner ? room.guestEloSnapshot : room.hostEloSnapshot;
      const [winDelta, loseDelta] = calculateEloDelta(winnerSnap, loserSnap);
      const winnerNew = Math.max(100, winnerSnap + winDelta);
      const loserNew  = Math.max(100, loserSnap  - loseDelta);
      const hostNew   = isHostWinner ? winnerNew : loserNew;
      const guestNew  = isHostWinner ? loserNew  : winnerNew;
      await prisma.$transaction([
        prisma.user.update({ where: { id: room.hostId },   data: { battleshipElo: hostNew } }),
        prisma.user.update({ where: { id: room.guestId! }, data: { battleshipElo: guestNew } }),
        prisma.battleshipRoom.update({ where: { id }, data: {
          hostEloDelta:  isHostWinner ?  winDelta : -loseDelta,
          guestEloDelta: isHostWinner ? -loseDelta :  winDelta,
        }}),
      ]);
      await awardBattleshipEloBadges(prisma, winnerId, winnerNew);
    }
  }

  return NextResponse.json({ ok: true });
}
