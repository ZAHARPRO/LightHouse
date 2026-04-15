"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function updateUserAvatar(dataUrl: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  if (!dataUrl.startsWith("data:image/")) return { error: "Invalid image format" };
  // ~700KB base64 ≈ ~512KB raw — enough for a compressed 128×128 JPEG
  if (dataUrl.length > 700_000) return { error: "Image too large" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: dataUrl },
  });
  return { ok: true };
}

export async function updateUsername(username: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const trimmed = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(trimmed))
    return { error: "3–20 chars, letters, numbers and underscores only" };

  const existing = await prisma.user.findUnique({ where: { username: trimmed } });
  if (existing && existing.id !== session.user.id) return { error: "Username already taken" };

  await prisma.user.update({ where: { id: session.user.id }, data: { username: trimmed } });
  return { ok: true };
}

export async function removeUserAvatar() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: null },
  });
  return { ok: true };
}

export async function updateBio(bio: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const trimmed = bio.trim().slice(0, 300);
  await prisma.user.update({ where: { id: session.user.id }, data: { bio: trimmed || null } });
  return { ok: true };
}

export async function updateUserBanner(dataUrl: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!dataUrl.startsWith("data:image/")) return { error: "Invalid image format" };
  if (dataUrl.length > 2_500_000) return { error: "Image too large (max ~1.8MB)" };
  await prisma.user.update({ where: { id: session.user.id }, data: { banner: dataUrl } });
  return { ok: true };
}

export async function removeUserBanner() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  await prisma.user.update({ where: { id: session.user.id }, data: { banner: null } });
  return { ok: true };
}

export async function updateBadgeShowcase(rewardIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { badgeShowcase: JSON.stringify(rewardIds.slice(0, 3)) },
  });
  return { ok: true };
}
