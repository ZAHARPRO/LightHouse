import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const room = await prisma.durakRoom.findUnique({ where: { id }, include: { players: true } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Room not open" }, { status: 400 });
  if (room.confirmingAt) return NextResponse.json({ error: "Room is confirming a match" }, { status: 400 });
  if (room.players.some((p) => p.userId === userId)) return NextResponse.json({ ok: true });
  if (room.players.length >= room.maxPlayers) return NextResponse.json({ error: "Room full" }, { status: 400 });

  // Rated queue: check mute
  if (room.rated) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { durakQueueMutedUntil: true } });
    if (u?.durakQueueMutedUntil && u.durakQueueMutedUntil > new Date()) {
      return NextResponse.json({ error: "muted", mutedUntil: u.durakQueueMutedUntil.toISOString() }, { status: 429 });
    }
  }

  // Find the lowest free seat.
  const used = new Set(room.players.map((p) => p.seatIdx));
  let seat = 0;
  while (used.has(seat)) seat++;

  const user = room.rated
    ? await prisma.user.findUnique({ where: { id: userId }, select: { durakElo: true } })
    : null;

  try {
    await prisma.durakPlayerSlot.create({
      data: { roomId: id, userId, seatIdx: seat, eloSnapshot: user?.durakElo ?? null },
    });
  } catch {
    return NextResponse.json({ error: "Room full" }, { status: 400 });
  }

  // Rated: when room is now full, enter confirming phase
  const newCount = room.players.length + 1;
  if (room.rated && newCount >= room.maxPlayers) {
    await prisma.durakRoom.update({
      where: { id },
      data: { confirmingAt: new Date(), confirmedSeats: "[]" },
    });
  }

  broadcast(id, { type: "update" });
  return NextResponse.json({ ok: true });
}
