"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const title     = (formData.get("title") as string)?.trim();
  const content   = (formData.get("content") as string)?.trim();
  const isPremium = formData.get("isPremium") === "on";

  if (!title || !content) return { error: "Title and content are required" };
  if (title.length > 200)  return { error: "Title is too long (max 200 chars)" };

  const post = await prisma.post.create({
    data: { title, content, isPremium, authorId: session.user.id },
  });

  revalidatePath("/feed");
  redirect(`/post/${post.id}`);
}

export async function updatePost(postId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post || post.authorId !== session.user.id) return { error: "Not allowed" };

  const title     = (formData.get("title") as string)?.trim();
  const content   = (formData.get("content") as string)?.trim();
  const isPremium = formData.get("isPremium") === "on";

  if (!title || !content) return { error: "Title and content are required" };

  await prisma.post.update({ where: { id: postId }, data: { title, content, isPremium } });

  revalidatePath(`/post/${postId}`);
  revalidatePath("/profile");
  return { ok: true };
}

export async function deletePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post || post.authorId !== session.user.id) return { error: "Not allowed" };

  await prisma.post.delete({ where: { id: postId } });

  revalidatePath("/profile");
  revalidatePath("/feed");
  return { ok: true };
}
