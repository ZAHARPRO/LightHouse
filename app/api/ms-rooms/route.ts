import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIFFICULTIES, type Difficulty } from "@/lib/minesweeper";

const TTL = 60_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rated = searchParams.get("rated") === "true";

  const [waiting, playing] = await Promise.all([
    prisma.minesweeperRoom.findMany({
      where: { status: "WAITING", rated },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, difficulty: true, guestId: true, createdAt: true, rated: true, spectatorsJson: true,
        host: { select: { id: true, name: true, image: true, minesweeperElo: true } } },
    }),
    prisma.minesweeperRoom.findMany({
      where: { status: "PLAYING", rated },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: { id: true, difficulty: true, guestId: true, createdAt: true, rated: true, spectatorsJson: true,
        host:  { select: { id: true, name: true, image: true, minesweeperElo: true } },
        guest: { select: { id: true, name: true, image: true, minesweeperElo: true } } },
    }),
  ]);

  const now = Date.now();
  const fmt = (r: { spectatorsJson?: string | null; [k: string]: unknown }) => ({
    ...r,
    spectatorsJson: undefined,
    spectatorCount: r.spectatorsJson
      ? (JSON.parse(r.spectatorsJson as string) as { at: number }[]).filter(s => now - s.at < TTL).length
      : 0,
  });

  return NextResponse.json({
    waiting: waiting.map(fmt),
    playing: playing.map(fmt),
  });
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
