import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 10;

  const rooms = await prisma.checkersRoom.findMany({
    where: {
      status: "FINISHED",
      guestId: { not: null },
      OR: [
        { hostId: userId, hostHistoryHidden: false },
        { guestId: userId, guestHistoryHidden: false },
      ],
    },
    orderBy: { endedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true, winner: true, winReason: true, moveCount: true, timeControl: true,
      rated: true, hostColor: true, hostEloDelta: true, guestEloDelta: true,
      startedAt: true, endedAt: true,
      host:  { select: { id: true, name: true, image: true, checkersElo: true } },
      guest: { select: { id: true, name: true, image: true, checkersElo: true } },
    },
  });

  return NextResponse.json(rooms.map(r => {
    const iAmHost = r.host.id === userId;
    const myColor = iAmHost ? (r.hostColor ?? "w") : (r.hostColor === "w" ? "b" : "w");
    const myColorStr = myColor === "w" ? "white" : "black";
    const result = r.winner === "draw" ? "draw" : r.winner === myColorStr ? "win" : "loss";
    const eloDelta = iAmHost ? r.hostEloDelta : r.guestEloDelta;
    const opponent = iAmHost ? r.guest : r.host;
    return { id: r.id, result, winReason: r.winReason, moveCount: r.moveCount,
      timeControl: r.timeControl, rated: r.rated, eloDelta, startedAt: r.startedAt, endedAt: r.endedAt, opponent };
  }));
}
