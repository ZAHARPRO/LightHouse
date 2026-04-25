import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game") ?? "chess";
  const limit = Math.min(20, Number(searchParams.get("limit") ?? "10"));

  const isChess = game === "chess";
  const field = isChess ? "chessElo" : "minesweeperElo";
  const search = searchParams.get("search")?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: {
      [field]: { gte: 100 },
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { [field]: "desc" },
    take: limit,
    select: { id: true, name: true, image: true, chessElo: true, minesweeperElo: true },
  });

  // Compute wins + max win streak per user
  const userIds = users.map(u => u.id);

  let winStreaks: Record<string, { wins: number; maxStreak: number }> = {};

  if (isChess) {
    const rooms = await prisma.chessRoom.findMany({
      where: {
        status: "FINISHED",
        rated: true,
        OR: [{ hostId: { in: userIds } }, { guestId: { in: userIds } }],
      },
      select: { hostId: true, guestId: true, hostColor: true, winner: true, endedAt: true },
      orderBy: { endedAt: "asc" },
    });

    for (const uid of userIds) {
      const userRooms = rooms.filter(r => r.hostId === uid || r.guestId === uid);
      let wins = 0, streak = 0, maxStreak = 0;
      for (const r of userRooms) {
        const hc = r.hostColor ?? "w";
        const myColor = r.hostId === uid ? hc : (hc === "w" ? "b" : "w");
        const myColorName = myColor === "w" ? "white" : "black";
        const won = r.winner === myColorName;
        if (won) { wins++; streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      }
      winStreaks[uid] = { wins, maxStreak };
    }
  } else {
    const rooms = await prisma.minesweeperRoom.findMany({
      where: {
        status: "FINISHED",
        rated: true,
        OR: [{ hostId: { in: userIds } }, { guestId: { in: userIds } }],
      },
      select: { hostId: true, guestId: true, winner: true, endedAt: true },
      orderBy: { endedAt: "asc" },
    });

    for (const uid of userIds) {
      const userRooms = rooms.filter(r => r.hostId === uid || r.guestId === uid);
      let wins = 0, streak = 0, maxStreak = 0;
      for (const r of userRooms) {
        const myRole = r.hostId === uid ? "host" : "guest";
        const won = r.winner === myRole;
        if (won) { wins++; streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      }
      winStreaks[uid] = { wins, maxStreak };
    }
  }

  return NextResponse.json(
    users.map(u => ({
      ...u,
      wins: winStreaks[u.id]?.wins ?? 0,
      maxStreak: winStreaks[u.id]?.maxStreak ?? 0,
    }))
  );
}
