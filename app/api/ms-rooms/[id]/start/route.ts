import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.minesweeperRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.hostId !== session.user.id) return NextResponse.json({ error: "Not the host" }, { status: 403 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Already started" }, { status: 400 });
  if (!room.guestId) return NextResponse.json({ error: "No opponent yet" }, { status: 400 });
  if (!room.guestReady) return NextResponse.json({ error: "Opponent not ready" }, { status: 400 });

  await prisma.minesweeperRoom.update({
    where: { id },
    data: { status: "PLAYING", startedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
