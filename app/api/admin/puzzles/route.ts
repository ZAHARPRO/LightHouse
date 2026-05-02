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
      id: true, title: true, difficulty: true, rating: true, solveCount: true, createdAt: true, fen: true, solution: true,
    },
  });

  return NextResponse.json(puzzles);
}

export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, fen, solution, difficulty, rating } = await req.json() as {
    title: string; fen: string; solution?: string[]; difficulty: string; rating?: number;
  };

  if (!title?.trim() || !fen?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const puzzle = await prisma.chessPuzzle.create({
      data: {
        title: title.trim(),
        fen: fen.trim(),
        solution: solution?.length ? JSON.stringify(solution) : null,
        difficulty,
        rating: typeof rating === "number" ? Math.max(800, Math.min(2200, rating)) : 1200,
      },
    });
    return NextResponse.json(puzzle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[puzzle create error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, fen, solution, difficulty, rating } = await req.json() as {
    id: string; title: string; fen: string; solution?: string[]; difficulty: string; rating?: number;
  };

  if (!id || !title?.trim() || !fen?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const puzzle = await prisma.chessPuzzle.update({
      where: { id },
      data: {
        title: title.trim(),
        fen: fen.trim(),
        solution: solution?.length ? JSON.stringify(solution) : null,
        difficulty,
        rating: typeof rating === "number" ? Math.max(800, Math.min(2200, rating)) : 1200,
      },
    });
    return NextResponse.json(puzzle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { id?: string; ids?: string[] };
  if (body.ids?.length) {
    await prisma.chessPuzzle.deleteMany({ where: { id: { in: body.ids } } });
  } else if (body.id) {
    await prisma.chessPuzzle.delete({ where: { id: body.id } });
  } else {
    return NextResponse.json({ error: "Missing id or ids" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
