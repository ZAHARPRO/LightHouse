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

/* ── Create news post (admin only) ── */
export async function createNewsPost(title: string, content: string) {
  const session = await requireAdmin();
  if (!title.trim() || !content.trim()) return { error: "Title and content required" };

  const post = await prisma.newsPost.create({
    data: { title: title.trim(), content: content.trim(), authorId: session.user.id },
  });

  revalidatePath("/news");
  revalidatePath("/dm");
  revalidatePath("/admin/news");
  return { post };
}

/* ── Delete news post (admin only) ── */
export async function deleteNewsPost(id: string) {
  await requireAdmin();
  await prisma.newsPost.delete({ where: { id } });
  revalidatePath("/news");
  revalidatePath("/dm");
  revalidatePath("/admin/news");
}

/* ── Get all news posts (public) ── */
export async function getNewsPosts() {
  return prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      _count: { select: { comments: true, likes: true } },
    },
  });
}

/* ── Get single news post ── */
export async function getNewsPost(id: string) {
  return prisma.newsPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      _count: { select: { comments: true, likes: true } },
    },
  });
}

/* ── Vote on news (like / dislike) ── */
export async function voteNews(newsPostId: string, type: "LIKE" | "DISLIKE") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const existing = await prisma.newsLike.findUnique({
    where: { userId_newsPostId: { userId: session.user.id, newsPostId } },
  });

  if (existing) {
    if (existing.type === type) {
      // same vote → remove
      await prisma.newsLike.delete({ where: { id: existing.id } });
    } else {
      // switch vote
      await prisma.newsLike.update({ where: { id: existing.id }, data: { type } });
    }
  } else {
    await prisma.newsLike.create({
      data: { userId: session.user.id, newsPostId, type },
    });
  }

  revalidatePath(`/news/${newsPostId}`);
}

/* ── Add comment to news post ── */
export async function addNewsComment(
  newsPostId: string,
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
      newsPostId,
      authorId: session.user.id,
      parentId: parentId ?? null,
      replyToName: replyToName ?? null,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  revalidatePath(`/news/${newsPostId}`);
  return { comment };
}

/* ── Get comments for news post ── */
export async function getNewsComments(newsPostId: string) {
  return prisma.comment.findMany({
    where: { newsPostId, parentId: null },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true } },
      likes: true,
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, image: true } },
          likes: true,
        },
      },
    },
  });
}

/* ── Get news vote counts + viewer vote ── */
export async function getNewsVotes(newsPostId: string) {
  const session = await auth();
  const [likes, dislikes, myVote] = await Promise.all([
    prisma.newsLike.count({ where: { newsPostId, type: "LIKE" } }),
    prisma.newsLike.count({ where: { newsPostId, type: "DISLIKE" } }),
    session?.user?.id
      ? prisma.newsLike.findUnique({
          where: { userId_newsPostId: { userId: session.user.id, newsPostId } },
        })
      : null,
  ]);
  return { likes, dislikes, myVote: myVote?.type ?? null };
}
