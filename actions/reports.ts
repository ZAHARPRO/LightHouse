"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ── Report a user ── */
export async function reportUser(
  targetId: string,
  reason: string,
  opts?: { game?: string; roomId?: string },
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (session.user.id === targetId) return { error: "Cannot report yourself" };
  if (!reason.trim()) return { error: "Reason required" };

  try {
    await prisma.report.upsert({
      where: { reporterId_targetId: { reporterId: session.user.id, targetId } },
      create: {
        reporterId: session.user.id,
        targetId,
        reason: reason.trim(),
        game: opts?.game ?? null,
        roomId: opts?.roomId ?? null,
      },
      update: {
        reason: reason.trim(),
        game: opts?.game ?? null,
        roomId: opts?.roomId ?? null,
        createdAt: new Date(),
      },
    });
    return { ok: true };
  } catch {
    return { error: "Failed to submit report" };
  }
}

/* ── Submit a ban appeal (bypasses ban check intentionally) ── */
export async function submitAppeal(message: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!message.trim()) return { error: "Message required" };

  // Check user is actually banned
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isBanned: true },
  });
  if (!user?.isBanned) return { error: "Account is not suspended" };

  // Find existing open appeal, or create new one
  const existing = await prisma.supportConversation.findFirst({
    where: { userId: session.user.id, isAppeal: true, status: "OPEN" },
  });

  const conv = existing ?? await prisma.supportConversation.create({
    data: { userId: session.user.id, isAppeal: true },
  });

  await prisma.supportMessage.create({
    data: {
      content: message.trim(),
      isFromStaff: false,
      conversationId: conv.id,
      senderId: session.user.id,
    },
  });

  return { ok: true };
}
