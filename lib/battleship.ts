// lib/battleship.ts

// ─── Типы ───────────────────────────────────────────────────────────────────

export type CellState = "empty" | "ship" | "hit" | "miss" | "sunk";
// empty  = пустая клетка
// ship   = корабль (только на своём поле, противнику не видно)
// hit    = попадание
// miss   = промах
// sunk   = потопленный корабль

export type Board = CellState[][]; // 10x10 массив

export type Orientation = "horizontal" | "vertical";

export interface Ship {
  id: number;       // уникальный номер корабля
  size: number;     // длина: 4, 3, 3, 2, 2, 2, 1, 1, 1, 1
  cells: [number, number][]; // координаты [row, col] всех клеток
  hits: number;     // количество попаданий
}

export interface GameState {
  playerBoard: Board;       // ваше поле (видно вам)
  opponentBoard: Board;     // поле соперника (только hit/miss/sunk видно)
  playerShips: Ship[];      // ваши корабли
  opponentShips: Ship[];    // корабли соперника (скрыты до потопления)
  currentTurn: "player" | "opponent";
  phase: "placement" | "battle" | "finished";
  winner: "player" | "opponent" | null;
  lastHit: [number, number] | null; // последний выстрел (для анимации)
}

export interface ShotResult {
  row: number;
  col: number;
  hit: boolean;
  sunk: boolean;
  shipId?: number;
  gameOver: boolean;
  winner?: "player" | "opponent";
}

// ─── Константы ──────────────────────────────────────────────────────────────

// Стандартный набор кораблей: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
export const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
// Итого 10 кораблей, 20 клеток

// ─── Функции ─────────────────────────────────────────────────────────────────

/** Создаёт пустое 10x10 поле */
export function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array(10).fill("empty") as CellState[]);
}

/** Начальное состояние игры (до расстановки) */
export function initialState(): GameState {
  return {
    playerBoard: emptyBoard(),
    opponentBoard: emptyBoard(),
    playerShips: [],
    opponentShips: [],
    currentTurn: "player",
    phase: "placement",
    winner: null,
    lastHit: null,
  };
}

/** Проверяет, можно ли поставить корабль на позицию (включая зону вокруг) */
export function canPlaceShip(
  board: Board,
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): boolean {
  const cells = getShipCells(row, col, size, orientation);
  if (!cells) return false; // выходит за границы

  for (const [r, c] of cells) {
    // Проверяем саму клетку и все 8 соседей
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
          if (board[nr][nc] === "ship") return false;
        }
      }
    }
  }
  return true;
}

/** Возвращает список клеток корабля или null если выходит за границы */
function getShipCells(
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): [number, number][] | null {
  const cells: [number, number][] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === "vertical" ? row + i : row;
    const c = orientation === "horizontal" ? col + i : col;
    if (r >= 10 || c >= 10) return null;
    cells.push([r, c]);
  }
  return cells;
}

/** Размещает корабль на поле, возвращает новый board и Ship */
export function placeShip(
  board: Board,
  ships: Ship[],
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): { board: Board; ships: Ship[] } | null {
  if (!canPlaceShip(board, row, col, size, orientation)) return null;

  const cells = getShipCells(row, col, size, orientation)!;
  const newBoard = board.map(r => [...r]) as Board;
  for (const [r, c] of cells) {
    newBoard[r][c] = "ship";
  }

  const ship: Ship = {
    id: ships.length,
    size,
    cells,
    hits: 0,
  };

  return { board: newBoard, ships: [...ships, ship] };
}

/** Случайная расстановка всех кораблей (используется ботом и кнопкой "случайно") */
export function randomPlacement(): { board: Board; ships: Ship[] } {
  let board = emptyBoard();
  let ships: Ship[] = [];

  for (const size of SHIP_SIZES) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      attempts++;
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);
      const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
      const result = placeShip(board, ships, row, col, size, orientation);
      if (result) {
        board = result.board;
        ships = result.ships;
        placed = true;
      }
    }
    if (!placed) {
      // Сброс и повтор если застряли (редкий случай)
      board = emptyBoard();
      ships = [];
      return randomPlacement();
    }
  }

  return { board, ships };
}

