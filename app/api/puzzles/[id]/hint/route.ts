import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const url = new URL(req.url);
  // moveIndex = number of moves already played (user + bot interleaved)
  // next player move is at solution[moveIndex]
  const moveIndex = parseInt(url.searchParams.get("moveIndex") ?? "0");

  let from = "";
  let to = "";

  if (puzzle.solution) {
    const solution: string[] = JSON.parse(puzzle.solution);
    const nextUCI = solution[moveIndex];
    if (nextUCI && nextUCI.length >= 4) {
      from = nextUCI.slice(0, 2);
      to   = nextUCI.slice(2, 4);
    }
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
