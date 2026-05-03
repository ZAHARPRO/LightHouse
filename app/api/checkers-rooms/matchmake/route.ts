import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { timeControl = "600" } = await req.json() as { timeControl?: string };

  await prisma.checkersRoom.updateMany({
    where: { hostId: userId, status: "WAITING", rated: true },
    data: { status: "FINISHED" },
  });

  const available = await prisma.checkersRoom.findFirst({
    where: { status: "WAITING", rated: true, timeControl, guestId: null, hostId: { not: userId } },
    orderBy: { createdAt: "asc" },
  });

  if (available) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { checkersElo: true } });
    const updated = await prisma.checkersRoom.updateMany({
      where: { id: available.id, guestId: null, status: "WAITING" },
      data: { guestId: userId, guestEloSnapshot: user?.checkersElo ?? null },
    });
    if (updated.count > 0) return NextResponse.json({ roomId: available.id, matched: true });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { checkersElo: true } });
  const room = await prisma.checkersRoom.create({
    data: { hostId: userId, timeControl, rated: true, hostEloSnapshot: user?.checkersElo ?? null },
  });

  return NextResponse.json({ roomId: room.id, matched: false });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.checkersRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING", rated: true },
    data: { status: "FINISHED" },
  });

  return NextResponse.json({ ok: true });
}
