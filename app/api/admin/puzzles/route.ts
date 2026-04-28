import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const puzzles = await prisma.chessPuzzle.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, difficulty: true, solveCount: true, createdAt: true, fen: true, solution: true,
    },
  });

  return NextResponse.json(puzzles);
}

export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, fen, solution, difficulty } = await req.json() as {
    title: string; fen: string; solution: string[]; difficulty: string;
  };

  if (!title?.trim() || !fen?.trim() || !solution?.length)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const puzzle = await prisma.chessPuzzle.create({
    data: {
      title: title.trim(),
      fen: fen.trim(),
      solution: JSON.stringify(solution),
      difficulty,
    },
  });

  return NextResponse.json(puzzle);
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  await prisma.chessPuzzle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
