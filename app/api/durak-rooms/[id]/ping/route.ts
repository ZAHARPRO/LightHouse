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

  if (room.status === "WAITING") {
    // Confirmation timeout: mute non-confirmed players after 20 s
    if (room.confirmingAt && Date.now() - room.confirmingAt.getTime() > 20_000) {
      const confirmed: number[] = (() => { try { return JSON.parse(room.confirmedSeats || "[]"); } catch { return []; } })();
      const nonConfirmed = room.players.filter((p) => !confirmed.includes(p.seatIdx));
      if (nonConfirmed.length > 0) {
        const newHostId =
          room.players.find((p) => confirmed.includes(p.seatIdx) && p.userId === room.hostId)?.userId ??
          room.players.find((p) => confirmed.includes(p.seatIdx))?.userId ??
          room.hostId;
        await prisma.$transaction([
          ...nonConfirmed.map((p) =>
            prisma.user.update({ where: { id: p.userId }, data: { durakQueueMutedUntil: new Date(Date.now() + 20_000) } })
          ),
          ...nonConfirmed.map((p) =>
            prisma.durakPlayerSlot.delete({ where: { id: p.id } })
          ),
          prisma.durakRoom.update({ where: { id }, data: { confirmingAt: null, confirmedSeats: "[]", hostId: newHostId } }),
        ]);
        broadcast(id, { type: "update" });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (room.status === "PLAYING") {
    // Always touch updatedAt so lobby knows someone is still watching
    await prisma.durakRoom.update({ where: { id }, data: { lastMoveAt: room.lastMoveAt } }).catch(() => {});
    if (room.timeControl !== "none") {
      const changed = await resolveTimeouts(room);
      if (changed) broadcast(id, { type: "update" });
    }
  }

  return NextResponse.json({ ok: true });
}
