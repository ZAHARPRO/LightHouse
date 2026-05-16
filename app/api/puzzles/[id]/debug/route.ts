import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Chess } from "chess.js";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id } });
  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let solution: string[] = [];
  try { solution = puzzle.solution ? JSON.parse(puzzle.solution) : []; } catch { /* */ }

  // Check what color is to move from the stored FEN
  let fenTurn = "?";
  try { fenTurn = new Chess(puzzle.fen).turn(); } catch { /* */ }

  // Check what square solution[0] moves FROM — which color piece is there
  let move0Color = "?";
  let move0From = solution[0]?.slice(0, 2) ?? "?";
  try {
    if (solution[0]) {
      const ch = new Chess(puzzle.fen);
      const from = solution[0].slice(0, 2);
      const piece = ch.get(from as Parameters<typeof ch.get>[0]);
      move0Color = piece?.color ?? "empty";
    }
  } catch { /* */ }

  return NextResponse.json({
    id: puzzle.id,
    lichessId: puzzle.lichessId,
    difficulty: puzzle.difficulty,
    fen: puzzle.fen,
    fenTurn,
    solutionLength: solution.length,
    move0: solution[0] ?? null,
    move0From,
    move0Color,
    move1: solution[1] ?? null,
    move2: solution[2] ?? null,
  });
}
