import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(100, Number(searchParams.get("limit") ?? "50"));
  const search = searchParams.get("search")?.trim() ?? "";

  // Group UserPuzzleSolve by userId, count solves, join user info
  const rows = await prisma.userPuzzleSolve.groupBy({
    by: ["userId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: search ? undefined : limit,
  });

  if (rows.length === 0) return NextResponse.json([]);

  const userIds = rows.map(r => r.userId);

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, image: true },
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  const result = rows
    .map(r => {
      const u = userMap.get(r.userId);
      if (!u) return null;
      return {
        id:         u.id,
        name:       u.name,
        image:      u.image,
        solveCount: r._count.id,
      };
    })
    .filter(Boolean)
    .slice(0, limit);

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
