import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const since = parseInt(searchParams.get("since") ?? "0", 10);
    const sinceDate = new Date(since || 0);

    const posts = await prisma.newsPost.findMany({
      where: since ? { createdAt: { gt: sinceDate } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: { select: { name: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });
    return NextResponse.json(posts);
  } catch {
    return NextResponse.json([]);
  }
}
