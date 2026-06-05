import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TTL = 60_000;
const WAITING_STALE_MS = 5 * 60_000; // close empty waiting rooms after 5 min

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rated = searchParams.get("rated") === "true";

  // Silently close waiting rooms that haven't been pinged/updated for 5+ min
  const staleAt = new Date(Date.now() - WAITING_STALE_MS);
  await prisma.durakRoom.updateMany({
    where: { status: "WAITING", updatedAt: { lt: staleAt } },
    data: { status: "FINISHED" },
  }).catch(() => {});

  const select = {
    id: true,
    status: true,
    variant: true,
    deckSize: true,
    maxPlayers: true,
    timeControl: true,
    rated: true,
    fairPlay: true,
    createdAt: true,
    startedAt: true,
    spectatorsJson: true,
    host: { select: { id: true, name: true, image: true, durakElo: true } },
    players: {
      orderBy: { seatIdx: "asc" as const },
      select: { userId: true, seatIdx: true, user: { select: { name: true, image: true } } },
    },
  };

  const [waiting, playing] = await Promise.all([
    prisma.durakRoom.findMany({
      where: { status: "WAITING", rated },
      orderBy: { createdAt: "desc" },
      take: 30,
      select,
    }),
    prisma.durakRoom.findMany({
      where: { status: "PLAYING", rated },
      orderBy: { startedAt: "desc" },
      take: 20,
      select,
    }),
  ]);

  const now = Date.now();
  const fmt = (r: (typeof waiting)[number]) => {
    const spectators = r.spectatorsJson
      ? (JSON.parse(r.spectatorsJson) as { at: number }[])
      : [];
    return {
      id: r.id,
      status: r.status,
      variant: r.variant,
      deckSize: r.deckSize,
      maxPlayers: r.maxPlayers,
      timeControl: r.timeControl,
      rated: r.rated,
      fairPlay: r.fairPlay,
      createdAt: r.createdAt,
      host: r.host,
      players: r.players.map((p) => ({ userId: p.userId, name: p.user.name, image: p.user.image })),
      playerCount: r.players.length,
      spectatorCount: spectators.filter((s) => now - s.at < TTL).length,
    };
  };

  return NextResponse.json({ waiting: waiting.map(fmt), playing: playing.map(fmt) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    variant?: string;
    deckSize?: number;
    maxPlayers?: number;
    timeControl?: string;
    throwRule?: string;
    rated?: boolean;
    fairPlay?: boolean;
  };

  const variant = body.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy";
  const deckSize = body.deckSize === 52 ? 52 : 36;
  const maxPlayers = Math.min(6, Math.max(2, body.maxPlayers ?? 4));
  const timeControl = ["15", "30", "60"].includes(String(body.timeControl)) ? String(body.timeControl) : "none";
  const throwRule = body.throwRule === "neighbors" ? "neighbors" : "all";
  const rated = body.rated === true;
  let fairPlay = body.fairPlay !== false;

  // A banned cheater can only play fair games.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { durakElo: true, durakCheaterBanned: true },
  });
  if (user?.durakCheaterBanned) fairPlay = true;

  // Close any existing WAITING room hosted by this user.
  await prisma.durakRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const room = await prisma.durakRoom.create({
    data: {
      hostId: session.user.id,
      variant,
      deckSize,
      maxPlayers,
      timeControl,
      throwRule,
      rated,
      fairPlay,
      players: {
        create: {
          userId: session.user.id,
          seatIdx: 0,
          eloSnapshot: user?.durakElo ?? null,
        },
      },
    },
  });

  return NextResponse.json({ id: room.id });
}
