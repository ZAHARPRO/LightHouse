import { PrismaClient } from "@prisma/client";
import { BADGE_DEFS, BadgeDef } from "./badges";

export async function awardBadge(
  prisma: PrismaClient,
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

const CHESS_ELO_BADGES: [number, string][] = [
  [700,  "CHESS_SILVER"],
  [1300, "CHESS_GOLD"],
  [2200, "CHESS_PLATINUM"],
  [3400, "CHESS_DIAMOND"],
];

const MINE_ELO_BADGES: [number, string][] = [
  [700,  "MINE_SILVER"],
  [1300, "MINE_GOLD"],
  [2200, "MINE_PLATINUM"],
  [3400, "MINE_DIAMOND"],
];

export async function awardChessEloBadges(prisma: PrismaClient, userId: string, newElo: number) {
  for (const [threshold, type] of CHESS_ELO_BADGES) {
    if (newElo >= threshold) await awardBadge(prisma, userId, type);
  }
}

export async function awardMineEloBadges(prisma: PrismaClient, userId: string, newElo: number) {
  for (const [threshold, type] of MINE_ELO_BADGES) {
    if (newElo >= threshold) await awardBadge(prisma, userId, type);
  }
}
