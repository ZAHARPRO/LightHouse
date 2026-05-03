import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.checkersRoom.findUnique({ where: { id } });
  if (!room || room.status !== "WAITING") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.guestId !== session.user.id) return NextResponse.json({ error: "Not guest" }, { status: 403 });

  await prisma.checkersRoom.update({ where: { id }, data: { guestReady: !room.guestReady } });
  return NextResponse.json({ ok: true });
}
