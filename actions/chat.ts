"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getChatMessages(limit = 50, since?: string) {
  return prisma.chatMessage.findMany({
    take: limit,
    where: since ? { createdAt: { gt: new Date(since) } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true, tier: true, lastActiveAt: true } },
    },
  });
}

export async function sendChatMessage(content: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  if (!content.trim() || content.length > 500) {
    return { error: "Message must be 1-500 characters" };
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isBanned: true } });
  if (me?.isBanned) return { error: "Your account has been suspended." };

  const message = await prisma.chatMessage.create({
    data: { content: content.trim(), authorId: session.user.id },
    include: {
      author: { select: { id: true, name: true, image: true, tier: true, lastActiveAt: true } },
    },
  });

  // Award points for chatting (once per 10 messages)
  const msgCount = await prisma.chatMessage.count({
    where: { authorId: session.user.id },
  });
  if (msgCount % 10 === 0) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 5 } },
    });
  }

  revalidatePath("/chat");
  return { message };
}
