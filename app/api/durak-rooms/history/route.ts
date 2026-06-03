import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Match history for rated, finished Durak games (optionally for one user).
export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? session?.user?.id ?? null;

  const rooms = await prisma.durakRoom.findMany({
    where: {
      rated: true,
      status: "FINISHED",
      ...(userId ? { players: { some: { userId } } } : {}),
    },
    orderBy: { endedAt: "desc" },
    take: 40,
    select: {
      id: true,
      variant: true,
      deckSize: true,
      maxPlayers: true,
      timeControl: true,
      winner: true,
      startedAt: true,
      endedAt: true,
      players: {
        orderBy: { seatIdx: "asc" },
        select: {
          userId: true,
          seatIdx: true,
          eloDelta: true,
          eloSnapshot: true,
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });

  return NextResponse.json(
    rooms.map((r) => ({
      id: r.id,
      variant: r.variant,
      deckSize: r.deckSize,
      maxPlayers: r.maxPlayers,
      timeControl: r.timeControl,
      durakUserId: r.winner, // the loser (durak)
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      players: r.players.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        image: p.user.image,
        seatIdx: p.seatIdx,
        eloDelta: p.eloDelta,
        eloSnapshot: p.eloSnapshot,
        isDurak: p.userId === r.winner,
      })),
    })),
  );
}
