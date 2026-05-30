import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamSseBroadcast } from "@/lib/stream-sse";

type Action = "mute" | "unmute" | "ban" | "unban" | "make_mod" | "remove_mod";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const callerId = session.user.id;

  const stream = await prisma.stream.findUnique({ where: { id }, select: { adminId: true } });
  if (!stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 });

  const isOwner = stream.adminId === callerId;
  if (!isOwner) {
    // Check if caller is a mod
    const callerMod = await prisma.streamChatMod.findUnique({
      where: { streamId_userId: { streamId: id, userId: callerId } },
    });
    if (!callerMod) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as Action | undefined;
  const targetUserId = body.targetUserId as string | undefined;

  if (!action || !targetUserId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (targetUserId === callerId) return NextResponse.json({ error: "Cannot moderate yourself" }, { status: 400 });
  // Only owner can make/remove mods
  if ((action === "make_mod" || action === "remove_mod") && !isOwner) {
    return NextResponse.json({ error: "Only stream owner can manage mods" }, { status: 403 });
  }

  // Fetch target user name for SSE broadcast
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } });
  const targetName = target?.name ?? "User";

  switch (action) {
    case "mute":
      await prisma.streamChatMute.upsert({
        where: { streamId_userId: { streamId: id, userId: targetUserId } },
        create: { streamId: id, userId: targetUserId, mutedBy: callerId },
        update: { mutedBy: callerId, mutedAt: new Date() },
      });
      break;
    case "unmute":
      await prisma.streamChatMute.deleteMany({ where: { streamId: id, userId: targetUserId } });
      break;
    case "ban":
      await prisma.streamChatBan.upsert({
        where: { streamId_userId: { streamId: id, userId: targetUserId } },
        create: { streamId: id, userId: targetUserId, bannedBy: callerId },
        update: { bannedBy: callerId, bannedAt: new Date() },
      });
      break;
    case "unban":
      await prisma.streamChatBan.deleteMany({ where: { streamId: id, userId: targetUserId } });
      break;
    case "make_mod":
      await prisma.streamChatMod.upsert({
        where: { streamId_userId: { streamId: id, userId: targetUserId } },
        create: { streamId: id, userId: targetUserId },
        update: {},
      });
      break;
    case "remove_mod":
      await prisma.streamChatMod.deleteMany({ where: { streamId: id, userId: targetUserId } });
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  streamSseBroadcast(id, { type: "mod_update", action, targetUserId, targetName });

  return NextResponse.json({ ok: true });
}
