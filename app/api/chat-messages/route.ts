import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");

  const messages = await prisma.chatMessage.findMany({
    take: Math.min(limit, 100),
    where: since ? { createdAt: { gt: new Date(since) } } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: { id: true, name: true, image: true, tier: true, lastActiveAt: true },
      },
    },
  });

  return NextResponse.json(messages, {
    headers: { "Cache-Control": "no-store" },
  });
}
