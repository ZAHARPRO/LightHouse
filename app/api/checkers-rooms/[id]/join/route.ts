import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.checkersRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Room not open" }, { status: 400 });
  if (room.hostId === session.user.id) return NextResponse.json({ error: "Already host" }, { status: 400 });
  if (room.guestId) return NextResponse.json({ error: "Room full" }, { status: 400 });

  const user = room.rated
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { checkersElo: true } })
    : null;

  const updated = await prisma.checkersRoom.updateMany({
    where: { id, guestId: null, status: "WAITING" },
    data: { guestId: session.user.id, guestEloSnapshot: user?.checkersElo ?? null },
  });

  if (updated.count === 0) return NextResponse.json({ error: "Room full" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
