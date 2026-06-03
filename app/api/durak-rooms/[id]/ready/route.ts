import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slot = await prisma.durakPlayerSlot.findUnique({
    where: { roomId_userId: { roomId: id, userId: session.user.id } },
    include: { room: { select: { status: true } } },
  });
  if (!slot || slot.room.status !== "WAITING") return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.durakPlayerSlot.update({ where: { id: slot.id }, data: { isReady: !slot.isReady } });
  broadcast(id, { type: "update" });
  return NextResponse.json({ ok: true });
}
