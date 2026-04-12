"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeVideoUrl, normalizeThumbnailUrl } from "@/lib/videoUrl";

export async function createVideo(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const title       = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const rawUrl      = (formData.get("url") as string)?.trim();
  const url         = normalizeVideoUrl(rawUrl);
  const thumbnail   = normalizeThumbnailUrl((formData.get("thumbnail") as string)?.trim())
                   ?? normalizeThumbnailUrl(rawUrl);
  const isPremium   = formData.get("isPremium") === "on";
  const categoryId  = (formData.get("categoryId") as string)?.trim() || null;
  const durationRaw = formData.get("duration") as string;
  const duration    = durationRaw ? parseInt(durationRaw, 10) || null : null;

  if (!title || !url) return { error: "Title and URL are required" };

  const video = await prisma.video.create({
    data: {
      title,
      description,
      url,
      thumbnail,
      isPremium,
      duration,
      authorId: session.user.id,
      categoryId: categoryId || null,
    },
  });

  revalidatePath("/feed");
  redirect(`/watch/${video.id}`);
}

export async function updateVideo(videoId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!video || video.authorId !== session.user.id) return { error: "Not allowed" };

  const title       = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const thumbnail   = normalizeThumbnailUrl((formData.get("thumbnail") as string)?.trim());
  const isPremium   = formData.get("isPremium") === "on";
  const categoryId  = (formData.get("categoryId") as string)?.trim() || null;

  if (!title) return { error: "Title is required" };

  await prisma.video.update({
    where: { id: videoId },
    data: { title, description, thumbnail, isPremium, categoryId: categoryId || null },
  });

  revalidatePath(`/watch/${videoId}`);
  revalidatePath("/profile");
  return { ok: true };
}

export async function reuploadVideo(videoId: string, newUrl: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!video || video.authorId !== session.user.id) return { error: "Not allowed" };

  const url = normalizeVideoUrl(newUrl.trim());
  if (!url) return { error: "URL is required" };

  await prisma.$transaction([
    prisma.like.deleteMany({ where: { videoId } }),
    prisma.video.update({ where: { id: videoId }, data: { url, views: 0, duration: null } }),
  ]);

  revalidatePath(`/watch/${videoId}`);
  revalidatePath("/profile");
  return { ok: true };
}

export async function deleteVideo(videoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!video || video.authorId !== session.user.id) return { error: "Not allowed" };

  await prisma.video.delete({ where: { id: videoId } });

  revalidatePath("/profile");
  revalidatePath("/feed");
  return { ok: true };
}

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
