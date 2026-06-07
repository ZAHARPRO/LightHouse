import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  const pending = await prisma.pendingScreamer.findMany({
    where: { recipientId: session.user.id, seenAt: null },
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { id: true, videoUrl: true, bypassed: true, sender: { select: { name: true } } },
  });

  return NextResponse.json(pending);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false });

  const { id } = await req.json();
  await prisma.pendingScreamer.updateMany({
    where: { id, recipientId: session.user.id },
    data: { seenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
