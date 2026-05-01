import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forfeitMinesweeper } from "@/lib/forfeit";

const DISCONNECT_MS = 30_000; // 30s without ping = disconnected

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const room = await prisma.minesweeperRoom.findUnique({ where: { id } });
  if (!room || room.status !== "PLAYING") return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  const now = new Date();

  // Update this player's last seen timestamp
  await prisma.minesweeperRoom.update({
    where: { id },
    data: isHost ? { hostLastSeen: now } : { guestLastSeen: now },
  });

  // Check if the OPPONENT has disconnected
  const cutoff = new Date(Date.now() - DISCONNECT_MS);
  const oppLastSeen = isHost ? room.guestLastSeen : room.hostLastSeen;

  if (oppLastSeen && oppLastSeen < cutoff && room.guestId) {
    // Opponent hasn't pinged in 30s → they forfeited
    const winnerId    = userId;
    const loserId     = isHost ? room.guestId : room.hostId;
    const isHostWinner = isHost;

    await forfeitMinesweeper(
      prisma, id, winnerId, loserId,
      "disconnected", isHostWinner,
      room.rated, room.guestId,
    );
    return NextResponse.json({ disconnectWin: true });
  }

  return NextResponse.json({ ok: true });
}
