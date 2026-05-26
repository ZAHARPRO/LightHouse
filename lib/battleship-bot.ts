import { Board, ShotResult, SHIP_SIZES } from "./battleship";

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotMemory {
  untried: [number, number][];
  hitQueue: [number, number][];
  lastHit: [number, number] | null;
  firstHit: [number, number] | null;
  currentDirection: [number, number] | null;
  remainingSizes: number[];
  currentHitCount: number;
}

export function createBotMemory(): BotMemory {
  const untried: [number, number][] = [];
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      untried.push([r, c]);
  return {
    untried,
    hitQueue: [],
    lastHit: null,
    firstHit: null,
    currentDirection: null,
    remainingSizes: [...SHIP_SIZES],
    currentHitCount: 0,
  };
}

// ── Probability density map ───────────────────────────────────────────────────
function buildProbabilityMap(board: Board, remainingSizes: number[]): number[][] {
  const prob = Array.from({ length: 10 }, () => new Array<number>(10).fill(0));

  for (const size of remainingSizes) {
    // Horizontal placements
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c <= 10 - size; c++) {
        let valid = true;
        let hasHit = false;
        for (let i = 0; i < size; i++) {
          const cell = board[r][c + i];
          if (cell === "miss" || cell === "sunk") { valid = false; break; }
          if (cell === "hit") hasHit = true;
        }
        if (valid) {
          // Positions overlapping known hits are far more likely
          const w = hasHit ? 4 : 1;
          for (let i = 0; i < size; i++) prob[r][c + i] += w;
        }
      }
    }
    // Vertical placements
    for (let r = 0; r <= 10 - size; r++) {
      for (let c = 0; c < 10; c++) {
        let valid = true;
        let hasHit = false;
        for (let i = 0; i < size; i++) {
          const cell = board[r + i][c];
          if (cell === "miss" || cell === "sunk") { valid = false; break; }
          if (cell === "hit") hasHit = true;
        }
        if (valid) {
          const w = hasHit ? 4 : 1;
          for (let i = 0; i < size; i++) prob[r + i][c] += w;
        }
      }
    }
  }

  return prob;
}

function removeFromUntried(untried: [number, number][], r: number, c: number): void {
  const idx = untried.findIndex(([ur, uc]) => ur === r && uc === c);
  if (idx !== -1) untried.splice(idx, 1);
}

function isUnshotCell(board: Board, r: number, c: number): boolean {
  return r >= 0 && r < 10 && c >= 0 && c < 10 && (board[r][c] === "empty" || board[r][c] === "ship");
}

// ── Easy: pure random ─────────────────────────────────────────────────────────
function easyPick(mem: BotMemory): [number, number] {
  const idx = Math.floor(Math.random() * mem.untried.length);
  return mem.untried.splice(idx, 1)[0];
}

// ── Medium: random + direction tracking after hits ────────────────────────────
function mediumPick(board: Board, mem: BotMemory): [number, number] {
  // Follow current direction first
  if (mem.currentDirection && mem.lastHit) {
    const [dr, dc] = mem.currentDirection;
    const [lr, lc] = mem.lastHit;
    const nr = lr + dr, nc = lc + dc;
    if (isUnshotCell(board, nr, nc)) {
      removeFromUntried(mem.untried, nr, nc);
      return [nr, nc];
    }
    // Direction blocked — try reverse from firstHit
    if (mem.firstHit) {
      const [fr, fc] = mem.firstHit;
      const rr = fr - dr, rc = fc - dc;
      if (isUnshotCell(board, rr, rc)) {
        mem.currentDirection = [-dr, -dc];
        mem.lastHit = [fr, fc];
        removeFromUntried(mem.untried, rr, rc);
        return [rr, rc];
      }
    }
    // Both ends exhausted — fall through to hitQueue
    mem.currentDirection = null;
  }

  // Drain any remaining hitQueue
  while (mem.hitQueue.length > 0) {
    const [r, c] = mem.hitQueue.shift()!;
    if (isUnshotCell(board, r, c)) {
      removeFromUntried(mem.untried, r, c);
      return [r, c];
    }
  }

  // Random fallback
  const idx = Math.floor(Math.random() * mem.untried.length);
  return mem.untried.splice(idx, 1)[0];
}

