// app/api/battleship-rooms/[id]/place/route.ts
// Игрок отправляет свою расстановку кораблей
import { NextRequest, NextResponse } from "next/server";

import { prisma }  from "@/lib/prisma";
import { Board, Ship, SHIP_SIZES } from "@/lib/battleship";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
   const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { board, ships }: { board: Board; ships: Ship[] } = body;

  // Валидация: проверяем что расставлены правильные корабли
  const shipSizes = ships.map(s => s.size).sort((a, b) => b - a);
  const expectedSizes = [...SHIP_SIZES].sort((a, b) => b - a);
  if (JSON.stringify(shipSizes) !== JSON.stringify(expectedSizes)) {
    return NextResponse.json({ error: "Invalid ship placement" }, { status: 400 });
  }

  const room = await prisma.battleshipRoom.findUnique({ where: { id: id } });
  if (!room || room.status !== "PLACEMENT") {
    return NextResponse.json({ error: "Invalid room state" }, { status: 400 });
  }

  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not in this room" }, { status: 403 });

  // Создаём "видимое" поле (только empty клетки — корабли скрыты)
  const visibleBoard: Board = board.map(row =>
    row.map(cell => (cell === "ship" ? "empty" : cell)) as any
  );

  const updateData: Record<string, string> = {};
  if (isHost) {
    updateData.hostBoardJson = JSON.stringify(board);
    updateData.hostShipsJson = JSON.stringify(ships);
    updateData.hostVisibleJson = JSON.stringify(visibleBoard);
    updateData.hostReady = "true";
  } else {
    updateData.guestBoardJson = JSON.stringify(board);
    updateData.guestShipsJson = JSON.stringify(ships);
    updateData.guestVisibleJson = JSON.stringify(visibleBoard);
    updateData.guestReady = "true";
  }

  // Если оба готовы — переходим в PLAYING
  const hostReady = isHost ? true : room.hostReady;
  const guestReady = isGuest ? true : room.guestReady;

  if (hostReady && guestReady) {
    updateData.status = "PLAYING";
    updateData.startedAt = new Date().toISOString();
    updateData.currentTurn = "host"; // хост ходит первым
    if (room.timeControl !== "none") {
      const ms = parseInt(room.timeControl) * 1000;
      updateData.hostTimeMs = ms.toString();
      updateData.guestTimeMs = ms.toString();
    }
  }

  // Prisma не принимает смешанные типы в одном update через Record<string, string>
  // поэтому делаем через отдельные условные обновления:
  const updatedRoom = await prisma.battleshipRoom.update({
    where: { id: id },
    data: isHost
      ? {
          hostBoardJson: JSON.stringify(board),
          hostShipsJson: JSON.stringify(ships),
          hostVisibleJson: JSON.stringify(visibleBoard),
          hostReady: true,
          ...(hostReady && guestReady ? {
            status: "PLAYING",
            startedAt: new Date(),
            currentTurn: "host",
          } : {}),
        }
      : {
          guestBoardJson: JSON.stringify(board),
          guestShipsJson: JSON.stringify(ships),
          guestVisibleJson: JSON.stringify(visibleBoard),
          guestReady: true,
          ...(hostReady && guestReady ? {
            status: "PLAYING",
            startedAt: new Date(),
            currentTurn: "host",
          } : {}),
        },
    include: {
      host: { select: { id: true, name: true, image: true, battleshipElo: true } },
      guest: { select: { id: true, name: true, image: true, battleshipElo: true } },
    },
  });

  return NextResponse.json({ room: updatedRoom });
}
