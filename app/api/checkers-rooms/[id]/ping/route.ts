import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forfeitCheckers } from "@/lib/forfeit";

const PLAYING_DISCONNECT_MS = 5 * 60 * 1000; // 5 min without ping = disconnected during game
const WAITING_DISCONNECT_MS = 2 * 60 * 1000; // 2 min without ping = host abandoned lobby

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const room = await prisma.checkersRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  const now = new Date();

  // Update lastSeen for current user
  if (room.status === "WAITING" || room.status === "PLAYING") {
    await prisma.checkersRoom.update({
      where: { id },
      data: isHost ? { hostLastSeen: now } : { guestLastSeen: now },
    });
  }

  // WAITING: if host has been gone > 2 min, close the lobby
  if (room.status === "WAITING" && isGuest) {
    const cutoff = new Date(Date.now() - WAITING_DISCONNECT_MS);
    if (room.hostLastSeen && room.hostLastSeen < cutoff) {
      await prisma.checkersRoom.update({
        where: { id, status: "WAITING" },
        data: { status: "FINISHED" },
      });
      return NextResponse.json({ lobbyClosed: true });
    }
  }

  // PLAYING: detect opponent disconnect
  if (room.status !== "PLAYING" || !room.guestId) return NextResponse.json({ ok: true });

  const cutoff      = new Date(Date.now() - PLAYING_DISCONNECT_MS);
  const oppLastSeen = isHost ? room.guestLastSeen : room.hostLastSeen;

  if (oppLastSeen && oppLastSeen < cutoff) {
    const winnerId = userId;
    const loserId  = isHost ? room.guestId : room.hostId;
    const hc = room.hostColor ?? "w";
    const isHostWinner = isHost;
    const winnerColor: "white" | "black" = isHostWinner
      ? (hc === "w" ? "white" : "black")
      : (hc === "w" ? "black" : "white");

    await forfeitCheckers(
      prisma, id, winnerId, loserId,
      winnerColor, "disconnected", isHostWinner,
      room.rated, room.guestId,
    );
    return NextResponse.json({ disconnectWin: true });
  }

  return NextResponse.json({ ok: true });
}
