import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIFFICULTIES, type Difficulty } from "@/lib/minesweeper";

export async function GET() {
  const rooms = await prisma.minesweeperRoom.findMany({
    where: { status: "WAITING" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { host: { select: { id: true, name: true, image: true } } },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { difficulty = "easy" } = await req.json() as { difficulty?: Difficulty };
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.easy;

  // Close previous waiting rooms by this host
  await prisma.minesweeperRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const room = await prisma.minesweeperRoom.create({
    data: {
      hostId: session.user.id,
      difficulty,
      rows: cfg.rows,
      cols: cfg.cols,
      mineCount: cfg.mines,
    },
  });

  return NextResponse.json({ id: room.id });
}
