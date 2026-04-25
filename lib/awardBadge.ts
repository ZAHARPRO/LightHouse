import { PrismaClient } from "@prisma/client";
import { BADGE_DEFS, BadgeDef } from "./badges";

type PrismaLike = Pick<PrismaClient, "reward" | "user">;

export async function awardBadge(
  prisma: PrismaLike,
  userId: string,
  type: string,
): Promise<{ awarded: boolean; badge?: BadgeDef }> {
  const def = BADGE_DEFS[type];
  if (!def) return { awarded: false };

  const existing = await prisma.reward.findFirst({
    where: { userId, type: type as never },
    select: { id: true },
  });
  if (existing) return { awarded: false };

  await prisma.$transaction([
    prisma.reward.create({
      data: { userId, type: type as never, pointsValue: def.points, description: def.description },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { points: { increment: def.points } },
    }),
  ]);

  return { awarded: true, badge: def };
}
