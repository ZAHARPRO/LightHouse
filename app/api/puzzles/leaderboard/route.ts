import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(100, Number(searchParams.get("limit") ?? "50"));
  const search = searchParams.get("search")?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    select: {
      id: true,
      name: true,
      image: true,
      puzzleRating: true,
      _count: { select: { puzzleSolves: true } },
    },
    orderBy: { puzzleRating: "desc" },
    take: search ? undefined : limit,
  });

  const result = users
    .filter(u => u._count.puzzleSolves > 0 || u.puzzleRating !== 1000)
    .slice(0, limit)
    .map(u => ({
      id:           u.id,
      name:         u.name,
      image:        u.image,
      puzzleRating: u.puzzleRating,
      solveCount:   u._count.puzzleSolves,
    }));

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
