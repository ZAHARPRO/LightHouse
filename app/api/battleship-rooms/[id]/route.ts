// app/api/battleship-rooms/[id]/route.ts

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// ВАЖНО: фильтруем данные — каждый игрок видит только то что должен
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const room = await prisma.battleshipRoom.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, image: true, battleshipElo: true } },
      guest: { select: { id: true, name: true, image: true, battleshipElo: true } },
    },
  });

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isHost = userId === room.hostId;
  const isGuest = userId === room.guestId;

  const myRole = isHost ? "host" : isGuest ? "guest" : "spectator";

  // Строим ответ в зависимости от роли
  const response = {
    ...room,
    myRole,
    // Своё полное поле (с кораблями)
    myBoard: isHost ? room.hostBoardJson : isGuest ? room.guestBoardJson : null,
    myShips: isHost ? room.hostShipsJson : isGuest ? room.guestShipsJson : null,
    // Видимое поле соперника (только hit/miss/sunk)
    opponentBoard: isHost ? room.guestVisibleJson : isGuest ? room.hostVisibleJson : null,
    // Корабли соперника — скрыты до окончания игры
    opponentShips: room.status === "FINISHED"
      ? (isHost ? room.guestShipsJson : room.hostShipsJson)
      : null,
    // Убираем полные данные из ответа
    hostBoardJson: undefined,
    guestBoardJson: undefined,
    hostShipsJson: undefined,
    guestShipsJson: undefined,
  };

  return NextResponse.json({ room: response });
}

// Host cancels a WAITING room
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await prisma.battleshipRoom.updateMany({
    where: { id, hostId: session.user.id, status: { in: ["WAITING", "PLACEMENT"] } },
    data: { status: "FINISHED" },
  });

  if (updated.count === 0) return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
