import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIFFICULTIES, type Difficulty } from "@/lib/minesweeper";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { difficulty = "medium" } = await req.json() as { difficulty?: Difficulty };
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;

  // Cancel any WAITING rated rooms this user already has open
  await prisma.minesweeperRoom.updateMany({
    where: { hostId: userId, status: "WAITING", rated: true },
    data: { status: "FINISHED" },
  });

  // Try to find an available room with matching difficulty
  const available = await prisma.minesweeperRoom.findFirst({
    where: { status: "WAITING", rated: true, difficulty, guestId: null, hostId: { not: userId } },
    orderBy: { createdAt: "asc" },
  });

  if (available) {
    const updated = await prisma.minesweeperRoom.updateMany({
      where: { id: available.id, guestId: null, status: "WAITING" },
      data: { guestId: userId },
    });
    if (updated.count > 0) {
      return NextResponse.json({ roomId: available.id, matched: true });
    }
  }

  // No match — create a new waiting room
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { minesweeperElo: true } });
  const room = await prisma.minesweeperRoom.create({
    data: {
      hostId: userId,
      difficulty,
      rows: cfg.rows,
      cols: cfg.cols,
      mineCount: cfg.mines,
      rated: true,
      hostEloSnapshot: user?.minesweeperElo ?? null,
    },
  });

  return NextResponse.json({ roomId: room.id, matched: false });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.minesweeperRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING", rated: true },
    data: { status: "FINISHED" },
  });

  return NextResponse.json({ ok: true });
}
