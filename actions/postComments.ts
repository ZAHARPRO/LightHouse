"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";


export async function addPostComment(
  postId: string,
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
      postId,
      authorId: session.user.id,
      parentId: parentId ?? null,
      replyToName: replyToName ?? null,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  revalidatePath(`/post/${postId}`);
  return { comment };
}

export async function togglePostCommentLike(commentId: string, postId: string) {
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

  revalidatePath(`/post/${postId}`);
  return { liked: true };
}

export async function togglePinPostComment(commentId: string, postId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (post?.authorId !== session.user.id) return { error: "Not allowed" };

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { isPinned: true } });
  if (!comment) return { error: "Not found" };

  if (comment.isPinned) {
    await prisma.comment.update({ where: { id: commentId }, data: { isPinned: false } });
    return { pinned: false };
  }

  await prisma.$transaction([
    prisma.comment.updateMany({ where: { postId, isPinned: true }, data: { isPinned: false } }),
    prisma.comment.update({ where: { id: commentId }, data: { isPinned: true } }),
  ]);

  revalidatePath(`/post/${postId}`);
  return { pinned: true };
}
