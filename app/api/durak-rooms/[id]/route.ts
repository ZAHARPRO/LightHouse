import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRoom, roomInclude } from "@/lib/durak-room";
import { resolveTimeouts } from "@/lib/durak-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let room = await prisma.durakRoom.findUnique({ where: { id }, include: roomInclude });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Track spectator presence for non-players who fetch the room.
  if (userId && !room.players.some((p) => p.userId === userId) && room.status === "PLAYING") {
    const specs: { id: string; at: number }[] = room.spectatorsJson
      ? JSON.parse(room.spectatorsJson)
      : [];
    const filtered = specs.filter((s) => s.id !== userId && Date.now() - s.at < 60_000);
    filtered.push({ id: userId, at: Date.now() });
    await prisma.durakRoom.update({ where: { id }, data: { spectatorsJson: JSON.stringify(filtered) } });
    room.spectatorsJson = JSON.stringify(filtered);
  }

  // Apply any move-timeout that may have elapsed since the last update.
  if (room.status === "PLAYING" && room.timeControl !== "none") {
    const changed = await resolveTimeouts(room);
    if (changed) {
      room = (await prisma.durakRoom.findUnique({ where: { id }, include: roomInclude }))!;
    }
  }

  return NextResponse.json(sanitizeRoom(room, userId));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await prisma.durakRoom.updateMany({
    where: { id, hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