// ── Hard: probability density map ────────────────────────────────────────────
function hardPick(board: Board, mem: BotMemory): [number, number] {
  const prob = buildProbabilityMap(board, mem.remainingSizes);

  // Boost cells aligned with a known hit direction (strong prior)
  if (mem.currentDirection && mem.lastHit) {
    const [dr, dc] = mem.currentDirection;
    const [lr, lc] = mem.lastHit;
    const nr = lr + dr, nc = lc + dc;
    if (isUnshotCell(board, nr, nc)) prob[nr][nc] += 1000;
    if (mem.firstHit) {
      const [fr, fc] = mem.firstHit;
      const rr = fr - dr, rc = fc - dc;
      if (isUnshotCell(board, rr, rc)) prob[rr][rc] += 500;
    }
  } else if (mem.hitQueue.length > 0) {
    // Boost all queued candidates
    for (const [r, c] of mem.hitQueue) {
      if (isUnshotCell(board, r, c)) prob[r][c] += 300;
    }
  }

  // Zero out already-shot cells
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (!isUnshotCell(board, r, c)) prob[r][c] = 0;

  // Find the highest-probability unshot cell
  let maxP = -1, bestR = 0, bestC = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (prob[r][c] > maxP) { maxP = prob[r][c]; bestR = r; bestC = c; }
    }
  }

  removeFromUntried(mem.untried, bestR, bestC);
  return [bestR, bestC];
}

// ── Public: choose shot ───────────────────────────────────────────────────────
export function getBotShot(
  board: Board,
  memory: BotMemory,
  difficulty: BotDifficulty,
): { row: number; col: number; updatedMemory: BotMemory } {
  const mem: BotMemory = {
    ...memory,
    untried: [...memory.untried],
    hitQueue: [...memory.hitQueue],
    remainingSizes: [...memory.remainingSizes],
  };

  let row: number, col: number;

  if (difficulty === "easy") {
    [row, col] = easyPick(mem);
  } else if (difficulty === "medium") {
    [row, col] = mediumPick(board, mem);
  } else {
    [row, col] = hardPick(board, mem);
  }

  return { row, col, updatedMemory: mem };
}

// ── Public: update memory after result ────────────────────────────────────────
export function updateBotMemory(
  memory: BotMemory,
  result: ShotResult,
  difficulty: BotDifficulty,
): BotMemory {
  if (difficulty === "easy") return memory;

  const mem: BotMemory = {
    ...memory,
    hitQueue: [...memory.hitQueue],
    remainingSizes: [...memory.remainingSizes],
  };

  if (result.sunk) {
    // Compute sunk ship size: currentHitCount hits so far + this final hit = size
    const shipSize = mem.currentHitCount + 1;
    const sizeIdx = mem.remainingSizes.indexOf(shipSize);
    if (sizeIdx !== -1) mem.remainingSizes.splice(sizeIdx, 1);

    // Clear hunt state
    mem.hitQueue = [];
    mem.lastHit = null;
    mem.firstHit = null;
    mem.currentDirection = null;
    mem.currentHitCount = 0;

  } else if (result.hit) {
    mem.currentHitCount++;
    const pos: [number, number] = [result.row, result.col];

    if (!mem.firstHit) {
      // First hit of a new ship: record it, queue all 4 neighbours
      mem.firstHit = pos;
      mem.lastHit = pos;
      const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        const nr = result.row + dr, nc = result.col + dc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
          if (!mem.hitQueue.some(([r, c]) => r === nr && c === nc)) {
            mem.hitQueue.push([nr, nc]);
          }
        }
      }
    } else {
      // Second+ hit: determine/confirm direction and focus the queue
      const [fr, fc] = mem.firstHit;
      const rawDr = result.row - fr, rawDc = result.col - fc;
      const dr = rawDr === 0 ? 0 : rawDr > 0 ? 1 : -1;
      const dc = rawDc === 0 ? 0 : rawDc > 0 ? 1 : -1;

      if (!mem.currentDirection ||
          mem.currentDirection[0] !== dr || mem.currentDirection[1] !== dc) {
        // New or different direction — rebuild queue along this axis
        mem.currentDirection = [dr, dc];
        mem.hitQueue = [];
        // Continue forward from this hit
        const nr = result.row + dr, nc = result.col + dc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) mem.hitQueue.push([nr, nc]);
        // Also queue the reverse end from firstHit
        const rr = fr - dr, rc = fc - dc;
        if (rr >= 0 && rr < 10 && rc >= 0 && rc < 10) mem.hitQueue.push([rr, rc]);
      } else {
        // Same direction — prepend continuation (higher priority)
        const nr = result.row + dr, nc = result.col + dc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 &&
            !mem.hitQueue.some(([r, c]) => r === nr && c === nc)) {
          mem.hitQueue.unshift([nr, nc]);
        }
      }
      mem.lastHit = pos;
    }
  }

  return mem;
}
