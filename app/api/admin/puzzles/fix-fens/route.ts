import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Chess } from "chess.js";
import { difficultyFromThemes } from "@/lib/lichess-puzzle";

export const runtime = "nodejs";
export const maxDuration = 60;

type LichessPuzzleResponse = {
  game: { pgn: string };
  puzzle: {
    id: string;
    initialPly: number;
    rating: number;
    solution: string[];
    themes: string[];
  };
};

async function fetchAndFix(lichessId: string): Promise<{
  fen: string;
  solution: string[];
  themes: string[];
  difficulty: string;
} | null> {
  try {
    const res = await fetch(`https://lichess.org/api/puzzle/${lichessId}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data: LichessPuzzleResponse = await res.json();
    const { game, puzzle } = data;
    if (!game?.pgn || !puzzle?.solution?.length) return null;

    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });

    const replay = new Chess();
    for (let i = 0; i <= puzzle.initialPly && i < history.length; i++) {
      replay.move(history[i]);
    }

    return {
      fen: replay.fen(),
      solution: puzzle.solution,
      themes: puzzle.themes ?? [],
      difficulty: difficultyFromThemes(puzzle.themes ?? []),
    };
  } catch {
    return null;
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const puzzles = await prisma.chessPuzzle.findMany({
    where: { source: "lichess", lichessId: { not: null } },
    select: { id: true, lichessId: true },
  });

  const fixed: string[] = [];
  const failed: string[] = [];

  for (const p of puzzles) {
    if (!p.lichessId) continue;
    const data = await fetchAndFix(p.lichessId);
    if (!data) { failed.push(p.lichessId); continue; }

    await prisma.chessPuzzle.update({
      where: { id: p.id },
      data: {
        fen:        data.fen,
        solution:   JSON.stringify(data.solution),
        themes:     data.themes,
        difficulty: data.difficulty,
      },
    });
    fixed.push(p.lichessId);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  return NextResponse.json({ fixed: fixed.length, failed: failed.length, failedIds: failed });
}
