import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(parseInt(since, 10)) : new Date(0);

  try {
    const rewards = await prisma.reward.findMany({
      where: {
        userId: session.user.id,
        earnedAt: { gt: sinceDate },
      },
      orderBy: { earnedAt: "asc" },
      select: { id: true, type: true, pointsValue: true, description: true, earnedAt: true },
    });
    return NextResponse.json(rewards);
  } catch {
    return NextResponse.json([]);
  }
}
