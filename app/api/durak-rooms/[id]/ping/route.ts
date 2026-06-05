import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveTimeouts } from "@/lib/durak-engine";
import { roomInclude } from "@/lib/durak-room";
import { broadcast } from "@/lib/durak-sse";

// Keep-alive + drives move timeouts and host-abandon cleanup.
const WAITING_ABANDON_MS = 5 * 60 * 1000;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const room = await prisma.durakRoom.findUnique({ where: { id }, include: roomInclude });
  if (!room) return NextResponse.json({ ok: true });

  // Waiting room: touch updatedAt so the stale-cleanup in GET knows it's alive.
  if (room.status === "WAITING") {
    const isHost = room.hostId === session.user.id;
    if (isHost) {
      // Touch the room so updatedAt reflects last ping
      await prisma.durakRoom.update({ where: { id }, data: { lastMoveAt: new Date() } }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (room.status === "PLAYING" && room.timeControl !== "none") {
    const changed = await resolveTimeouts(room);
    if (changed) broadcast(id, { type: "update" });
  }

  return NextResponse.json({ ok: true });
}
