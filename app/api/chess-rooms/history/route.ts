import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const PER_PAGE = 10;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId");
  const page     = Math.max(0, parseInt(searchParams.get("page") ?? "0"));

  let userId = targetId;
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rooms = await prisma.chessRoom.findMany({
    where: { OR: [{ hostId: userId }, { guestId: userId }], status: "FINISHED", guestId: { not: null } },
    orderBy: { endedAt: "desc" },
    skip: page * PER_PAGE,
    take: PER_PAGE + 1,
    select: {
      id: true, rated: true, timeControl: true, hostColor: true,
      startedAt: true, endedAt: true, winner: true, winReason: true,
      hostId: true, guestId: true,
      hostEloDelta: true, guestEloDelta: true,
      hostEloSnapshot: true, guestEloSnapshot: true,
      movesSAN: true,
      host:  { select: { id: true, name: true, image: true } },
      guest: { select: { id: true, name: true, image: true } },
    },
  });

  const hasMore = rooms.length > PER_PAGE;
  const items = rooms.slice(0, PER_PAGE).map(room => {
    const isHost  = room.hostId === userId;
    const myColor = isHost ? (room.hostColor ?? "w") : (room.hostColor === "w" ? "b" : "w");
    const opp     = isHost ? room.guest : room.host;
    const moves: string[] = room.movesSAN ? JSON.parse(room.movesSAN) : [];
    return {
      id: room.id,
      rated: room.rated,
      timeControl: room.timeControl,
      myColor,
      startedAt: room.startedAt,
      endedAt:   room.endedAt,
      winner:    room.winner,
      winReason: room.winReason,
      myEloDelta:    isHost ? room.hostEloDelta    : room.guestEloDelta,
      myEloSnapshot: isHost ? room.hostEloSnapshot : room.guestEloSnapshot,
      oppName:        opp?.name  ?? null,
      oppImage:       opp?.image ?? null,
      movesSAN:    moves,
      totalMoves:  moves.length,
    };
  });

  return NextResponse.json({ items, hasMore });
}
