"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function toggleStreamReaction(
  streamId: string,
  type: "LIKE" | "DISLIKE",
): Promise<{ likes: number; dislikes: number; userReaction: "LIKE" | "DISLIKE" | null } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const userId = session.user.id;

  const existing = await prisma.streamReaction.findUnique({
    where: { userId_streamId: { userId, streamId } },
  });

  if (existing?.type === type) {
    await prisma.streamReaction.delete({ where: { userId_streamId: { userId, streamId } } });
  } else if (existing) {
    await prisma.streamReaction.update({
      where: { userId_streamId: { userId, streamId } },
      data: { type },
    });
  } else {
    await prisma.streamReaction.create({ data: { userId, streamId, type } });
  }

  const [likes, dislikes, updated] = await Promise.all([
    prisma.streamReaction.count({ where: { streamId, type: "LIKE" } }),
    prisma.streamReaction.count({ where: { streamId, type: "DISLIKE" } }),
    prisma.streamReaction.findUnique({ where: { userId_streamId: { userId, streamId } } }),
  ]);

  return { likes, dislikes, userReaction: (updated?.type ?? null) as "LIKE" | "DISLIKE" | null };
}
