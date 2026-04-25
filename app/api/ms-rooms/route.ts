import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIFFICULTIES, type Difficulty } from "@/lib/minesweeper";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rated = searchParams.get("rated") === "true";
  const rooms = await prisma.minesweeperRoom.findMany({
    where: { status: "WAITING", rated },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { host: { select: { id: true, name: true, image: true, minesweeperElo: true } } },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { difficulty = "easy", rated = false } = await req.json() as { difficulty?: Difficulty; rated?: boolean };
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.easy;

  await prisma.minesweeperRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const user = rated ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { minesweeperElo: true } }) : null;

  const room = await prisma.minesweeperRoom.create({
    data: {
      hostId: session.user.id,
      difficulty,
      rows: cfg.rows,
      cols: cfg.cols,
      mineCount: cfg.mines,
      rated,
      hostEloSnapshot: user?.minesweeperElo ?? null,
    },
  });

  return NextResponse.json({ id: room.id });
}
