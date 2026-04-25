import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.chessRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Not in lobby" }, { status: 400 });
  if (room.guestId !== session.user.id) return NextResponse.json({ error: "Not the guest" }, { status: 403 });

  await prisma.chessRoom.update({ where: { id }, data: { guestReady: !room.guestReady } });
  return NextResponse.json({ ok: true });
}
