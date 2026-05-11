import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.battleshipRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Not in lobby" }, { status: 400 });
  if (room.hostId !== session.user.id) return NextResponse.json({ error: "Not the host" }, { status: 403 });
  if (!room.guestId || !room.guestReady) return NextResponse.json({ error: "Guest not ready" }, { status: 400 });

  await prisma.battleshipRoom.update({
    where: { id },
    data: { status: "PLACEMENT" },
  });
  return NextResponse.json({ ok: true });
}
