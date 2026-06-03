import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";
import type { PendingCheat } from "@/lib/durak-room";
import { finalizeRatedDurak } from "@/lib/durak-room";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const room = await prisma.durakRoom.findUnique({
    where: { id },
    include: { players: { orderBy: { seatIdx: "asc" } } },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not playing" }, { status: 400 });
  if (!room.pendingCheatJson) return NextResponse.json({ error: "Nothing to catch" }, { status: 400 });

  const catcher = room.players.find((p) => p.userId === userId);
  if (!catcher) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  const pending = JSON.parse(room.pendingCheatJson) as PendingCheat;
  if (pending.expiresAt <= Date.now()) return NextResponse.json({ error: "Too late" }, { status: 400 });
  if (pending.cheaterIdx === catcher.seatIdx) return NextResponse.json({ error: "Cannot catch yourself" }, { status: 400 });

  const cheaterSlot = room.players.find((p) => p.seatIdx === pending.cheaterIdx);
  if (!cheaterSlot) return NextResponse.json({ error: "Cheater gone" }, { status: 400 });

  // Cheater is caught: they immediately become the durak and lose this game.
  const cheaterUser = await prisma.user.update({
    where: { id: cheaterSlot.userId },
    data: { durakCheaterCatches: { increment: 1 } },
    select: { durakCheaterCatches: true },
  });
  if (cheaterUser.durakCheaterCatches >= 3) {
    await prisma.user.update({ where: { id: cheaterSlot.userId }, data: { durakCheaterBanned: true } });
  }

  await prisma.durakRoom.update({
    where: { id },
    data: {
      status: "FINISHED",
      phase: "finished",
      winner: cheaterSlot.userId,
      endedAt: new Date(),
      pendingCheatJson: null,
    },
  });

  if (room.rated) await finalizeRatedDurak(id, cheaterSlot.seatIdx);

  const cheaterName =
    (await prisma.user.findUnique({ where: { id: cheaterSlot.userId }, select: { name: true } }))?.name ?? "?";

  broadcast(id, { type: "catch", catcherName: session.user.name ?? "?", cheaterName });
  broadcast(id, { type: "update" });

  return NextResponse.json({ ok: true });
}
