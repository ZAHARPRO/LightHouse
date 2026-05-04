import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forfeitChess } from "@/lib/forfeit";

const DISCONNECT_MS_UNTIMED = 30_000;          // 30s for infinite games
const DISCONNECT_MS_TIMED  = 5 * 60 * 1000;   // 5 min for timed games

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const room = await prisma.chessRoom.findUnique({ where: { id } });
  if (!room || room.status !== "PLAYING") return NextResponse.json({ ok: true });

  const isHost  = room.hostId  === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  const now = new Date();

  await prisma.chessRoom.update({
    where: { id },
    data: isHost ? { hostLastSeen: now } : { guestLastSeen: now },
  });

  const disconnectMs = room.timeControl === "none" ? DISCONNECT_MS_UNTIMED : DISCONNECT_MS_TIMED;
  const cutoff       = new Date(Date.now() - disconnectMs);
  const oppLastSeen = isHost ? room.guestLastSeen : room.hostLastSeen;

  if (oppLastSeen && oppLastSeen < cutoff && room.guestId) {
    const winnerId = userId;
    const loserId  = isHost ? room.guestId : room.hostId;
    const hostColor = room.hostColor ?? "w";
    const isHostWinner = isHost;
    const winnerColor = isHostWinner
      ? (hostColor === "w" ? "white" : "black")
      : (hostColor === "w" ? "black" : "white");

    await forfeitChess(
      prisma, id, winnerId, loserId,
      winnerColor as "white" | "black",
      "disconnected", isHostWinner,
      room.rated, room.guestId,
    );
    return NextResponse.json({ disconnectWin: true });
  }

  return NextResponse.json({ ok: true });
}
