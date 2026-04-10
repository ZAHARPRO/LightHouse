"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type PlanType = "BASIC" | "PRO" | "ELITE";

export const PLANS = {
  BASIC: {
    name: "Basic",
    price: 4.99,
    features: [
      "HD video quality",
      "5 creator subscriptions",
      "Standard chat access",
      "10 reward points / month",
    ],
  },
  PRO: {
    name: "Pro",
    price: 12.99,
    features: [
      "4K video quality",
      "Unlimited subscriptions",
      "Priority chat badge",
      "50 reward points / month",
      "Early access to content",
      "Download videos",
    ],
  },
  ELITE: {
    name: "Elite",
    price: 24.99,
    features: [
      "Everything in Pro",
      "Exclusive Elite badge",
      "150 reward points / month",
      "Direct creator messaging",
      "Monthly merchandise discount",
      "Ad-free experience",
    ],
  },
};

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
