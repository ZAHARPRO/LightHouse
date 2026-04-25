import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const room = await prisma.chessRoom.findUnique({
    where: { id },
    include: {
      host:  { select: { id: true, name: true, image: true, chessElo: true } },
      guest: { select: { id: true, name: true, image: true, chessElo: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session?.user?.id ?? null;
  const myRole = userId === room.hostId ? "host" : userId === room.guestId ? "guest" : "spectator";

  // Compute time remaining (accounting for time elapsed since last move)
  let whiteTimeMs = room.whiteTimeMs;
  let blackTimeMs = room.blackTimeMs;
  let liveStatus = room.status;
  let liveWinner = room.winner;
  let liveWinReason = room.winReason;
  let liveEndedAt = room.endedAt;

  if (room.status === "PLAYING" && room.lastMoveAt && room.timeControl !== "none") {
    const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
    const whiteTurn = (room.fen ?? "").split(" ")[1] === "w";
    if (whiteTurn) whiteTimeMs = Math.max(0, (whiteTimeMs ?? 0) - elapsed);
    else blackTimeMs = Math.max(0, (blackTimeMs ?? 0) - elapsed);

    // Auto-timeout: if the current player's time has expired, finish the game
    const timedOut = whiteTurn ? (whiteTimeMs ?? 1) <= 0 : (blackTimeMs ?? 1) <= 0;
    if (timedOut) {
      const now = new Date();
      const timeoutWinner = whiteTurn ? "black" : "white";
      await prisma.chessRoom.updateMany({
        where: { id, status: "PLAYING" },
        data: {
          status: "FINISHED",
          winner: timeoutWinner,
          winReason: "timeout",
          endedAt: now,
          ...(whiteTurn ? { whiteTimeMs: 0 } : { blackTimeMs: 0 }),
        },
      });
      liveStatus = "FINISHED";
      liveWinner = timeoutWinner;
      liveWinReason = "timeout";
      liveEndedAt = now;

      if (room.rated && room.guestId) {
        const hColor = room.hostColor ?? "w";
        const winnerId = timeoutWinner === "white"
          ? (hColor === "w" ? room.hostId : room.guestId)
          : (hColor === "b" ? room.hostId : room.guestId);
        const loserId = winnerId === room.hostId ? room.guestId : room.hostId;
        const [winner, loser] = await Promise.all([
          prisma.user.findUnique({ where: { id: winnerId }, select: { chessElo: true } }),
          prisma.user.findUnique({ where: { id: loserId! }, select: { chessElo: true } }),
        ]);
        if (winner && loser && !room.hostEloDelta) {
          const [delta] = calculateEloDelta(winner.chessElo, loser.chessElo);
          const hostIsWinner = winnerId === room.hostId;
          await prisma.$transaction([
            prisma.user.update({ where: { id: winnerId }, data: { chessElo: Math.max(100, winner.chessElo + delta) } }),
            prisma.user.update({ where: { id: loserId! }, data: { chessElo: Math.max(100, loser.chessElo - delta) } }),
            prisma.chessRoom.update({ where: { id }, data: {
              hostEloDelta:  hostIsWinner ?  delta : -delta,
              guestEloDelta: hostIsWinner ? -delta :  delta,
            }}),
          ]);
        }
      }
    }
  }

  return NextResponse.json({
    id: room.id,
    status: liveStatus,
    timeControl: room.timeControl,
    myRole,
    hostId: room.hostId,
    hostName: room.host.name,
    hostImage: room.host.image,
    guestId: room.guestId,
    guestName: room.guest?.name ?? null,
    guestImage: room.guest?.image ?? null,
    hostReady: room.hostReady,
    guestReady: room.guestReady,
    hostColor: room.hostColor ?? "w",
    fen: room.fen,
    movesSAN: room.movesSAN ? JSON.parse(room.movesSAN) : [],
    lastMove: room.lastMoveJson ? JSON.parse(room.lastMoveJson) : null,
    whiteTimeMs,
    blackTimeMs,
    winner: liveWinner,
    winReason: liveWinReason,
    startedAt: room.startedAt,
    endedAt: liveEndedAt,
    rated: room.rated,
    hostElo: room.host.chessElo,
    guestElo: room.guest?.chessElo ?? null,
    hostEloDelta: room.hostEloDelta,
    guestEloDelta: room.guestEloDelta,
  });
}
