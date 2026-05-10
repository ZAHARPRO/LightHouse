import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const room = await prisma.billiardsRoom.findUnique({
    where: { id },
    include: {
      host:  { select: { id: true, name: true, image: true, billiardsElo: true } },
      guest: { select: { id: true, name: true, image: true, billiardsElo: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session?.user?.id ?? null;
  const myRole = userId === room.hostId ? "host" : userId === room.guestId ? "guest" : "spectator";

  const nowMs = Date.now();
  const spectators: { id: string; at: number }[] = room.spectatorsJson
    ? JSON.parse(room.spectatorsJson as string)
    : [];
  const spectatorCount = spectators.filter(s => nowMs - s.at < 60_000).length;

  let liveStatus = room.status;
  let liveWinner = room.winner;
  let liveWinReason = room.winReason;
  let liveEndedAt = room.endedAt;
  let hostTimeMs = room.hostTimeMs;
  let guestTimeMs = room.guestTimeMs;

  // Auto-timeout check
  if (room.status === "PLAYING" && room.lastMoveAt && room.timeControl !== "none") {
    const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
    const hostTurn = room.currentTurn === "host";
    if (hostTurn) hostTimeMs = Math.max(0, (hostTimeMs ?? 0) - elapsed);
    else guestTimeMs = Math.max(0, (guestTimeMs ?? 0) - elapsed);

    const timedOut = hostTurn ? (hostTimeMs ?? 1) <= 0 : (guestTimeMs ?? 1) <= 0;
    if (timedOut) {
      const now = new Date();
      const winnerRole = hostTurn ? "guest" : "host";
      await prisma.billiardsRoom.updateMany({
        where: { id, status: "PLAYING" },
        data: {
          status: "FINISHED",
          winner: winnerRole,
          winReason: "timeout",
          endedAt: now,
          ...(hostTurn ? { hostTimeMs: 0 } : { guestTimeMs: 0 }),
        },
      });
      liveStatus = "FINISHED";
      liveWinner = winnerRole;
      liveWinReason = "timeout";
      liveEndedAt = now;

      if (room.rated && room.guestId && !room.hostEloDelta) {
        const winnerId = winnerRole === "host" ? room.hostId : room.guestId;
        const loserId  = winnerRole === "host" ? room.guestId : room.hostId;
        const [winner, loser] = await Promise.all([
          prisma.user.findUnique({ where: { id: winnerId }, select: { billiardsElo: true } }),
          prisma.user.findUnique({ where: { id: loserId! }, select: { billiardsElo: true } }),
        ]);
        if (winner && loser) {
          const [delta] = calculateEloDelta(winner.billiardsElo, loser.billiardsElo);
          const hostIsWinner = winnerId === room.hostId;
          await prisma.$transaction([
            prisma.user.update({ where: { id: winnerId }, data: { billiardsElo: Math.max(100, winner.billiardsElo + delta) } }),
            prisma.user.update({ where: { id: loserId! }, data: { billiardsElo: Math.max(100, loser.billiardsElo - delta) } }),
            prisma.billiardsRoom.update({ where: { id }, data: {
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
    currentTurn: room.currentTurn,
    hostGroup: room.hostGroup,
    guestGroup: room.guestGroup,
    phase: room.phase,
    ballsJson: room.ballsJson,
    shotsJson: room.shotsJson,
    hostTimeMs,
    guestTimeMs,
    winner: liveWinner,
    winReason: liveWinReason,
    startedAt: room.startedAt,
    endedAt: liveEndedAt,
    rated: room.rated,
    hostElo: room.host.billiardsElo,
    guestElo: room.guest?.billiardsElo ?? null,
    hostEloDelta: room.hostEloDelta,
    guestEloDelta: room.guestEloDelta,
    chat: room.chatJson ? JSON.parse(room.chatJson) : [],
    spectatorCount,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await prisma.billiardsRoom.updateMany({
    where: { id, hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  if (updated.count === 0) return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
