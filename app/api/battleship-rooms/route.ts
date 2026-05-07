// app/api/battleship-rooms/route.ts
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/battleship-rooms — список открытых комнат
export async function GET(req: NextRequest) {
    const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const rooms = await prisma.battleshipRoom.findMany({
    where: {
      status: { in: ["WAITING", "PLAYING"] },
      rated: false,
    },
    include: {
      host: { select: { id: true, name: true, image: true, battleshipElo: true } },
      guest: { select: { id: true, name: true, image: true, battleshipElo: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const waiting = rooms.filter(r => r.status === "WAITING");
  const playing = rooms.filter(r => r.status === "PLAYING");
  return NextResponse.json({ waiting, playing });
}

// POST /api/battleship-rooms — создать комнату
export async function POST(req: NextRequest) {
    const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { timeControl = "none", rated = false } = body;

  const room = await prisma.battleshipRoom.create({
    data: {
      hostId: userId,
      timeControl,
      rated,
      hostEloSnapshot: rated
        ? (await prisma.user.findUnique({
            where: { id: userId },
            select: { battleshipElo: true },
          }))?.battleshipElo
        : undefined,
    },
    include: {
      host: { select: { id: true, name: true, image: true, battleshipElo: true } },
    },
  });

  return NextResponse.json({ id: room.id, room });
}