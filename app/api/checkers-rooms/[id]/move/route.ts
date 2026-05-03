import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { boardFromJson, boardToJson, getLegalMoves, applyMove, isGameOver, canContinueJump } from "@/lib/checkers";
import { awardBadge, awardCheckersEloBadges } from "@/lib/awardBadge";
import { calculateEloDelta } from "@/lib/elo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { from, to } = await req.json() as { from: [number, number]; to: [number, number] };

  const room = await prisma.checkersRoom.findUnique({ where: { id } });
  if (!room)            return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not in game" }, { status: 400 });
  if (!room.boardJson)  return NextResponse.json({ error: "No board" }, { status: 400 });

  const userId = session.user.id;
  const isHost  = userId === room.hostId;
  const isGuest = userId === room.guestId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  // Determine whose turn (white moves on even moveCount, black on odd)
  const isWhiteTurn = room.moveCount % 2 === 0;
  const hc = room.hostColor ?? "w";
  const myColor = (isHost ? hc : (hc === "w" ? "b" : "w")) as import("@/lib/checkers").Color;
  const myIsWhite = myColor === "w";
  if (myIsWhite !== isWhiteTurn) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  const board = boardFromJson(room.boardJson);
  const mustJumpFrom: [number, number] | null = room.mustJumpFrom ? JSON.parse(room.mustJumpFrom) : null;

  const legal = getLegalMoves(board, myColor, mustJumpFrom);
  const matched = legal.find(m => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1]);
  if (!matched) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

  const { board: newBoard, promoted } = applyMove(board, matched);

  // Multi-jump: if capture and not promoted and more captures available, keep same player's turn
  let nextMustJump: [number, number] | null = null;
  let nextMoveCount = room.moveCount + 1;
  if (matched.captured && !promoted && canContinueJump(newBoard, to[0], to[1])) {
    nextMustJump = [to[0], to[1]];
    nextMoveCount = room.moveCount; // same player's turn
  }

  const update: Record<string, unknown> = {
    boardJson: boardToJson(newBoard),
    moveCount: nextMoveCount,
    mustJumpFrom: nextMustJump ? JSON.stringify(nextMustJump) : null,
    lastMoveAt: new Date(),
  };

  // Time control
  if (room.timeControl !== "none" && room.lastMoveAt && !nextMustJump) {
    const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
    let remaining = (myIsWhite ? room.whiteTimeMs : room.blackTimeMs) ?? 0;
    remaining = Math.max(0, remaining - elapsed);
    if (remaining <= 60000) remaining += 5000; // +5s when low on time
    if (remaining <= 0) {
      const timeoutWinner = myIsWhite ? "black" : "white";
      await prisma.checkersRoom.update({ where: { id }, data: {
        ...update, [myIsWhite ? "whiteTimeMs" : "blackTimeMs"]: 0,
        status: "FINISHED", winner: timeoutWinner, winReason: "timeout", endedAt: new Date(),
      }});
      const twId = timeoutWinner === "white"
        ? (hc === "w" ? room.hostId : room.guestId!)
        : (hc === "b" ? room.hostId : room.guestId!);
      await awardBadge(prisma, twId, "CHECKERS_WIN");
      await awardBadge(prisma, twId, "CHECKERS_ONLINE_WIN");
      if (room.rated && room.guestId) await applyElo(prisma, id, room, twId);
      return NextResponse.json({ ok: true });
    }
    update[myIsWhite ? "whiteTimeMs" : "blackTimeMs"] = remaining;
  }

  // Determine next turn color (after possible turn-pass)
  const nextTurnIsWhite = nextMustJump ? myIsWhite : !myIsWhite;
  const nextColor = nextTurnIsWhite ? "w" : "b";

  // Check game over (only when turn actually changes)
  if (!nextMustJump) {
    const { over, winner } = isGameOver(newBoard, nextColor);
    if (over) {
      update.status   = "FINISHED";
      update.winner   = winner === "w" ? "white" : "black";
      update.winReason = "no_moves";
      update.endedAt  = new Date();
      update.chatJson  = null;
    }
  }

  await prisma.checkersRoom.update({ where: { id }, data: update });

  if (update.status === "FINISHED" && update.winner !== "draw") {
    const winnerColor = update.winner as string;
    const winnerId = winnerColor === "white"
      ? (hc === "w" ? room.hostId : room.guestId!)
      : (hc === "b" ? room.hostId : room.guestId!);
    await awardBadge(prisma, winnerId, "CHECKERS_WIN");
    await awardBadge(prisma, winnerId, "CHECKERS_ONLINE_WIN");
    if (room.rated && room.guestId) await applyElo(prisma, id, room, winnerId);
  }

  return NextResponse.json({ ok: true, mustJumpFrom: nextMustJump });
}

async function applyElo(
  prisma: Parameters<typeof awardBadge>[0],
  id: string,
  room: { hostId: string; guestId: string | null; rated: boolean; hostEloDelta: number | null },
  winnerId: string,
) {
  if (!room.guestId || room.hostEloDelta !== null) return;
  const loserId = winnerId === room.hostId ? room.guestId : room.hostId;
  const [winner, loser] = await Promise.all([
    prisma.user.findUnique({ where: { id: winnerId }, select: { checkersElo: true } }),
    prisma.user.findUnique({ where: { id: loserId  }, select: { checkersElo: true } }),
  ]);
  if (!winner || !loser) return;
  const [delta] = calculateEloDelta(winner.checkersElo, loser.checkersElo);
  const winnerNew = Math.max(100, winner.checkersElo + delta);
  const hostIsWinner = winnerId === room.hostId;
  await prisma.$transaction([
    prisma.user.update({ where: { id: winnerId }, data: { checkersElo: winnerNew } }),
    prisma.user.update({ where: { id: loserId  }, data: { checkersElo: Math.max(100, loser.checkersElo - delta) } }),
    prisma.checkersRoom.update({ where: { id }, data: {
      hostEloDelta:  hostIsWinner ?  delta : -delta,
      guestEloDelta: hostIsWinner ? -delta :  delta,
    }}),
  ]);
  await awardCheckersEloBadges(prisma, winnerId, winnerNew);
}
