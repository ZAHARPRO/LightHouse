// app/api/battleship-rooms/[id]/move/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Board, Ship, applyShot, GameState, serializeState } from "@/lib/battleship";
import { calculateEloDelta } from "@/lib/elo";
import { awardBadge, awardBattleshipEloBadges } from "@/lib/awardBadge";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { row, col }: { row: number; col: number } = await req.json();

  const room = await prisma.battleshipRoom.findUnique({ where: { id } });
  if (!room || room.status !== "PLAYING") {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }

  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  // Проверяем что сейчас ход этого игрока
  const myRole = isHost ? "host" : "guest";
  if (room.currentTurn !== myRole) {
    return NextResponse.json({ error: "Not your turn" }, { status: 400 });
  }

  // Загружаем нужные поля
  // Стреляющий видит СВОЁ полное поле и ЧУЖОЕ видимое поле
  // Мы стреляем в полное поле противника
  const targetBoardJson = isHost ? room.guestBoardJson : room.hostBoardJson;
  const targetShipsJson = isHost ? room.guestShipsJson : room.hostShipsJson;
  const targetVisibleJson = isHost ? room.guestVisibleJson : room.hostVisibleJson;

  if (!targetBoardJson || !targetShipsJson) {
    return NextResponse.json({ error: "Boards not set up" }, { status: 400 });
  }

  const targetBoard: Board = JSON.parse(targetBoardJson);
  const targetShips: Ship[] = JSON.parse(targetShipsJson);
  const targetVisible: Board = JSON.parse(targetVisibleJson!);

  // Проверяем клетку
  const cellState = targetBoard[row][col];
  if (cellState === "hit" || cellState === "miss" || cellState === "sunk") {
    return NextResponse.json({ error: "Already shot" }, { status: 400 });
  }

  // Применяем выстрел
  const hit = cellState === "ship";
  let sunk = false;
  let sunkShipId: number | undefined;

  // Обновляем реальное поле
  const newTargetBoard = targetBoard.map(r => [...r]) as Board;
  const newTargetShips = targetShips.map(s => ({ ...s }));

  if (hit) {
    newTargetBoard[row][col] = "hit";
    const shipIdx = newTargetShips.findIndex(s => s.cells.some(([r, c]) => r === row && c === col));
    if (shipIdx !== -1) {
      newTargetShips[shipIdx].hits++;
      sunkShipId = newTargetShips[shipIdx].id;
      if (newTargetShips[shipIdx].hits >= newTargetShips[shipIdx].size) {
        sunk = true;
        for (const [r, c] of newTargetShips[shipIdx].cells) {
          newTargetBoard[r][c] = "sunk";
        }
        // Закрашиваем зону вокруг потопленного корабля
        for (const [r, c] of newTargetShips[shipIdx].cells) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && newTargetBoard[nr][nc] === "empty") {
                newTargetBoard[nr][nc] = "miss";
              }
            }
          }
        }
      }
    }
  } else {
    newTargetBoard[row][col] = "miss";
  }

  // Обновляем видимое поле (то что видит стреляющий)
  const newTargetVisible = newTargetBoard.map(r =>
    r.map(cell => (cell === "ship" ? "empty" : cell))
  ) as Board;

  // Проверяем победу
  const allSunk = newTargetShips.every(s => s.hits >= s.size);
  const gameOver = allSunk;
  const winner = gameOver ? myRole : null;

  // Следующий ход — при попадании остаётся тот же игрок
  const nextTurn = hit && !gameOver ? myRole : (myRole === "host" ? "guest" : "host");

  // Обновляем историю ходов для реплея
  const moves = JSON.parse(room.movesJson || "[]");
  moves.push({ shooter: myRole, row, col, hit, sunk, shipId: sunkShipId });

  // Таймер
  const now = new Date();
  let hostTimeMs = room.hostTimeMs;
  let guestTimeMs = room.guestTimeMs;
  if (room.timeControl !== "none" && room.lastMoveAt) {
    const elapsed = now.getTime() - new Date(room.lastMoveAt).getTime();
    if (myRole === "host") hostTimeMs = Math.max(0, (hostTimeMs ?? 0) - elapsed);
    else guestTimeMs = Math.max(0, (guestTimeMs ?? 0) - elapsed);
  }

  // Формируем данные для обновления
  const updateData: any = {
    [isHost ? "guestBoardJson" : "hostBoardJson"]: JSON.stringify(newTargetBoard),
    [isHost ? "guestShipsJson" : "hostShipsJson"]: JSON.stringify(newTargetShips),
    [isHost ? "guestVisibleJson" : "hostVisibleJson"]: JSON.stringify(newTargetVisible),
    currentTurn: nextTurn,
    lastMoveAt: now,
    movesJson: JSON.stringify(moves),
    hostTimeMs,
    guestTimeMs,
  };

  if (gameOver) {
    updateData.status = "FINISHED";
    updateData.winner = winner;
    updateData.winReason = "all_sunk";
    updateData.endedAt = now;

    // ELO и бейджи
    if (room.rated && room.hostEloSnapshot != null && room.guestEloSnapshot != null) {
      const winnerElo = winner === "host" ? room.hostEloSnapshot : room.guestEloSnapshot;
      const loserElo  = winner === "host" ? room.guestEloSnapshot : room.hostEloSnapshot;
      const [winDelta, loseDelta] = calculateEloDelta(winnerElo, loserElo);

      const hostDelta  = winner === "host" ?  winDelta : -loseDelta;
      const guestDelta = winner === "guest" ?  winDelta : -loseDelta;

      updateData.hostEloDelta  = hostDelta;
      updateData.guestEloDelta = guestDelta;

      const hostNewElo  = Math.max(100, room.hostEloSnapshot  + hostDelta);
      const guestNewElo = Math.max(100, room.guestEloSnapshot + guestDelta);

      await prisma.user.update({ where: { id: room.hostId }, data: { battleshipElo: hostNewElo } });
      if (room.guestId) {
        await prisma.user.update({ where: { id: room.guestId }, data: { battleshipElo: guestNewElo } });
      }

      const winnerId    = winner === "host" ? room.hostId : room.guestId!;
      const winnerNewElo = winner === "host" ? hostNewElo : guestNewElo;
      await awardBadge(prisma, winnerId, "BATTLESHIP_ONLINE_WIN");
      await awardBattleshipEloBadges(prisma, winnerId, winnerNewElo);
    }
  }

  const updatedRoom = await prisma.battleshipRoom.update({
    where: { id: id },
    data: updateData,
    include: {
      host: { select: { id: true, name: true, image: true, battleshipElo: true } },
      guest: { select: { id: true, name: true, image: true, battleshipElo: true } },
    },
  });

  return NextResponse.json({
    room: updatedRoom,
    result: { row, col, hit, sunk, shipId: sunkShipId, gameOver, winner },
  });
}
