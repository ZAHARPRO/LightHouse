import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forfeitBattleship } from "@/lib/forfeit";

const DISCONNECT_MS_UNTIMED = 30_000;
const DISCONNECT_MS_TIMED   = 5 * 60 * 1000;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const room = await prisma.battleshipRoom.findUnique({ where: { id } });
  if (!room || room.status !== "PLAYING") return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  const now = new Date();
  await prisma.battleshipRoom.update({
    where: { id },
    data: isHost ? { hostLastSeen: now } : { guestLastSeen: now },
  });

  const disconnectMs = room.timeControl === "none" ? DISCONNECT_MS_UNTIMED : DISCONNECT_MS_TIMED;
  const cutoff       = new Date(Date.now() - disconnectMs);
  const oppLastSeen  = isHost ? room.guestLastSeen : room.hostLastSeen;

  if (oppLastSeen && oppLastSeen < cutoff && room.guestId) {
    const winnerId    = userId;
    const loserId     = isHost ? room.guestId : room.hostId;
    const isHostWinner = isHost;

    await forfeitBattleship(
      prisma, id, winnerId, loserId,
      "disconnected", isHostWinner,
      room.rated, room.guestId,
    );
    return NextResponse.json({ disconnectWin: true });
  }

  return NextResponse.json({ ok: true });
}
