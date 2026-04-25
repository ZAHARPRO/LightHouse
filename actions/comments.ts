"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";


export async function addComment(
  videoId: string,
  content: string,
  parentId?: string,
  replyToName?: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!content.trim()) return { error: "Content required" };

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isBanned: true } });
  if (me?.isBanned) return { error: "Your account has been suspended." };

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      videoId,
      authorId: session.user.id,
      parentId: parentId ?? null,
      replyToName: replyToName ?? null,
    },
    include: { author: { select: { id: true, name: true } } },
  });


  revalidatePath(`/watch/${videoId}`);
  return { comment };
}

export async function toggleCommentLike(commentId: string, videoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId: session.user.id, commentId } },
  });

  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    return { liked: false };
  }

  await prisma.commentLike.create({
    data: { userId: session.user.id, commentId },
  });

  revalidatePath(`/watch/${videoId}`);
  return { liked: true };
}

export async function togglePinComment(commentId: string, videoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (video?.authorId !== session.user.id) return { error: "Not allowed" };

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { isPinned: true } });
  if (!comment) return { error: "Not found" };

  if (comment.isPinned) {
    await prisma.comment.update({ where: { id: commentId }, data: { isPinned: false } });
    return { pinned: false };
  }

  // Unpin all, then pin this one
  await prisma.$transaction([
    prisma.comment.updateMany({ where: { videoId, isPinned: true }, data: { isPinned: false } }),
    prisma.comment.update({ where: { id: commentId }, data: { isPinned: true } }),
  ]);

  revalidatePath(`/watch/${videoId}`);
  return { pinned: true };
}


