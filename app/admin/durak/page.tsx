import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DurakAdminClient from "./DurakAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminDurakPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/feed");

  const [rooms, cheaters] = await Promise.all([
    prisma.durakRoom.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        host: { select: { name: true } },
        players: {
          orderBy: { seatIdx: "asc" },
          select: { userId: true, seatIdx: true, eloDelta: true, user: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { OR: [{ durakCheaterCatches: { gt: 0 } }, { durakCheaterBanned: true }] },
      orderBy: { durakCheaterCatches: "desc" },
      take: 50,
      select: { id: true, name: true, image: true, durakCheaterCatches: true, durakCheaterBanned: true, durakElo: true },
    }),
  ]);

  const data = rooms.map((r) => ({
    id: r.id,
    status: r.status,
    variant: r.variant,
    deckSize: r.deckSize,
    maxPlayers: r.maxPlayers,
    rated: r.rated,
    fairPlay: r.fairPlay,
    hostName: r.host.name,
    winner: r.winner,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    players: r.players.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      seatIdx: p.seatIdx,
      eloDelta: p.eloDelta,
      isDurak: p.userId === r.winner,
    })),
  }));

  return <DurakAdminClient rooms={data} cheaters={cheaters} />;
}
