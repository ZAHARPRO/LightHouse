"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (session.user.role !== "ADMIN") throw new Error("Not allowed");
  return session;
}

/* ── Dashboard stats ── */
export async function getAdminStats() {
  await requireAdmin();
  const [users, videos, posts, openTickets, rewards] = await Promise.all([
    prisma.user.count(),
    prisma.video.count(),
    prisma.post.count(),
    prisma.supportConversation.count({ where: { status: "OPEN" } }),
    prisma.reward.count(),
  ]);
  return { users, videos, posts, openTickets, rewards };
}

/* ── User list ── */
export async function getAdminUsers(search = "") {
  await requireAdmin();
  return prisma.user.findMany({
    where: search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ] }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, tier: true, role: true,
      points: true, createdAt: true,
      _count: { select: { videos: true, rewards: true } },
    },
    take: 100,
  });
}

/* ── Change user role ── */
export async function changeUserRole(userId: string, role: string) {
  await requireAdmin();
  const allowed = ["USER", "STAFF", "OPERATOR", "ADMIN"];
  if (!allowed.includes(role)) return { error: "Invalid role" };
  await prisma.user.update({ where: { id: userId }, data: { role: role as never } });
  revalidatePath("/admin/users");
  return { ok: true };
}

/* ── Change user tier ── */
export async function changeUserTier(userId: string, tier: string) {
  await requireAdmin();
  const allowed = ["FREE", "BASIC", "PRO", "ELITE"];
  if (!allowed.includes(tier)) return { error: "Invalid tier" };
  await prisma.user.update({ where: { id: userId }, data: { tier: tier as never } });
  revalidatePath("/admin/users");
  return { ok: true };
}

/* ── Delete user ── */
export async function deleteUser(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) return { error: "Cannot delete yourself" };
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}

/* ── Create custom badge ── */
export async function createCustomBadge(data: {
  icon: string; label: string; color: string; points: number; description: string;
}) {
  const session = await requireAdmin();
  if (!data.icon || !data.label || !data.description) return { error: "All fields required" };
  const badge = await prisma.customBadge.create({
    data: { ...data, creatorId: session.user.id },
  });
  revalidatePath("/admin/badges");
  return { badge };
}

/* ── List custom badges ── */
export async function getCustomBadges() {
  await requireAdmin();
  return prisma.customBadge.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { name: true } },
      _count: { select: { rewards: true } },
    },
  });
}

/* ── Delete custom badge ── */
export async function deleteCustomBadge(badgeId: string) {
  await requireAdmin();
  await prisma.customBadge.delete({ where: { id: badgeId } });
  revalidatePath("/admin/badges");
  return { ok: true };
}

/* ── Award badge to user ── */
export async function awardBadgeToUser(data: {
  userId: string;
  badgeType: "builtin" | "custom";
  builtinType?: string;
  customBadgeId?: string;
  adminNote?: string;
}) {
  const session = await requireAdmin();

  if (data.badgeType === "builtin" && data.builtinType) {
    // Check not already awarded
    const existing = await prisma.reward.findFirst({
      where: { userId: data.userId, type: data.builtinType as never, isManual: false },
    });
    // Allow manual re-award even if exists
    await prisma.reward.create({
      data: {
        userId: data.userId,
        type: data.builtinType as never,
        pointsValue: 0,
        description: `Manually awarded by admin`,
        isManual: true,
        adminNote: data.adminNote ?? null,
        awardedById: session.user.id,
      },
    });
    void existing; // suppress unused warning
  } else if (data.badgeType === "custom" && data.customBadgeId) {
    const badge = await prisma.customBadge.findUnique({ where: { id: data.customBadgeId } });
    if (!badge) return { error: "Badge not found" };

    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: data.userId,
          type: "CUSTOM",
          pointsValue: badge.points,
          description: badge.description,
          isManual: true,
          adminNote: data.adminNote ?? null,
          awardedById: session.user.id,
          customBadgeId: badge.id,
        },
      }),
      prisma.user.update({
        where: { id: data.userId },
        data: { points: { increment: badge.points } },
      }),
    ]);
  }

  revalidatePath("/admin/badges");
  return { ok: true };
}

/* ── Reported users list ── */
export async function getReportedUsers() {
  await requireAdmin();
  const reports = await prisma.report.groupBy({
    by: ["targetId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  if (reports.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: reports.map((r: { targetId: string; _count: { id: number } }) => r.targetId) } },
    select: { id: true, name: true, email: true, role: true, isBanned: true, banReason: true, bannedAt: true },
  });

  const countMap = new Map(
    reports.map((r: { targetId: string; _count: { id: number } }) => [r.targetId, r._count.id])
  );
  return users
    .map((u) => ({ ...u, reportCount: countMap.get(u.id) ?? 0 }))
    .sort((a, b) => (b.reportCount as number) - (a.reportCount as number));
}

/* ── Ban a user ── */
export async function banUser(userId: string, reason: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) return { error: "Cannot ban yourself" };
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true, banReason: reason.trim() || "Violated community guidelines", bannedAt: new Date() },
  });
  revalidatePath("/admin/reports");
  return { ok: true };
}

/* ── Unban a user ── */
export async function unbanUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false, banReason: null, bannedAt: null },
  });
  revalidatePath("/admin/reports");
  return { ok: true };
}

/* ── Dismiss all reports for a user ── */
export async function dismissReports(targetId: string) {
  await requireAdmin();
  await prisma.report.deleteMany({ where: { targetId } });
  revalidatePath("/admin/reports");
  return { ok: true };
}

/* ── Staff members list ── */
export async function getStaffMembers() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: { not: "USER" } },
    select: {
      id: true, name: true, email: true, role: true,
      lastActiveAt: true, activity: true,
    },
    orderBy: [
      { lastActiveAt: { sort: "desc", nulls: "last" } },
    ],
  });
}

/* ── Search users (for award picker) ── */
export async function searchUsers(query: string) {
  await requireAdmin();
  return prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });
}
