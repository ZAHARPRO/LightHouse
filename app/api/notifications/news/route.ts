import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const posts = await prisma.newsPost.findMany({
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
