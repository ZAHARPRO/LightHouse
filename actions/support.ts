"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const STAFF_ROLES = ["ADMIN", "OPERATOR", "STAFF"];

/* ── User: get or create their open conversation ── */
async function getOrCreateConversation(userId: string) {
  const existing = await prisma.supportConversation.findFirst({
    where: { userId, status: "OPEN" },
  });
  if (existing) return existing;
  return prisma.supportConversation.create({ data: { userId } });
}

/* ── User: send a message to support ── */
export async function sendSupportMessage(content: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!content.trim()) return { error: "Empty message" };

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isBanned: true } });
  if (me?.isBanned) return { error: "Your account has been suspended. Use the appeal form on your profile." };

  const conv = await getOrCreateConversation(session.user.id);
  const msg = await prisma.supportMessage.create({
    data: {
      content: content.trim(),
      isFromStaff: false,
      conversationId: conv.id,
      senderId: session.user.id,
    },
    include: { sender: { select: { id: true, name: true } } },
  });
  return { message: msg };
}

/* ── User: get their own conversation + messages ── */
export async function getUserConversation() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const conv = await prisma.supportConversation.findFirst({
    where: { userId: session.user.id, status: "OPEN" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });
  return conv;
}

/* ── Staff: get all open conversations ── */
export async function getOperatorInbox() {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (!STAFF_ROLES.includes(session.user.role)) return [];

  return prisma.supportConversation.findMany({
    where: { status: "OPEN" },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });
}

/* ── Staff: get full conversation by id ── */
export async function getConversationById(convId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!STAFF_ROLES.includes(session.user.role)) return null;

  return prisma.supportConversation.findUnique({
    where: { id: convId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });
}

/* ── Staff: reply to a conversation ── */
export async function staffReply(convId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!STAFF_ROLES.includes(session.user.role)) return { error: "Not allowed" };
  if (!content.trim()) return { error: "Empty message" };

  const msg = await prisma.supportMessage.create({
    data: {
      content: content.trim(),
      isFromStaff: true,
      conversationId: convId,
      senderId: session.user.id,
    },
    include: { sender: { select: { id: true, name: true } } },
  });

  await prisma.supportConversation.update({
    where: { id: convId },
    data: { updatedAt: new Date() },
  });

  return { message: msg };
}

/* ── Staff: get all conversations for a specific user ── */
export async function getUserTickets(userId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (!STAFF_ROLES.includes(session.user.role)) return [];

  return prisma.supportConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });
}

/* ── Staff: update their own lastActiveAt (presence ping) ── */
export async function pingStaffPresence(activity?: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  if (!STAFF_ROLES.includes(session.user.role)) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      lastActiveAt: new Date(),
      ...(activity !== undefined && { activity }),
    },
  });
}

/* ── Staff: close a conversation ── */
export async function closeConversation(convId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!STAFF_ROLES.includes(session.user.role)) return { error: "Not allowed" };

  await prisma.supportConversation.update({
    where: { id: convId },
    data: { status: "CLOSED" },
  });
  return { ok: true };
}
