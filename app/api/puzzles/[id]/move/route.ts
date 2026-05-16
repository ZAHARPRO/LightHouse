import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromFEN, toFEN, getLegalMoves, applyMove } from "@/lib/chess";
import { awardBadge, awardPuzzleMilestoneBadges } from "@/lib/awardBadge";
import type { PieceType } from "@/lib/chess";

const FILES = "abcdefgh";

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

function puzzlePoints(rating: number): number {
  return Math.min(25, Math.max(5, Math.round(rating / 100)));
}

async function handleSolve(puzzleId: string, rating: number, userId: string | null) {
  if (!userId) return { points: 0, newBadges: [] as string[] };

  try {
    await prisma.userPuzzleSolve.create({ data: { userId, puzzleId } });
    await prisma.chessPuzzle.update({ where: { id: puzzleId }, data: { solveCount: { increment: 1 } } });

    const pts = puzzlePoints(rating);
    await prisma.user.update({ where: { id: userId }, data: { points: { increment: pts } } });

    const totalSolves = await prisma.userPuzzleSolve.count({ where: { userId } });
    const newBadges = await awardPuzzleMilestoneBadges(prisma, userId, totalSolves);

    // Check PUZZLE_MASTER (solved all puzzles)
    const [totalPuzzles] = await Promise.all([prisma.chessPuzzle.count()]);
    if (totalSolves >= totalPuzzles) {
      const result = await awardBadge(prisma, userId, "PUZZLE_MASTER");
      if (result.awarded) newBadges.push("PUZZLE_MASTER");
    }

    return { points: pts, newBadges };
  } catch {
    // Already solved — still return points = 0 (no double reward)
    return { points: 0, newBadges: [] as string[] };
  }
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

  const session = await auth();
  const userId = session?.user?.id ?? null;

  // ── Replay all previous moves to get current FEN ─────────────────────────
  let fen = puzzle.fen;
  for (let i = 0; i < moves.length - 1; i++) {
    const next = applyUCI(fen, moves[i]);
    if (!next) return NextResponse.json({ status: "invalid" });
    fen = next;
  }

  const userUCI = moves[moves.length - 1];
  const afterUser = applyUCI(fen, userUCI);
  if (!afterUser) return NextResponse.json({ status: "invalid" });

  // ── Solution-based puzzles (all puzzles with stored solution) ────────────
  if (puzzle.solution) {
    const solution: string[] = JSON.parse(puzzle.solution);
    const moveIdx = moves.length - 1; // index of the new user move in full sequence

    // Validate user move matches expected solution move
    if (solution[moveIdx] !== userUCI) {
      return NextResponse.json({ status: "invalid" });
    }

    // Check if solution is fully exhausted (last user move played)
    if (moves.length >= solution.length) {
      const { points, newBadges } = await handleSolve(id, puzzle.rating, userId);
      return NextResponse.json({ status: "solved", points, newBadges });
    }

    // Return next bot move from stored solution
    const botMoveUCI = solution[moves.length];
    const botFen = applyUCI(afterUser, botMoveUCI);
    if (!botFen) return NextResponse.json({ status: "invalid" });

    return NextResponse.json({ status: "continue", botMove: botMoveUCI, newFen: botFen });
  }

  // No stored solution — puzzle data is incomplete
  return NextResponse.json({ status: "invalid" });
}
