import { prisma } from "./prisma";

type RewardType =
  | "WATCH_STREAK"
  | "FIRST_COMMENT"
  | "SUPER_FAN"
  | "EARLY_ADOPTER"
  | "PREMIUM_MEMBER";

const BADGE_META: Record<RewardType, { pointsValue: number; description: string }> = {
  WATCH_STREAK:   { pointsValue: 50,  description: "Watched videos 7 days in a row!" },
  FIRST_COMMENT:  { pointsValue: 10,  description: "Left your first comment!" },
  SUPER_FAN:      { pointsValue: 100, description: "Liked 50 videos — you're a Super Fan!" },
  EARLY_ADOPTER:  { pointsValue: 200, description: "Joined LightHouse early" },
  PREMIUM_MEMBER: { pointsValue: 150, description: "Became a premium member" },
};

/**
 * Awards a badge to a user if they don't already have it.
 * Returns the new reward record, or null if already awarded.
 */
export async function awardBadge(
  userId: string,
  type: RewardType,
): Promise<{ id: string; type: string; pointsValue: number; description: string; earnedAt: Date } | null> {
  const already = await prisma.reward.findFirst({ where: { userId, type } });
  if (already) return null;

  const meta = BADGE_META[type];

  const [reward] = await prisma.$transaction([
    prisma.reward.create({
      data: { type, pointsValue: meta.pointsValue, description: meta.description, userId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { points: { increment: meta.pointsValue } },
    }),
  ]);

  return reward;
}

/**
 * Updates the daily watch streak for a user and awards WATCH_STREAK badge
 * when the streak reaches 7 consecutive days.
 * Returns the awarded badge or null.
 */
export async function updateWatchStreak(
  userId: string,
): Promise<{ id: string; type: string; pointsValue: number; description: string; earnedAt: Date } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { watchStreak: true, lastWatchedDate: true },
  });
  if (!user) return null;

  // Compare dates at day granularity (UTC)
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastStr  = user.lastWatchedDate
    ? new Date(user.lastWatchedDate).toISOString().slice(0, 10)
    : null;

  // Already recorded a view today — nothing to update
  if (lastStr === todayStr) return null;

  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const isConsecutive = lastStr === yesterdayStr;

  const newStreak = isConsecutive ? user.watchStreak + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: {
      watchStreak:     newStreak,
      lastWatchedDate: new Date(),
    },
  });

  // Award badge at 7-day streak (only once)
  if (newStreak >= 7) {
    return awardBadge(userId, "WATCH_STREAK");
  }

  return null;
}
