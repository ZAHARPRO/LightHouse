// lib/battleship-bot.ts
import { Board, Ship, applyShot, GameState, ShotResult } from "./battleship";

// ─── Типы сложности ──────────────────────────────────────────────────────────

export type BotDifficulty = "easy" | "medium" | "hard";

// Внутреннее состояние бота (хранится между ходами в сессии)
export interface BotMemory {
  // Клетки куда ещё не стреляли
  untried: [number, number][];
  // При попадании — список направлений для продолжения
  hitQueue: [number, number][];
  // Последнее успешное попадание (для направленной стрельбы)
  lastHit: [number, number] | null;
  // Направление в котором бот "ведёт" корабль
  currentDirection: [number, number] | null;
}

/** Создаёт начальную память бота */
export function createBotMemory(): BotMemory {
  const untried: [number, number][] = [];
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      untried.push([r, c]);
  return { untried, hitQueue: [], lastHit: null, currentDirection: null };
}

/**
 * Выбирает следующий выстрел бота.
 * Easy   — полностью случайный
 * Medium — случайный + продолжает стрелять в направлении после попадания
 * Hard   — шахматный паттерн + умная охота
 */
export function getBotShot(
  opponentBoard: Board, // поле игрока (бот видит hit/miss/sunk/empty; ship скрыто)
  memory: BotMemory,
  difficulty: BotDifficulty
): { row: number; col: number; updatedMemory: BotMemory } {
  const mem = { ...memory, untried: [...memory.untried], hitQueue: [...memory.hitQueue] };

  let row: number, col: number;

  if (difficulty === "easy") {
    // Просто случайная клетка из непростреленных
    const idx = Math.floor(Math.random() * mem.untried.length);
    [row, col] = mem.untried.splice(idx, 1)[0];

  } else if (difficulty === "medium") {
    // Если есть очередь "целевых" клеток — стреляем по ним
    if (mem.hitQueue.length > 0) {
      // Проверяем что клетка ещё не простреляна
      let found = false;
      while (mem.hitQueue.length > 0 && !found) {
        const candidate = mem.hitQueue.shift()!;
        const existing = opponentBoard[candidate[0]][candidate[1]];
        if (existing === "empty" || existing === "ship") {
          [row, col] = candidate;
          // Убираем из untried тоже
          const ui = mem.untried.findIndex(([r, c]) => r === candidate[0] && c === candidate[1]);
          if (ui !== -1) mem.untried.splice(ui, 1);
          found = true;
        }
      }
      if (!found) {
        const idx = Math.floor(Math.random() * mem.untried.length);
        [row, col] = mem.untried.splice(idx, 1)[0];
      }
    } else {
      const idx = Math.floor(Math.random() * mem.untried.length);
      [row, col] = mem.untried.splice(idx, 1)[0];
    }

  } else {
    // Hard: шахматный паттерн (стреляем только в клетки где (r+c)%2===0)
    // + направленная охота после попадания
    if (mem.hitQueue.length > 0) {
      let found = false;
      while (mem.hitQueue.length > 0 && !found) {
        const candidate = mem.hitQueue.shift()!;
        const existing = opponentBoard[candidate[0]][candidate[1]];
        if (existing === "empty" || existing === "ship") {
          [row, col] = candidate;
          const ui = mem.untried.findIndex(([r, c]) => r === candidate[0] && c === candidate[1]);
          if (ui !== -1) mem.untried.splice(ui, 1);
          found = true;
        }
      }
      if (!found) {
        // Шахматный паттерн
        const checkerboard = mem.untried.filter(([r, c]) => (r + c) % 2 === 0);
        const pool = checkerboard.length > 0 ? checkerboard : mem.untried;
        const idx = Math.floor(Math.random() * pool.length);
        [row, col] = pool[idx];
        const ui = mem.untried.findIndex(([r, c]) => r === row && c === col);
        if (ui !== -1) mem.untried.splice(ui, 1);
      }
    } else {
      const checkerboard = mem.untried.filter(([r, c]) => (r + c) % 2 === 0);
      const pool = checkerboard.length > 0 ? checkerboard : mem.untried;
      const idx = Math.floor(Math.random() * pool.length);
      [row, col] = pool[idx];
      const ui = mem.untried.findIndex(([r, c]) => r === row && c === col);
      if (ui !== -1) mem.untried.splice(ui, 1);
    }
  }

  return { row: row!, col: col!, updatedMemory: mem };
}

/**
 * Обновляет память бота после результата выстрела.
 * При попадании — добавляет соседей в очередь.
 * При потоплении — очищает очередь.
 */
export function updateBotMemory(
  memory: BotMemory,
  result: ShotResult,
  difficulty: BotDifficulty
): BotMemory {
  if (difficulty === "easy") return memory; // easy не запоминает

  const mem = { ...memory, hitQueue: [...memory.hitQueue] };

  if (result.sunk) {
    // Корабль потоплен — очищаем очередь, начинаем заново
    mem.hitQueue = [];
    mem.lastHit = null;
    mem.currentDirection = null;
  } else if (result.hit) {
    mem.lastHit = [result.row, result.col];
    // Добавляем соседей (4 направления)
    const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
      const nr = result.row + dr;
      const nc = result.col + dc;
      if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
        // Не добавляем уже простреленные или уже в очереди
        const alreadyQueued = mem.hitQueue.some(([r, c]) => r === nr && c === nc);
        if (!alreadyQueued) {
          mem.hitQueue.push([nr, nc]);
        }
      }
    }
    // Hard: если есть направление — приоритизируем продолжение
    if (difficulty === "hard" && mem.lastHit) {
      // Можно добавить логику направления здесь
    }
  }

  return mem;
}
