"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function toggleLike(videoId: string, type: "LIKE" | "DISLIKE") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { authorId: true },
  });
  if (!video) return { error: "Not found" };
  if (video.authorId === session.user.id) return { error: "Cannot react to your own video" };

  const existing = await prisma.like.findUnique({
    where: { userId_videoId: { userId: session.user.id, videoId } },
  });

  if (existing) {
    if (existing.type === type) {
      // Same type — remove (toggle off)
      await prisma.like.delete({ where: { id: existing.id } });
      return { action: "removed", type };
    } else {
      // Switch type
      await prisma.like.update({ where: { id: existing.id }, data: { type } });
      return { action: "switched", type };
    }
  }

  await prisma.like.create({ data: { userId: session.user.id, videoId, type } });
  return { action: "added", type };
}
