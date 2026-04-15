import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  try {
    const subs = await prisma.subscription.findMany({
      where: {
        subscriberId: session.user.id,
        status: "ACTIVE",
        NOT: { creatorId: session.user.id },
      },
      select: { creatorId: true },
    });

    if (subs.length === 0) return NextResponse.json([]);

    const creatorIds = subs.map((s) => s.creatorId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    const videos = await prisma.video.findMany({
      where: { authorId: { in: creatorIds }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        title: true,
        isPremium: true,
        duration: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true, tier: true } },
      },
    });

    return NextResponse.json(videos);
  } catch {
    return NextResponse.json([]);
  }
}
