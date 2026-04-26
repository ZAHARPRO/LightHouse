import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const TTL = 60_000; // spectator expires after 60s without heartbeat

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? `anon-${id}`;

  const room = await prisma.chessRoom.findUnique({ where: { id }, select: { spectatorsJson: true, hostId: true, guestId: true } });
  if (!room) return NextResponse.json({ ok: true });

  // Players are not spectators
  if (userId === room.hostId || userId === room.guestId) return NextResponse.json({ ok: true });

  const now = Date.now();
  const list: { id: string; at: number }[] = room.spectatorsJson ? JSON.parse(room.spectatorsJson) : [];
  const filtered = list.filter(s => s.id !== userId && now - s.at < TTL);
  filtered.push({ id: userId, at: now });

  await prisma.chessRoom.update({ where: { id }, data: { spectatorsJson: JSON.stringify(filtered) } });
  return NextResponse.json({ count: filtered.length });
}
