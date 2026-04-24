import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.minesweeperRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const userId = session.user.id;
  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;

  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  if (room.status === "WAITING") {
    if (isHost) {
      await prisma.minesweeperRoom.delete({ where: { id } });
    } else {
      await prisma.minesweeperRoom.update({
        where: { id },
        data: { guestId: null, guestReady: false },
      });
    }
  } else if (room.status === "PLAYING") {
    await prisma.minesweeperRoom.update({
      where: { id },
      data: {
        status: "FINISHED",
        winner: isHost ? "guest" : "host",
        winReason: "left",
        endedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
