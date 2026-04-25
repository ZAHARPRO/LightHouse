"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { awardBadge } from "@/lib/awardBadge";
import { BadgeDef } from "@/lib/badges";

export async function awardGameBadge(type: string): Promise<{ error?: string; alreadyHas?: boolean; ok?: boolean; badge?: BadgeDef }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const result = await awardBadge(prisma, session.user.id, type);
  if (!result.awarded) return { alreadyHas: true };

  return { ok: true, badge: result.badge };
}
