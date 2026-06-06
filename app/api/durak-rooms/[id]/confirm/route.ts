import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";
import { roomInclude } from "@/lib/durak-room";
import { startDurakGame } from "@/lib/start-durak-game";

const MUTE_MS = 20_000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { accept } = (await req.json()) as { accept: boolean };

  const room = await prisma.durakRoom.findUnique({ where: { id }, include: roomInclude });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "WAITING" || !room.confirmingAt) {
    return NextResponse.json({ error: "Not in confirming state" }, { status: 400 });
  }

  const mySlot = room.players.find((p) => p.userId === userId);
  if (!mySlot) return NextResponse.json({ error: "Not in room" }, { status: 403 });

  if (!accept) {
    // Decline: mute decliner, remove from room, reset confirming for the rest
    const remaining = room.players.filter((p) => p.userId !== userId);
    const newHostId = remaining.length > 0
      ? (remaining.find((p) => p.userId === room.hostId) ? room.hostId : remaining[0].userId)
      : room.hostId;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { durakQueueMutedUntil: new Date(Date.now() + MUTE_MS) },
      }),
      prisma.durakPlayerSlot.delete({ where: { id: mySlot.id } }),
      // Reset confirming; if room is now empty, it will be cleaned up by stale cleanup
      prisma.durakRoom.update({
        where: { id },
        data: { confirmingAt: null, confirmedSeats: "[]", hostId: newHostId },
      }),
    ]);

    broadcast(id, { type: "update" });
    return NextResponse.json({ ok: true, muted: true, mutedUntil: new Date(Date.now() + MUTE_MS).toISOString() });
  }

  // Accept: add seatIdx to confirmedSeats
  const confirmed: number[] = (() => { try { return JSON.parse(room.confirmedSeats || "[]"); } catch { return []; } })();
  if (!confirmed.includes(mySlot.seatIdx)) confirmed.push(mySlot.seatIdx);

  const allConfirmed = room.players.every((p) => confirmed.includes(p.seatIdx));

  if (allConfirmed) {
    await startDurakGame(id, room, room.players);
    return NextResponse.json({ ok: true, started: true });
  }

  await prisma.durakRoom.update({
    where: { id },
    data: { confirmedSeats: JSON.stringify(confirmed) },
  });
  broadcast(id, { type: "update" });
  return NextResponse.json({ ok: true });
}
