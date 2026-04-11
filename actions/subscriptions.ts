"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PlanType } from "@/lib/plans";

export type { PlanType };

export async function subscribeToPlan(plan: PlanType) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  // Upsert platform subscription
  await prisma.subscription.upsert({
    where: {
      subscriberId_creatorId: {
        subscriberId: session.user.id,
        creatorId: session.user.id, // Self-sub = platform plan
      },
    },
    update: { plan, status: "ACTIVE", expiresAt },
    create: {
      plan,
      status: "ACTIVE",
      expiresAt,
      subscriberId: session.user.id,
      creatorId: session.user.id,
    },
  });

  const tierMap: Record<PlanType, "BASIC" | "PRO" | "ELITE"> = {
    BASIC: "BASIC",
    PRO: "PRO",
    ELITE: "ELITE",
  };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tier: tierMap[plan] },
  });

  // Award PREMIUM_MEMBER reward on first upgrade
  const existing = await prisma.reward.findFirst({
    where: { userId: session.user.id, type: "PREMIUM_MEMBER" },
  });

  if (!existing) {
    await prisma.reward.create({
      data: {
        type: "PREMIUM_MEMBER",
        pointsValue: 100,
        description: "Became a premium member",
        userId: session.user.id,
      },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 100 } },
    });
  }

  revalidatePath("/subscriptions");
  return { success: true };
}

// ── Creator follow / unfollow ────────────────────────────────────────────────

export async function followCreator(creatorId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (session.user.id === creatorId) return { error: "Cannot subscribe to yourself" };

  const existing = await prisma.subscription.findUnique({
    where: { subscriberId_creatorId: { subscriberId: session.user.id, creatorId } },
  });
  if (existing) return { error: "Already subscribed" };

  await prisma.subscription.create({
    data: { subscriberId: session.user.id, creatorId, plan: "BASIC", status: "ACTIVE" },
  });

  revalidatePath(`/profile/${creatorId}`);
  return { success: true };
}

export async function unfollowCreator(creatorId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (session.user.id === creatorId) return { error: "Cannot unsubscribe from yourself" };

  await prisma.subscription.deleteMany({
    where: { subscriberId: session.user.id, creatorId },
  });

  revalidatePath(`/profile/${creatorId}`);
  return { success: true };
}

export async function getFollowStatus(creatorId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const sub = await prisma.subscription.findUnique({
    where: { subscriberId_creatorId: { subscriberId: session.user.id, creatorId } },
  });
  return !!sub;
}

export async function getUserSubscription() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.subscription.findUnique({
    where: {
      subscriberId_creatorId: {
        subscriberId: session.user.id,
        creatorId: session.user.id,
      },
    },
  });
}
