import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TTL = 60_000;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.checkersRoom.findUnique({ where: { id }, select: { spectatorsJson: true, hostId: true, guestId: true } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.hostId === session.user.id || room.guestId === session.user.id)
    return NextResponse.json({ spectatorCount: 0 });

  const now = Date.now();
  const spectators = (room.spectatorsJson ? JSON.parse(room.spectatorsJson as string) as { id: string; at: number }[] : [])
    .filter(s => now - s.at < TTL && s.id !== session.user.id);
  spectators.push({ id: session.user.id!, at: now });

  await prisma.checkersRoom.update({ where: { id }, data: { spectatorsJson: JSON.stringify(spectators) } });
  return NextResponse.json({ spectatorCount: spectators.length });
}
