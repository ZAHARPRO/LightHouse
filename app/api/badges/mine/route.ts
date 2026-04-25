import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  const rewards = await prisma.reward.findMany({
    where: { userId: session.user.id },
    select: { type: true, customBadgeId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rewards, {
    headers: { "Cache-Control": "no-store" },
  });
}
