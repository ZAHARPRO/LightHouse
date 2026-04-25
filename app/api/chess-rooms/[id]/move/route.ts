import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromFEN, toFEN, getLegalMoves, applyMove, toSAN, isCheckmate, isStalemate } from "@/lib/chess";
import { awardBadge } from "@/lib/awardBadge";
import { calculateEloDelta } from "@/lib/elo";

const CAPTURE_BONUS: Record<string, number> = { P: 1000, N: 2000, B: 2000, R: 3000, Q: 4000 };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { from, to, promotion = "Q" } = await req.json() as {
    from: [number, number]; to: [number, number]; promotion?: string;
  };

  const room = await prisma.chessRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not in game" }, { status: 400 });
  if (!room.fen) return NextResponse.json({ error: "No FEN" }, { status: 400 });

  const userId = session.user.id;
  const isHost = userId === room.hostId;
  const isGuest = userId === room.guestId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  const state = fromFEN(room.fen);
  const hostColor = room.hostColor ?? "w";
  const myColor = isHost ? hostColor : (hostColor === "w" ? "b" : "w");
  if (state.turn !== myColor) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  // Validate move
  const legal = getLegalMoves(state, from[0], from[1]);
  const matched = legal.find(m =>
    m.to[0] === to[0] && m.to[1] === to[1] &&
    (!m.promotion || m.promotion === promotion)
  );
  if (!matched) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

  const san = toSAN(state, matched);
  const nextState = applyMove(state, matched);
  const nextFen = toFEN(nextState);

  const moves: string[] = room.movesSAN ? JSON.parse(room.movesSAN) : [];
  moves.push(san);

  const update: Record<string, unknown> = {
    fen: nextFen,
    movesSAN: JSON.stringify(moves),
    lastMoveJson: JSON.stringify({ from, to }),
    lastMoveAt: new Date(),
  };

  // Time control
  if (room.timeControl !== "none" && room.lastMoveAt) {
    const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
    const white = myColor === "w";
    let remaining = (white ? room.whiteTimeMs : room.blackTimeMs) ?? 0;
    remaining = Math.max(0, remaining - elapsed);

    // Increment: +5s base when ≤ 1 min remaining, plus capture bonus
    if (remaining <= 60000) {
      remaining += 5000;
      if (matched.captured) remaining += CAPTURE_BONUS[matched.captured] ?? 0;
    }

    // Check timeout
    if (remaining <= 0) {
      const timeoutWinner = white ? "black" : "white";
      await prisma.chessRoom.update({
        where: { id },
        data: {
          ...update,
          [white ? "whiteTimeMs" : "blackTimeMs"]: 0,
          status: "FINISHED",
          winner: timeoutWinner,
          winReason: "timeout",
          endedAt: new Date(),
        },
      });

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
        if (winner && loser) {
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

      return NextResponse.json({ ok: true });
    }

    update[white ? "whiteTimeMs" : "blackTimeMs"] = remaining;
  }

  // Check game end
  if (isCheckmate(nextState)) {
    update.status = "FINISHED";
    update.winner = myColor === "w" ? "white" : "black";
    update.winReason = "checkmate";
    update.endedAt = new Date();
  } else if (isStalemate(nextState)) {
    update.status = "FINISHED";
    update.winner = "draw";
    update.winReason = "stalemate";
    update.endedAt = new Date();
  }

  await prisma.chessRoom.update({ where: { id }, data: update });

  // Auto-award badges + ELO on finish
  if (update.status === "FINISHED" && update.winner !== "draw") {
    const winnerColor = update.winner as string;
    const hColor = room.hostColor ?? "w";
    const winnerId = winnerColor === "white"
      ? (hColor === "w" ? room.hostId : room.guestId)
      : (hColor === "b" ? room.hostId : room.guestId);
    const loserId = winnerId === room.hostId ? room.guestId : room.hostId;

    if (winnerId) {
      await awardBadge(prisma, winnerId, "CHESS_WIN");
      await awardBadge(prisma, winnerId, "CHESS_ONLINE_WIN");
    }

    // ELO update for rated games
    if (room.rated && winnerId && loserId) {
      const [winner, loser] = await Promise.all([
        prisma.user.findUnique({ where: { id: winnerId }, select: { chessElo: true } }),
        prisma.user.findUnique({ where: { id: loserId  }, select: { chessElo: true } }),
      ]);
      if (winner && loser) {
        const [delta] = calculateEloDelta(winner.chessElo, loser.chessElo);
        const winnerNew = Math.max(100, winner.chessElo + delta);
        const loserNew  = Math.max(100, loser.chessElo  - delta);
        const hostIsWinner = winnerId === room.hostId;
        await prisma.$transaction([
          prisma.user.update({ where: { id: winnerId }, data: { chessElo: winnerNew } }),
          prisma.user.update({ where: { id: loserId  }, data: { chessElo: loserNew  } }),
          prisma.chessRoom.update({ where: { id }, data: {
            hostEloDelta:  hostIsWinner ? delta  : -delta,
            guestEloDelta: hostIsWinner ? -delta :  delta,
          }}),
        ]);
      }
    }
  }

  return NextResponse.json({ ok: true, san });
}
