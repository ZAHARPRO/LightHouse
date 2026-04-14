"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session;
}

/** Canonical order: smaller id is always user1 */
function sortIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/* ── Get or create a conversation between current user and target ── */
export async function getOrCreateDMConversation(otherUserId: string) {
  const session = await requireUser();
  const me = session.user.id;
  if (me === otherUserId) return { error: "Cannot message yourself" };

  const [user1Id, user2Id] = sortIds(me, otherUserId);

  const conv = await prisma.directConversation.upsert({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    create: { user1Id, user2Id },
    update: {},
    select: { id: true },
  });

  return { id: conv.id };
}

/* ── List all DM conversations for current user ── */
export async function getDMConversations() {
  const session = await requireUser();
  const me = session.user.id;

  const convs = await prisma.directConversation.findMany({
    where: { OR: [{ user1Id: me }, { user2Id: me }] },
    orderBy: { updatedAt: "desc" },
    include: {
      user1: { select: { id: true, name: true, tier: true } },
      user2: { select: { id: true, name: true, tier: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, senderId: true, createdAt: true },
      },
    },
  });

  return convs.map((c) => ({
    id: c.id,
    updatedAt: c.updatedAt,
    other: c.user1Id === me ? c.user2 : c.user1,
    lastMessage: c.messages[0] ?? null,
    lastIsMe: c.messages[0]?.senderId === me,
  }));
}

/* ── Edit a message ── */
export async function editDirectMessage(messageId: string, content: string) {
  const session = await requireUser();
  const me = session.user.id;
  if (!content.trim()) return { error: "Empty message" };

  const msg = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true },
  });
  if (!msg || msg.senderId !== me) return { error: "Not allowed" };

  const updated = await prisma.directMessage.update({
    where: { id: messageId },
    data: { content: content.trim(), isEdited: true },
    include: {
      sender: { select: { id: true, name: true, tier: true } },
      replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
    },
  });
  return { message: updated };
}

/* ── Delete a message (soft) ── */
export async function deleteDirectMessage(messageId: string) {
  const session = await requireUser();
  const me = session.user.id;

  const msg = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, conversation: { select: { user1Id: true, user2Id: true } } },
  });
  if (!msg) return { error: "Not found" };

  // Sender can delete for everyone; other participant can also delete (it shows as deleted for them)
  const isParticipant = msg.conversation.user1Id === me || msg.conversation.user2Id === me;
  if (!isParticipant) return { error: "Not allowed" };

  await prisma.directMessage.update({
    where: { id: messageId },
    data: { isDeleted: true, content: "" },
  });
  return { ok: true };
}

/* ── Pin / unpin a message ── */
export async function pinDirectMessage(messageId: string, pin: boolean) {
  const session = await requireUser();
  const me = session.user.id;

  const msg = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true, conversation: { select: { user1Id: true, user2Id: true } } },
  });
  if (!msg) return { error: "Not found" };

  const isParticipant = msg.conversation.user1Id === me || msg.conversation.user2Id === me;
  if (!isParticipant) return { error: "Not allowed" };

  await prisma.directMessage.update({
    where: { id: messageId },
    data: { isPinned: pin },
  });
  return { ok: true };
}

/* ── Get messages in a conversation ── */
export async function getDMMessages(convId: string) {
  const session = await requireUser();
  const me = session.user.id;

  const conv = await prisma.directConversation.findUnique({
    where: { id: convId },
    select: {
      user1Id: true,
      user2Id: true,
      user1: { select: { id: true, isBanned: true, banReason: true, bannedAt: true } },
      user2: { select: { id: true, isBanned: true, banReason: true, bannedAt: true } },
    },
  });

  if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
    return { error: "Not found" };
  }

  const otherUser = conv.user1Id === me ? conv.user2 : conv.user1;
  const otherId   = otherUser.id;

  const otherBan = otherUser.isBanned
    ? { reason: otherUser.banReason, bannedAt: otherUser.bannedAt }
    : null;

  // Check block status in both directions
  const [blockByMe, blockByThem] = await Promise.all([
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: me, blockedId: otherId } } }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: otherId, blockedId: me } } }),
  ]);

  const messages = await prisma.directMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, username: true, tier: true, image: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });

  return { messages, myId: me, otherBan, isBlockedByMe: !!blockByMe, isBlockedByThem: !!blockByThem };
}

/* ── Block / Unblock a user ── */
export async function blockUser(targetId: string) {
  const session = await requireUser();
  const me = session.user.id;
  if (me === targetId) return { error: "Cannot block yourself" };
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: me, blockedId: targetId } },
    create: { blockerId: me, blockedId: targetId },
    update: {},
  });
  return { ok: true };
}

export async function unblockUser(targetId: string) {
  const session = await requireUser();
  const me = session.user.id;
  await prisma.block.deleteMany({
    where: { blockerId: me, blockedId: targetId },
  });
  return { ok: true };
}

/* ── Send a message ── */
export async function sendDirectMessage(
  convId: string,
  content: string,
  replyToId?: string,
) {
  const session = await requireUser();
  const me = session.user.id;
  if (!content.trim()) return { error: "Empty message" };

  const conv = await prisma.directConversation.findUnique({
    where: { id: convId },
    select: { user1Id: true, user2Id: true },
  });
  if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
    return { error: "Not found" };
  }

  const otherId = conv.user1Id === me ? conv.user2Id : conv.user1Id;
  const blocked = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: otherId, blockedId: me } },
  });
  if (blocked) return { error: "You can't send messages to this user." };

  const [msg] = await prisma.$transaction([
    prisma.directMessage.create({
      data: {
        content: content.trim(),
        senderId: me,
        conversationId: convId,
        replyToId: replyToId ?? null,
      },
      include: {
        sender: { select: { id: true, name: true, tier: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.directConversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return { message: msg };
}
