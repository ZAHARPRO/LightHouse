import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamSseBroadcast } from "@/lib/stream-sse";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const stream = await prisma.stream.findUnique({ where: { id } }).catch(() => null);
  if (!stream?.isActive) {
    return NextResponse.json({ error: "Stream not active" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const text = (body.text as string | undefined)?.trim().slice(0, 200);
  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  const isSupport = body.isSupport === true;

  const userName  = (session.user as { name?: string }).name ?? "Anonymous";
  const userImage = (session.user as { image?: string | null }).image ?? null;

  const msg = await prisma.streamChatMessage.create({
    data: { streamId: id, userId: session.user.id, userName, userImage, text, isSupport },
    select: { id: true, text: true, userName: true, userImage: true, userId: true, isSupport: true, createdAt: true },
  });

  streamSseBroadcast(id, { type: "chat", ...msg, at: msg.createdAt.getTime() });

  return NextResponse.json(msg, { status: 201 });
}
