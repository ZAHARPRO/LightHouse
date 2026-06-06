"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Unauthorized");
}

export async function createAnnouncementMessage(formData: FormData) {
  await requireAdmin();
  const text  = (formData.get("text") as string)?.trim();
  const emoji = (formData.get("emoji") as string)?.trim() || "📢";
  const color = (formData.get("color") as string)?.trim() || "#f97316";
  if (!text) return;
  await prisma.announcementMessage.create({ data: { text, emoji, color } });
  revalidatePath("/admin/news");
}

export async function toggleAnnouncementMessage(id: string, enabled: boolean) {
  await requireAdmin();
  await prisma.announcementMessage.update({ where: { id }, data: { enabled } });
  revalidatePath("/admin/news");
}

export async function deleteAnnouncementMessage(id: string) {
  await requireAdmin();
  await prisma.announcementMessage.delete({ where: { id } });
  revalidatePath("/admin/news");
}
