import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, roomId, userId } = (await req.json()) as {
    action: string;
    roomId?: string;
    userId?: string;
  };

  if (action === "close" && roomId) {
    await prisma.durakRoom.update({
      where: { id: roomId },
      data: { status: "FINISHED", phase: "finished", endedAt: new Date() },
    });
    broadcast(roomId, { type: "update" });
    return NextResponse.json({ ok: true });
  }

  if (action === "unban" && userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { durakCheaterBanned: false, durakCheaterCatches: 0 },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
