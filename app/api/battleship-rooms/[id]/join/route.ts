// app/api/battleship-rooms/[id]/join/route.ts
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const room = await prisma.battleshipRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Room not available" }, { status: 400 });
  if (room.hostId === userId) return NextResponse.json({ error: "Cannot join own room" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { battleshipElo: true },
  });

const updated = await prisma.battleshipRoom.update({
  where: { id },
  data: {
    guestId: userId,
    guestReady: false,          // добавить
    status: "WAITING",           // статус не меняем, ждем готовности игроков
    guestEloSnapshot: room.rated ? user?.battleshipElo : undefined,
  },
    include: {
      host: { select: { id: true, name: true, image: true, battleshipElo: true } },
      guest: { select: { id: true, name: true, image: true, battleshipElo: true } },
    },
  });

  return NextResponse.json({ room: updated });
}
