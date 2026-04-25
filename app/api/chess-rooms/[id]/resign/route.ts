import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.chessRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ ok: true });

  const isHost = room.hostId === session.user.id;
  const isGuest = room.guestId === session.user.id;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

  if (room.status === "WAITING") {
    if (isHost) await prisma.chessRoom.delete({ where: { id } });
    else await prisma.chessRoom.update({ where: { id }, data: { guestId: null, guestReady: false } });
  } else if (room.status === "PLAYING") {
    await prisma.chessRoom.update({
      where: { id },
      data: {
        status: "FINISHED",
        winner: isHost ? "black" : "white",
        winReason: "resigned",
        endedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
