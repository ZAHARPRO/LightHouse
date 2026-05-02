import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromFEN } from "@/lib/chess";
import { getBotMove } from "@/lib/chess-bot";

const FILES = "abcdefgh";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { hintPoints: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.hintPoints <= 0)
    return NextResponse.json({ error: "no_points" }, { status: 402 });

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id } });
  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // currentFen from query param — if not provided use puzzle start
  const url = new URL(req.url);
  const currentFen = url.searchParams.get("fen") ?? puzzle.fen;

  let from = "";
  let to = "";

  try {
    const state = fromFEN(currentFen);
    const move = getBotMove(state, "hard");
    if (move) {
      from = `${FILES[move.from[1]]}${8 - move.from[0]}`;
      to   = `${FILES[move.to[1]]}${8 - move.to[0]}`;
    }
  } catch {
    return NextResponse.json({ error: "Engine error" }, { status: 500 });
  }

  if (!from) return NextResponse.json({ error: "No move found" }, { status: 500 });

  // Deduct 1 point
  const updated = await prisma.user.update({
    where: { id: uid },
    data: { hintPoints: { decrement: 1 } },
    select: { hintPoints: true },
  });

  return NextResponse.json({ from, to, remainingPoints: updated.hintPoints });
}
