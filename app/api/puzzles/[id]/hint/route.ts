import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const puzzle = await prisma.chessPuzzle.findUnique({
    where: { id },
    select: { solution: true },
  });

  if (!puzzle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let solution: string[] = [];
  try { solution = JSON.parse(puzzle.solution); } catch { /**/ }

  const first = solution[0];
  if (!first) return NextResponse.json({ error: "No solution" }, { status: 404 });

  // from = first 2 chars (e.g. "e2"), to = next 2 chars (e.g. "e4")
  return NextResponse.json({ from: first.slice(0, 2), to: first.slice(2, 4) });
}
