import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TTL = 60_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rated = searchParams.get("rated") === "true";

  const [waiting, playing] = await Promise.all([
    prisma.chessRoom.findMany({
      where: { status: "WAITING", rated },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, timeControl: true, guestId: true, createdAt: true, rated: true, spectatorsJson: true,
        host: { select: { id: true, name: true, image: true, chessElo: true } } },
    }),
    prisma.chessRoom.findMany({
      where: { status: "PLAYING", rated },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: { id: true, timeControl: true, guestId: true, createdAt: true, rated: true, spectatorsJson: true,
        host:  { select: { id: true, name: true, image: true, chessElo: true } },
        guest: { select: { id: true, name: true, image: true, chessElo: true } } },
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

  const { timeControl = "none", rated = false } = await req.json() as { timeControl?: string; rated?: boolean };

  await prisma.chessRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const user = rated ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { chessElo: true } }) : null;

  const room = await prisma.chessRoom.create({
    data: {
      hostId: session.user.id,
      timeControl,
      rated,
      hostEloSnapshot: user?.chessElo ?? null,
    },
  });

  return NextResponse.json({ id: room.id });
}
