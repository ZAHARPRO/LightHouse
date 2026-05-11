import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const POINTS: Record<string, number> = { PRO: 50, ELITE: 150 };
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tier: true, lastMonthlyPointsClaim: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const points = POINTS[user.tier];
  if (!points) return NextResponse.json({ error: "No monthly reward for your plan" }, { status: 403 });

  if (user.lastMonthlyPointsClaim) {
    const elapsed = Date.now() - user.lastMonthlyPointsClaim.getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextClaimAt = new Date(user.lastMonthlyPointsClaim.getTime() + COOLDOWN_MS);
      return NextResponse.json({ error: "Already claimed", nextClaimAt }, { status: 429 });
    }
  }

  await prisma.$transaction([
    prisma.reward.create({
      data: {
        type: "MONTHLY_REWARD",
        pointsValue: points,
        description: `Monthly ${user.tier} reward`,
        userId: session.user.id,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        points: { increment: points },
        lastMonthlyPointsClaim: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, points });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tier: true, lastMonthlyPointsClaim: true, points: true },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const points = POINTS[user.tier] ?? 0;
  const canClaim = points > 0 && (
    !user.lastMonthlyPointsClaim ||
    Date.now() - user.lastMonthlyPointsClaim.getTime() >= COOLDOWN_MS
  );
  const nextClaimAt = user.lastMonthlyPointsClaim
    ? new Date(user.lastMonthlyPointsClaim.getTime() + COOLDOWN_MS)
    : null;

  return NextResponse.json({ tier: user.tier, points: user.points, monthlyPoints: points, canClaim, nextClaimAt });
}