/** Обрабатывает выстрел. Возвращает результат и обновлённый state */
export function applyShot(
  state: GameState,
  row: number,
  col: number,
  shooter: "player" | "opponent"
): { state: GameState; result: ShotResult } {
  // Определяем по чьему полю стреляем
  const isPlayerShooting = shooter === "player";
  const targetBoard = isPlayerShooting
    ? state.opponentBoard.map(r => [...r]) as Board
    : state.playerBoard.map(r => [...r]) as Board;
  const targetShips = isPlayerShooting
    ? state.opponentShips.map(s => ({ ...s }))
    : state.playerShips.map(s => ({ ...s }));

  const cellState = targetBoard[row][col];
  if (cellState === "hit" || cellState === "miss" || cellState === "sunk") {
    throw new Error("Cell already shot");
  }

  const hit = cellState === "ship";
  let sunk = false;
  let shipId: number | undefined;

  if (hit) {
    targetBoard[row][col] = "hit";
    // Находим корабль которому досталось
    const shipIndex = targetShips.findIndex(s =>
      s.cells.some(([r, c]) => r === row && c === col)
    );
    if (shipIndex !== -1) {
      targetShips[shipIndex] = {
        ...targetShips[shipIndex],
        hits: targetShips[shipIndex].hits + 1,
      };
      shipId = targetShips[shipIndex].id;
      // Если попаданий столько же сколько размер — потоплен
      if (targetShips[shipIndex].hits >= targetShips[shipIndex].size) {
        sunk = true;
        // Помечаем все клетки корабля как "sunk"
        for (const [r, c] of targetShips[shipIndex].cells) {
          targetBoard[r][c] = "sunk";
        }
        // Закрашиваем клетки вокруг потопленного корабля как "miss"
        for (const [r, c] of targetShips[shipIndex].cells) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && targetBoard[nr][nc] === "empty") {
                targetBoard[nr][nc] = "miss";
              }
            }
          }
        }
      }
    }
  } else {
    targetBoard[row][col] = "miss";
  }

  // Проверка победы — все корабли потоплены
  const allSunk = targetShips.every(s => s.hits >= s.size);
  const gameOver = allSunk;
  const winner = gameOver ? shooter : undefined;

  const newState: GameState = {
    ...state,
    opponentBoard: isPlayerShooting ? targetBoard : state.opponentBoard,
    playerBoard: isPlayerShooting ? state.playerBoard : targetBoard,
    opponentShips: isPlayerShooting ? targetShips : state.opponentShips,
    playerShips: isPlayerShooting ? state.playerShips : targetShips,
    // При попадании ход не меняется (можно стрелять снова)
    currentTurn: hit ? state.currentTurn : (isPlayerShooting ? "opponent" : "player"),
    phase: gameOver ? "finished" : state.phase,
    winner: gameOver ? shooter : null,
    lastHit: [row, col],
  };

  return {
    state: newState,
    result: { row, col, hit, sunk, shipId, gameOver, winner: winner as any },
  };
}

/** Сериализация для базы данных (компактный JSON) */
export interface BattleshipSnapshot {
  playerBoard: Board;
  opponentBoard: Board;
  playerShips: Ship[];
  opponentShips: Ship[];
  currentTurn: "player" | "opponent";
  phase: string;
  winner: string | null;
}

export function serializeState(state: GameState): string {
  return JSON.stringify({
    playerBoard: state.playerBoard,
    opponentBoard: state.opponentBoard,
    playerShips: state.playerShips,
    opponentShips: state.opponentShips,
    currentTurn: state.currentTurn,
    phase: state.phase,
    winner: state.winner,
  });
}

export function deserializeState(json: string): GameState {
  const data = JSON.parse(json);
  return { ...data, lastHit: null };
}
