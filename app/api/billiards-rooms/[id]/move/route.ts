import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  deserializeState, serializeState, simulateShot, encodeShots, decodeShots,
  BilliardsShot, ShotRecord,
} from "@/lib/billiards";
import { awardBadge, awardBilliardsEloBadges } from "@/lib/awardBadge";
import { calculateEloDelta } from "@/lib/elo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shot = await req.json() as BilliardsShot;

  const room = await prisma.billiardsRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not in game" }, { status: 400 });
  if (!room.ballsJson) return NextResponse.json({ error: "No game state" }, { status: 400 });

  const userId = session.user.id;
  const isHost  = userId === room.hostId;
  const isGuest = userId === room.guestId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  const myRole = isHost ? "host" : "guest";
  if (room.currentTurn !== myRole) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  const state = deserializeState(room.ballsJson);

  const result = simulateShot(state, shot);

  const hasFoul = result.events.some(e => e.type === "foul");
  const shots: ShotRecord[] = decodeShots(room.shotsJson ?? "[]");
  shots.push({
    by: myRole,
    shot,
    pocketed: result.pocketed,
    continuesTurn: result.continuesTurn,
    foul: hasFoul,
    winner: result.winner ?? undefined,
  });

  const update: Record<string, unknown> = {
    ballsJson: serializeState(result.newState),
    shotsJson: encodeShots(shots),
    currentTurn: result.newState.turn,
    hostGroup: result.newState.hostGroup,
    guestGroup: result.newState.guestGroup,
    phase: result.newState.phase,
    lastMoveAt: new Date(),
  };

  // Time control
  if (room.timeControl.startsWith("pm")) {
    // Per-move: reset both players to full budget after each move
    const budget = parseInt(room.timeControl.slice(2)) * 1000;
    update.hostTimeMs = budget;
    update.guestTimeMs = budget;
  } else if (room.timeControl !== "none" && room.lastMoveAt) {
    const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
    const field = isHost ? "hostTimeMs" : "guestTimeMs";
    const current = (isHost ? room.hostTimeMs : room.guestTimeMs) ?? 0;
    update[field] = Math.max(0, current - elapsed);
  }

  if (result.winner) {
    update.status = "FINISHED";
    update.winner = result.winner;
    update.winReason = result.winReason ?? "pocketed_eight";
    update.endedAt = new Date();
    update.chatJson = null;
  }

  await prisma.billiardsRoom.update({ where: { id }, data: update });

  if (result.winner) {
    const winnerId = result.winner === "host" ? room.hostId : room.guestId!;
    const loserId  = result.winner === "host" ? room.guestId! : room.hostId;

    await awardBadge(prisma, winnerId, "BILLIARDS_ONLINE_WIN");

    if (room.rated && room.guestId) {
      const [winner, loser] = await Promise.all([
        prisma.user.findUnique({ where: { id: winnerId }, select: { billiardsElo: true } }),
        prisma.user.findUnique({ where: { id: loserId  }, select: { billiardsElo: true } }),
      ]);
      if (winner && loser) {
        const [delta] = calculateEloDelta(winner.billiardsElo, loser.billiardsElo);
        const hostIsWinner = winnerId === room.hostId;
        const winnerNew = Math.max(100, winner.billiardsElo + delta);
        await prisma.$transaction([
          prisma.user.update({ where: { id: winnerId }, data: { billiardsElo: winnerNew } }),
          prisma.user.update({ where: { id: loserId  }, data: { billiardsElo: Math.max(100, loser.billiardsElo - delta) } }),
          prisma.billiardsRoom.update({ where: { id }, data: {
            hostEloDelta:  hostIsWinner ?  delta : -delta,
            guestEloDelta: hostIsWinner ? -delta :  delta,
          }}),
        ]);
        await awardBilliardsEloBadges(prisma, winnerId, winnerNew);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
