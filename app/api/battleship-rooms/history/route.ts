import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? session.user.id;
  const page   = parseInt(url.searchParams.get("page") ?? "0");
  const limit  = 10;

  const rooms = await prisma.battleshipRoom.findMany({
    where: {
      OR: [{ hostId: userId }, { guestId: userId }],
      status: "FINISHED",
    },
    include: {
      host:  { select: { id: true, name: true, image: true } },
      guest: { select: { id: true, name: true, image: true } },
    },
    orderBy: { endedAt: "desc" },
    skip: page * limit,
    take: limit + 1,
  });

  const hasMore = rooms.length > limit;

  const items = rooms.slice(0, limit).map(r => {
    const isHost = r.hostId === userId;
    const opp    = isHost ? r.guest : r.host;
    const myRole = isHost ? "host" : "guest";

    return {
      id:            r.id,
      rated:         r.rated,
      timeControl:   r.timeControl,
      startedAt:     r.startedAt?.toISOString() ?? null,
      endedAt:       r.endedAt?.toISOString()   ?? null,
      winner:        r.winner,
      winReason:     r.winReason,
      iWon:          r.winner === myRole,
      myEloDelta:    isHost ? r.hostEloDelta    : r.guestEloDelta,
      myEloSnapshot: isHost ? r.hostEloSnapshot : r.guestEloSnapshot,
      myRole,
      oppName:  opp?.name  ?? null,
      oppImage: opp?.image ?? null,
      myShips:  JSON.parse(isHost ? (r.hostShipsJson  ?? "[]") : (r.guestShipsJson ?? "[]")),
      oppShips: JSON.parse(isHost ? (r.guestShipsJson ?? "[]") : (r.hostShipsJson  ?? "[]")),
      moves:    JSON.parse(r.movesJson ?? "[]"),
    };
  });

  return NextResponse.json({ items, hasMore });
}
