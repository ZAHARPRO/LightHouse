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
  if (room.players.some((p) => p.userId === userId)) return NextResponse.json({ ok: true });
  if (room.players.length >= room.maxPlayers) return NextResponse.json({ error: "Room full" }, { status: 400 });

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

  broadcast(id, { type: "update" });
  return NextResponse.json({ ok: true });
}
