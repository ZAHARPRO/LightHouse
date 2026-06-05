import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TTL = 60_000;
const WAITING_MAX_AGE_MS = 30 * 60_000;
const PLAYING_STALE_MS   = 10 * 60_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rated = searchParams.get("rated") === "true";

  const waitingDeadline = new Date(Date.now() - WAITING_MAX_AGE_MS);
  const waitingStale    = new Date(Date.now() - 5 * 60_000);
  const stalePlaying    = new Date(Date.now() - PLAYING_STALE_MS);
  await Promise.all([
    prisma.billiardsRoom.updateMany({
      where: { status: "WAITING", OR: [{ createdAt: { lt: waitingDeadline } }, { updatedAt: { lt: waitingStale } }] },
      data: { status: "FINISHED" },
    }),
    prisma.billiardsRoom.updateMany({
      where: { status: "PLAYING", updatedAt: { lt: stalePlaying } },
      data: { status: "FINISHED" },
    }),
  ]).catch(() => {});

  const [waiting, playing] = await Promise.all([
    prisma.billiardsRoom.findMany({
      where: { status: "WAITING", rated },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, timeControl: true, guestId: true, createdAt: true, rated: true, spectatorsJson: true,
        host: { select: { id: true, name: true, image: true, billiardsElo: true } } },
    }),
    prisma.billiardsRoom.findMany({
      where: { status: "PLAYING", rated },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: { id: true, timeControl: true, guestId: true, createdAt: true, rated: true, spectatorsJson: true,
        host:  { select: { id: true, name: true, image: true, billiardsElo: true } },
        guest: { select: { id: true, name: true, image: true, billiardsElo: true } } },
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

  await prisma.billiardsRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const user = rated
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { billiardsElo: true } })
    : null;

  const room = await prisma.billiardsRoom.create({
    data: {
      hostId: session.user.id,
      timeControl,
      rated,
      hostEloSnapshot: user?.billiardsElo ?? null,
    },
  });

  return NextResponse.json({ id: room.id });
}
