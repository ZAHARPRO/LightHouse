import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  const me = session.user.id;

  try {
    const convs = await prisma.directConversation.findMany({
      where: { OR: [{ user1Id: me }, { user2Id: me }] },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        user1: { select: { id: true, name: true, username: true, tier: true, image: true } },
        user2: { select: { id: true, name: true, username: true, tier: true, image: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, senderId: true, createdAt: true, isDeleted: true },
        },
      },
    });

    return NextResponse.json(
      convs.map((c) => ({
        id: c.id,
        updatedAt: c.updatedAt,
        other: c.user1Id === me ? c.user2 : c.user1,
        lastMessage: c.messages[0] ?? null,
        lastIsMe: c.messages[0]?.senderId === me,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
