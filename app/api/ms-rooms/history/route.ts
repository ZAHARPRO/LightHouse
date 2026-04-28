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

  const rooms = await prisma.minesweeperRoom.findMany({
    where: { OR: [{ hostId: userId }, { guestId: userId }], status: "FINISHED", guestId: { not: null } },
    orderBy: { endedAt: "desc" },
    skip: page * PER_PAGE,
    take: PER_PAGE + 1,
    select: {
      id: true, rated: true, difficulty: true, rows: true, cols: true, mineCount: true,
      startedAt: true, endedAt: true, winner: true, winReason: true,
      hostId: true, guestId: true,
      hostEloDelta: true, guestEloDelta: true,
      hostEloSnapshot: true, guestEloSnapshot: true,
      hostMines: true, hostRevealed: true, hostFlagged: true, hostHit: true,
      guestMines: true, guestRevealed: true, guestFlagged: true, guestHit: true,
      host:  { select: { id: true, name: true, image: true } },
      guest: { select: { id: true, name: true, image: true } },
    },
  });

  const hasMore = rooms.length > PER_PAGE;
  const parse = (v: string | null): number[] => (v ? JSON.parse(v) : []);

  const items = rooms.slice(0, PER_PAGE).map(room => {
    const isHost = room.hostId === userId;
    const opp    = isHost ? room.guest : room.host;
    const iWon   = room.winner === (isHost ? "host" : "guest");
    return {
      id: room.id,
      rated: room.rated,
      difficulty: room.difficulty,
      rows:      room.rows      ?? 9,
      cols:      room.cols      ?? 9,
      mineCount: room.mineCount ?? 10,
      startedAt: room.startedAt,
      endedAt:   room.endedAt,
      winner:    room.winner,
      winReason: room.winReason,
      iWon,
      myEloDelta:    isHost ? room.hostEloDelta    : room.guestEloDelta,
      myEloSnapshot: isHost ? room.hostEloSnapshot : room.guestEloSnapshot,
      oppName:  opp?.name  ?? null,
      oppImage: opp?.image ?? null,
      myMines:    parse(isHost ? room.hostMines    : room.guestMines),
      myRevealed: parse(isHost ? room.hostRevealed : room.guestRevealed),
      myFlagged:  parse(isHost ? room.hostFlagged  : room.guestFlagged),
      myHit:    isHost ? room.hostHit  : room.guestHit,
      oppMines:    parse(isHost ? room.guestMines    : room.hostMines),
      oppRevealed: parse(isHost ? room.guestRevealed : room.hostRevealed),
      oppFlagged:  parse(isHost ? room.guestFlagged  : room.hostFlagged),
      oppHit:   isHost ? room.guestHit : room.hostHit,
    };
  });

  return NextResponse.json({ items, hasMore });
}
