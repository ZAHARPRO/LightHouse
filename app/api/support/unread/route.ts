import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const STAFF_ROLES = ["ADMIN", "OPERATOR", "STAFF"];

/**
 * Returns the count of open conversations whose last message
 * is from the user (not staff) — i.e. tickets waiting for a reply.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ count: 0 });
  }

  const convs = await prisma.supportConversation.findMany({
    where: { status: "OPEN" },
    select: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { isFromStaff: true },
      },
    },
  });

  // A ticket is "unread" when the last message came from the user, not staff
  const unread = convs.filter(
    (c) => c.messages.length > 0 && !c.messages[0].isFromStaff
  ).length;

  return NextResponse.json({ count: unread });
}
