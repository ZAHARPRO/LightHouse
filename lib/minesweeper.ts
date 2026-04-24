export const DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10, label: "Легко" },
  medium: { rows: 16, cols: 16, mines: 40, label: "Средне" },
  hard:   { rows: 16, cols: 30, mines: 99, label: "Сложно" },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export function generateMines(rows: number, cols: number, count: number, safeIdx?: number): number[] {
  const safe = new Set<number>();
  if (safeIdx !== undefined) {
    const sr = Math.floor(safeIdx / cols), sc = safeIdx % cols;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = sr + dr, nc = sc + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) safe.add(nr * cols + nc);
      }
  }
  const pool = Array.from({ length: rows * cols }, (_, i) => i).filter(i => !safe.has(i));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function computeNeighbors(rows: number, cols: number, mineSet: Set<number>): number[] {
  const n = new Array<number>(rows * cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (mineSet.has(idx)) { n[idx] = -1; continue; }
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && mineSet.has(nr * cols + nc)) cnt++;
        }
      n[idx] = cnt;
    }
  }
  return n;
}

export function floodReveal(
  rows: number, cols: number,
  mineSet: Set<number>, neighbors: number[],
  revealed: Set<number>, startIdx: number,
): Set<number> {
  if (mineSet.has(startIdx) || revealed.has(startIdx)) return revealed;
  const next = new Set(revealed);
  const q = [startIdx];
  while (q.length) {
    const idx = q.shift()!;
    if (next.has(idx)) continue;
    next.add(idx);
    if (neighbors[idx] === 0) {
      const r = Math.floor(idx / cols), c = idx % cols;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const ni = nr * cols + nc;
            if (!next.has(ni) && !mineSet.has(ni)) q.push(ni);
          }
        }
    }
  }
  return next;
}

export function checkWin(rows: number, cols: number, mineCount: number, revealed: Set<number>): boolean {
  return revealed.size >= rows * cols - mineCount;
}
