import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { timeControl = "600" } = await req.json() as { timeControl?: string };

  // Cancel any WAITING rated rooms this user already has open
  await prisma.chessRoom.updateMany({
    where: { hostId: userId, status: "WAITING", rated: true },
    data: { status: "FINISHED" },
  });

  // Try to find an available room with matching time control
  const available = await prisma.chessRoom.findFirst({
    where: { status: "WAITING", rated: true, timeControl, guestId: null, hostId: { not: userId } },
    orderBy: { createdAt: "asc" },
  });

  if (available) {
    // Atomically claim the slot — guard against another instance doing the same
    const updated = await prisma.chessRoom.updateMany({
      where: { id: available.id, guestId: null, status: "WAITING" },
      data: { guestId: userId },
    });
    if (updated.count > 0) {
      return NextResponse.json({ roomId: available.id, matched: true });
    }
  }

  // No match — create a new waiting room
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { chessElo: true } });
  const room = await prisma.chessRoom.create({
    data: { hostId: userId, timeControl, rated: true, hostEloSnapshot: user?.chessElo ?? null },
  });

  return NextResponse.json({ roomId: room.id, matched: false });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.chessRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING", rated: true },
    data: { status: "FINISHED" },
  });

  return NextResponse.json({ ok: true });
}
