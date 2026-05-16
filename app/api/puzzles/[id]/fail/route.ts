import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { puzzleEloDelta } from "@/lib/elo";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ ok: false });

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id }, select: { rating: true } });
  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only penalize if user hasn't already solved this puzzle
  const alreadySolved = await prisma.userPuzzleSolve.findFirst({ where: { userId, puzzleId: id } });
  if (alreadySolved) return NextResponse.json({ ok: false, reason: "already_solved" });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { puzzleRating: true } });
  if (!user) return NextResponse.json({ ok: false });

  const delta = puzzleEloDelta(user.puzzleRating, puzzle.rating, false);
  const newRating = Math.max(400, user.puzzleRating + delta);
  await prisma.user.update({ where: { id: userId }, data: { puzzleRating: newRating } });

  return NextResponse.json({ ok: true, ratingDelta: delta, newRating });
}
