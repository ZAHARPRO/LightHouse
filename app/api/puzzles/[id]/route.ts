import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const puzzle = await prisma.chessPuzzle.findUnique({
    where: { id },
    select: {
      id: true, title: true, difficulty: true, fen: true, solveCount: true,
      solves: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });

  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: puzzle.id,
    title: puzzle.title,
    difficulty: puzzle.difficulty,
    fen: puzzle.fen,
    solveCount: puzzle.solveCount,
    alreadySolved: userId ? ((puzzle as typeof puzzle & { solves?: { id: string }[] }).solves?.length ?? 0) > 0 : false,
  });
}
