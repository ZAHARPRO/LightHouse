import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  const uid = session.user.id;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [videoLikes, newComments, replies, pinnedComments] = await Promise.all([
      // Likes / dislikes on user's videos
      prisma.like.findMany({
        where: {
          video: { authorId: uid },
          userId: { not: uid },
          createdAt: { gte: since },
        },
        include: {
          user:  { select: { id: true, name: true, image: true } },
          video: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),

      // Top-level comments on user's videos / posts
      prisma.comment.findMany({
        where: {
          authorId: { not: uid },
          parentId: null,
          createdAt: { gte: since },
          OR: [
            { video: { authorId: uid } },
            { post:  { authorId: uid } },
          ],
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
          video:  { select: { id: true, title: true } },
          post:   { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),

      // Replies to user's own comments
      prisma.comment.findMany({
        where: {
          authorId: { not: uid },
          parentId: { not: null },
          parent: { authorId: uid },
          createdAt: { gte: since },
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
          video:  { select: { id: true, title: true } },
          post:   { select: { id: true, title: true } },
          parent: { select: { content: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),

      // User's comments that were pinned by the author
      prisma.comment.findMany({
        where: {
          authorId: uid,
          isPinned: true,
          createdAt: { gte: since },
        },
        include: {
          video: { select: { id: true, title: true } },
          post:  { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    type Item = {
      id: string;
      type: "like" | "dislike" | "comment" | "reply" | "pinned";
      createdAt: string;
      actor?: { id: string; name: string | null; image: string | null } | null;
      videoId?: string | null;
      videoTitle?: string | null;
      postId?: string | null;
      postTitle?: string | null;
      content?: string | null;
      parentContent?: string | null;
    };

    const items: Item[] = [
      ...videoLikes.map((l) => ({
        id: l.id,
        type: (l.type === "LIKE" ? "like" : "dislike") as Item["type"],
        createdAt: l.createdAt.toISOString(),
        actor: l.user,
        videoId: l.videoId,
        videoTitle: l.video.title,
      })),
      ...newComments.map((c) => ({
        id: c.id,
        type: "comment" as const,
        createdAt: c.createdAt.toISOString(),
        actor: c.author,
        videoId: c.videoId,
        videoTitle: c.video?.title ?? null,
        postId: c.postId,
        postTitle: c.post?.title ?? null,
        content: c.content.slice(0, 100),
      })),
      ...replies.map((c) => ({
        id: `reply-${c.id}`,
        type: "reply" as const,
        createdAt: c.createdAt.toISOString(),
        actor: c.author,
        videoId: c.videoId,
        videoTitle: c.video?.title ?? null,
        postId: c.postId,
        postTitle: c.post?.title ?? null,
        content: c.content.slice(0, 100),
        parentContent: c.parent?.content.slice(0, 60) ?? null,
      })),
      ...pinnedComments.map((c) => ({
        id: `pin-${c.id}`,
        type: "pinned" as const,
        createdAt: c.createdAt.toISOString(),
        videoId: c.videoId,
        videoTitle: c.video?.title ?? null,
        postId: c.postId,
        postTitle: c.post?.title ?? null,
        content: c.content.slice(0, 100),
      })),
    ];

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(items.slice(0, 40));
  } catch {
    return NextResponse.json([]);
  }
}
