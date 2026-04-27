import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const me = session.user.id;
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const sinceDate = since ? new Date(Number(since)) : new Date(0);

  // Find the latest unread message per conversation (sent by the other person, after `since`)
  const messages = await prisma.directMessage.findMany({
    where: {
      createdAt: { gt: sinceDate },
      isDeleted: false,
      senderId: { not: me },
      conversation: {
        OR: [{ user1Id: me }, { user2Id: me }],
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      conversationId: true,
      sender: { select: { id: true, name: true, image: true, tier: true } },
    },
  });

  // Deduplicate: one notification per conversation (keep latest)
  const byConv = new Map<string, typeof messages[number]>();
  for (const m of messages) {
    byConv.set(m.conversationId, m);
  }

  return NextResponse.json([...byConv.values()]);
}
