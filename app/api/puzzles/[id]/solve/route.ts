import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromFEN, toFEN, getLegalMoves, applyMove } from "@/lib/chess";
import type { PieceType } from "@/lib/chess";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { move, step } = (await req.json()) as { move: string; step: number };

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id } });
  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const solution: string[] = JSON.parse(puzzle.solution);

  if (solution[step] !== move) {
    return NextResponse.json({ correct: false });
  }

  // Apply all moves from puzzle start up to and including the player's move
  let fen = puzzle.fen;
  for (let i = 0; i <= step; i++) {
    const next = applyUCI(fen, solution[i]);
    if (!next) return NextResponse.json({ error: "Bad solution data" }, { status: 500 });
    fen = next;
  }

  const isSolved = step === solution.length - 1;
  const hasOpponentResponse = !isSolved && step + 1 < solution.length;

  let responseFen: string | undefined;
  if (hasOpponentResponse) {
    responseFen = applyUCI(fen, solution[step + 1]) ?? undefined;
  }

  if (isSolved) {
    const session = await auth();
    if (session?.user?.id) {
      try {
        await prisma.userPuzzleSolve.create({
          data: { userId: session.user.id, puzzleId: id },
        });
        await prisma.chessPuzzle.update({
          where: { id },
          data: { solveCount: { increment: 1 } },
        });
      } catch {
        // already solved — ignore unique constraint error
      }
    }
  }

  return NextResponse.json({
    correct: true,
    solved: isSolved,
    response: hasOpponentResponse ? solution[step + 1] : undefined,
    responseFen,
    nextStep: step + 2,
  });
}
