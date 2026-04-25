"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BADGE_DEFS } from "@/lib/badges";

export async function awardGameBadge(type: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const def = BADGE_DEFS[type];
  if (!def) return { error: "Unknown badge" };

  const existing = await prisma.reward.findFirst({
    where: { userId: session.user.id, type: type as never },
  });
  if (existing) return { alreadyHas: true };

  await prisma.$transaction([
    prisma.reward.create({
      data: {
        userId: session.user.id,
        type: type as never,
        pointsValue: def.points,
        description: def.description,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: def.points } },
    }),
  ]);

  return { ok: true, badge: def };
}
