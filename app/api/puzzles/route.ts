import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const puzzles = await prisma.chessPuzzle.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      difficulty: true,
      solveCount: true,
      ...(userId ? { solves: { where: { userId }, select: { id: true } } } : {}),
    },
  });

  return NextResponse.json(
    puzzles.map((p: typeof puzzles[number] & { solves?: { id: string }[] }) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      solveCount: p.solveCount,
      solved: userId ? (p.solves?.length ?? 0) > 0 : false,
    }))
  );
}
