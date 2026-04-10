"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getVideos(page = 1, limit = 12) {
  const skip = (page - 1) * limit;

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.video.count(),
  ]);

  return { videos, total, pages: Math.ceil(total / limit) };
}

export async function likeVideo(videoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const existing = await prisma.like.findUnique({
    where: { userId_videoId: { userId: session.user.id, videoId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return { liked: false };
  }

  await prisma.like.create({
    data: { userId: session.user.id, videoId },
  });

  // Award points
  await prisma.user.update({
    where: { id: session.user.id },
    data: { points: { increment: 2 } },
  });

  revalidatePath("/feed");
  return { liked: true };
}

export async function addComment(videoId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const comment = await prisma.comment.create({
    data: { content, videoId, authorId: session.user.id },
    include: { author: { select: { name: true, image: true } } },
  });

  // Award first comment reward
  const commentCount = await prisma.comment.count({
    where: { authorId: session.user.id },
  });

  if (commentCount === 1) {
    await prisma.reward.create({
      data: {
        type: "FIRST_COMMENT",
        pointsValue: 10,
        description: "Left your first comment!",
        userId: session.user.id,
      },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 10 } },
    });
  }

  revalidatePath(`/video/${videoId}`);
  return { comment };
}
