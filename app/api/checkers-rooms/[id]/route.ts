import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
import { boardFromJson } from "@/lib/checkers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const room = await prisma.checkersRoom.findUnique({
    where: { id },
    include: {
      host:  { select: { id: true, name: true, image: true, checkersElo: true } },
      guest: { select: { id: true, name: true, image: true, checkersElo: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session?.user?.id ?? null;
  const myRole = userId === room.hostId ? "host" : userId === room.guestId ? "guest" : "spectator";

  const nowMs = Date.now();
  const spectators: { id: string; at: number }[] = room.spectatorsJson ? JSON.parse(room.spectatorsJson as string) : [];
  const spectatorCount = spectators.filter(s => nowMs - s.at < 60_000).length;

  let whiteTimeMs = room.whiteTimeMs;
  let blackTimeMs = room.blackTimeMs;
  let liveStatus   = room.status;
  let liveWinner   = room.winner;
  let liveWinReason = room.winReason;
  let liveEndedAt  = room.endedAt;

  // Compute live time + auto-timeout
  if (room.status === "PLAYING" && room.lastMoveAt && room.timeControl !== "none" && room.boardJson) {
    const elapsed = nowMs - new Date(room.lastMoveAt).getTime();
    // Determine whose turn it is from move count (white = even moves, black = odd)
    const whiteTurn = room.moveCount % 2 === 0
      ? room.hostColor === "w"   // white starts
      : room.hostColor !== "w";
    // Actually: moveCount tracks how many moves have been played.
    // After 0 moves it's white's turn, after 1 it's black's turn, etc.
    const isWhiteTurn = room.moveCount % 2 === 0;
    if (isWhiteTurn) whiteTimeMs = Math.max(0, (whiteTimeMs ?? 0) - elapsed);
    else             blackTimeMs = Math.max(0, (blackTimeMs ?? 0) - elapsed);

    const timedOut = isWhiteTurn ? (whiteTimeMs ?? 1) <= 0 : (blackTimeMs ?? 1) <= 0;
    if (timedOut) {
      const now = new Date();
      const timeoutWinner = isWhiteTurn ? "black" : "white";
      await prisma.checkersRoom.updateMany({
        where: { id, status: "PLAYING" },
        data: { status: "FINISHED", winner: timeoutWinner, winReason: "timeout", endedAt: now,
          chatJson: null, ...(isWhiteTurn ? { whiteTimeMs: 0 } : { blackTimeMs: 0 }) },
      });
      liveStatus = "FINISHED"; liveWinner = timeoutWinner; liveWinReason = "timeout"; liveEndedAt = now;

      if (room.rated && room.guestId) {
        const hc = room.hostColor ?? "w";
        const winnerId = timeoutWinner === "white"
          ? (hc === "w" ? room.hostId : room.guestId)
          : (hc === "b" ? room.hostId : room.guestId);
        const loserId = winnerId === room.hostId ? room.guestId : room.hostId;
        const [winner, loser] = await Promise.all([
          prisma.user.findUnique({ where: { id: winnerId }, select: { checkersElo: true } }),
          prisma.user.findUnique({ where: { id: loserId! }, select: { checkersElo: true } }),
        ]);
        if (winner && loser && !room.hostEloDelta) {
          const [delta] = calculateEloDelta(winner.checkersElo, loser.checkersElo);
          const hostIsWinner = winnerId === room.hostId;
          await prisma.$transaction([
            prisma.user.update({ where: { id: winnerId }, data: { checkersElo: Math.max(100, winner.checkersElo + delta) } }),
            prisma.user.update({ where: { id: loserId! }, data: { checkersElo: Math.max(100, loser.checkersElo - delta) } }),
            prisma.checkersRoom.update({ where: { id }, data: {
              hostEloDelta:  hostIsWinner ?  delta : -delta,
              guestEloDelta: hostIsWinner ? -delta :  delta,
            }}),
          ]);
        }
      }
    }

    void whiteTurn; // suppress unused warning
  }

  const board = room.boardJson ? boardFromJson(room.boardJson) : null;

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
    board,
    moveCount: room.moveCount,
    mustJumpFrom: room.mustJumpFrom ? JSON.parse(room.mustJumpFrom) : null,
    whiteTimeMs,
    blackTimeMs,
    winner: liveWinner,
    winReason: liveWinReason,
    startedAt: room.startedAt,
    endedAt: liveEndedAt,
    rated: room.rated,
    hostElo: room.host.checkersElo,
    guestElo: room.guest?.checkersElo ?? null,
    hostEloDelta: room.hostEloDelta,
    guestEloDelta: room.guestEloDelta,
    chat: room.chatJson ? JSON.parse(room.chatJson) : [],
    spectatorCount,
  });
}
