import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [mods, bans, mutes] = await Promise.all([
    prisma.streamChatMod.findMany({ where: { streamId: id }, select: { userId: true } }),
    prisma.streamChatBan.findMany({ where: { streamId: id }, select: { userId: true } }),
    prisma.streamChatMute.findMany({ where: { streamId: id }, select: { userId: true } }),
  ]);

  return NextResponse.json({
    mods:  mods.map(r => r.userId),
    banned: bans.map(r => r.userId),
    muted:  mutes.map(r => r.userId),
  });
}
