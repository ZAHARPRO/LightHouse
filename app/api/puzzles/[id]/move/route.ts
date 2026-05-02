import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromFEN, toFEN, getLegalMoves, applyMove, getAllLegalMoves, isInCheck } from "@/lib/chess";
import { getBotMove } from "@/lib/chess-bot";
import type { PieceType, Move, GameState } from "@/lib/chess";

const FILES = "abcdefgh";

function moveToUCI(move: Move): string {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  return `${FILES[fc]}${8 - fr}${FILES[tc]}${8 - tr}${move.promotion?.toLowerCase() ?? ""}`;
}

function applyUCI(fen: string, uci: string): string | null {
  try {
    const state = fromFEN(fen);
    const fc = uci.charCodeAt(0) - 97;
    const fr = 8 - parseInt(uci[1]);
    const tc = uci.charCodeAt(2) - 97;
    const tr = 8 - parseInt(uci[3]);
    const prom = uci[4] ? (uci[4].toUpperCase() as PieceType) : undefined;
    const legal = getLegalMoves(state, fr, fc);
    const move = legal.find(
      (m) => m.to[0] === tr && m.to[1] === tc && (!prom || m.promotion === prom)
    );
    if (!move) return null;
    return toFEN(applyMove(state, prom ? { ...move, promotion: prom } : move));
  } catch {
    return null;
  }
}

function isCheckmate(state: GameState): boolean {
  return getAllLegalMoves(state).length === 0 && isInCheck(state, state.turn);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { moves } = (await req.json()) as { moves: string[] };

  if (!Array.isArray(moves) || moves.length === 0)
    return NextResponse.json({ status: "invalid" });

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id } });
  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const movesCount = puzzle.difficulty === "mate1" ? 1 : 2;

  // Replay all previous moves from puzzle start, validate each
  let fen = puzzle.fen;
  for (let i = 0; i < moves.length - 1; i++) {
    const next = applyUCI(fen, moves[i]);
    if (!next) return NextResponse.json({ status: "invalid" });
    fen = next;
  }

  // Apply the new user move (last element)
  const userUCI = moves[moves.length - 1];
  const afterUser = applyUCI(fen, userUCI);
  if (!afterUser) return NextResponse.json({ status: "invalid" });

  const stateAfterUser = fromFEN(afterUser);

  // Check for checkmate
  if (isCheckmate(stateAfterUser)) {
    const session = await auth();
    if (session?.user?.id) {
      const uid = session.user.id;
      try {
        await prisma.userPuzzleSolve.create({ data: { userId: uid, puzzleId: id } });
        await prisma.chessPuzzle.update({ where: { id }, data: { solveCount: { increment: 1 } } });

        // Check for Puzzle Master badge
        const [total, userSolves, existing] = await Promise.all([
          prisma.chessPuzzle.count(),
          prisma.userPuzzleSolve.count({ where: { userId: uid } }),
          prisma.reward.findFirst({ where: { userId: uid, type: "PUZZLE_MASTER" } }),
        ]);
        if (userSolves >= total && !existing) {
          await prisma.reward.create({
            data: {
              userId: uid,
              type: "PUZZLE_MASTER",
              pointsValue: 50,
              description: "Puzzle Master — solved all chess puzzles",
            },
          });
          await prisma.user.update({ where: { id: uid }, data: { points: { increment: 50 } } });
          return NextResponse.json({ status: "solved", badge: "PUZZLE_MASTER" });
        }
      } catch { /* already solved */ }
    }
    return NextResponse.json({ status: "solved" });
  }

  // Count user moves: even indices (0,2,4...) are user moves
  const userMoveCount = Math.ceil(moves.length / 2);
  if (userMoveCount >= movesCount) {
    return NextResponse.json({ status: "failed" });
  }

  // Bot responds defensively
  const botMove = getBotMove(stateAfterUser, "hard");
  if (!botMove) return NextResponse.json({ status: "failed" });

  const botUCI = moveToUCI(botMove);
  const botFen = toFEN(applyMove(stateAfterUser, botMove));

  return NextResponse.json({ status: "continue", botMove: botUCI, newFen: botFen });
}
