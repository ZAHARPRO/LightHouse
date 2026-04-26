"use client";

import { useState, useCallback } from "react";
import { awardGameBadge } from "@/actions/badges";
import { Flag, Bomb, RotateCcw, Trophy } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";
type GameState = "idle" | "playing" | "won" | "lost";

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
}

const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number; label: string }> = {
  easy:   { rows: 9,  cols: 9,  mines: 10, label: "Easy" },
  medium: { rows: 16, cols: 16, mines: 40, label: "Normal" },
  hard:   { rows: 16, cols: 30, mines: 99, label: "Hard" },
};

const NEIGHBOR_COLORS: Record<number, string> = {
  1: "text-blue-400",
  2: "text-green-400",
  3: "text-red-400",
  4: "text-purple-400",
  5: "text-orange-400",
  6: "text-cyan-400",
  7: "text-pink-400",
  8: "text-gray-300",
};

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborCount: 0,
    }))
  );
}

function placeMines(board: Cell[][], mines: number, firstR: number, firstC: number): Cell[][] {
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map(row => row.map(cell => ({ ...cell })));

  const safe = new Set<string>();
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      safe.add(`${firstR + dr},${firstC + dc}`);

  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!next[r][c].isMine && !safe.has(`${r},${c}`)) {
      next[r][c].isMine = true;
      placed++;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (next[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && next[nr][nc].isMine) count++;
        }
      next[r][c].neighborCount = count;
    }
  }
  return next;
}

function floodReveal(board: Cell[][], startR: number, startC: number): Cell[][] {
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map(row => row.map(cell => ({ ...cell })));
  const queue: [number, number][] = [[startR, startC]];

  while (queue.length) {
    const [r, c] = queue.shift()!;
    if (next[r][c].isRevealed || next[r][c].isFlagged) continue;
    next[r][c].isRevealed = true;

    if (next[r][c].neighborCount === 0) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !next[nr][nc].isRevealed)
            queue.push([nr, nc]);
        }
    }
  }
  return next;
}

export default function GamesPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [board, setBoard] = useState<Cell[][]>([]);
  const [minesLeft, setMinesLeft] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  const cfg = DIFFICULTIES[difficulty];

  const startGame = useCallback((diff: Difficulty = difficulty) => {
    setDifficulty(diff);
    setBoard(createEmptyBoard(DIFFICULTIES[diff].rows, DIFFICULTIES[diff].cols));
    setMinesLeft(DIFFICULTIES[diff].mines);
    setGameState("playing");
    setFirstClick(true);
  }, [difficulty]);

  const handleReveal = useCallback((r: number, c: number) => {
    if (gameState !== "playing") return;

    setBoard(prev => {
      let b = prev.map(row => row.map(cell => ({ ...cell })));
      if (b[r][c].isRevealed || b[r][c].isFlagged) return prev;

      if (firstClick) {
        b = placeMines(b, cfg.mines, r, c);
        setFirstClick(false);
      }

      if (b[r][c].isMine) {
        b = b.map(row => row.map(cell => cell.isMine ? { ...cell, isRevealed: true } : cell));
        setGameState("lost");
        return b;
      }

      b = floodReveal(b, r, c);

      const unrevealed = b.flat().filter(cell => !cell.isRevealed && !cell.isMine).length;
      if (unrevealed === 0) {
        setGameState("won");
        awardGameBadge("MINESWEEPER_WIN").catch(() => {});
        if (difficulty === "hard") awardGameBadge("MINESWEEPER_EXPERT").catch(() => {});
      }

      return b;
    });
  }, [gameState, firstClick, cfg.mines, difficulty]);

  const handleFlag = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (gameState !== "playing") return;
    if (board[r][c].isRevealed) return;

    const willFlag = !board[r][c].isFlagged;
    setMinesLeft(m => willFlag ? m - 1 : m + 1);
    setBoard(prev => {
      const b = prev.map(row => row.map(cell => ({ ...cell })));
      b[r][c].isFlagged = !b[r][c].isFlagged;
      return b;
    });
  }, [gameState, board]);

  const cellSize = difficulty === "hard" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-12 flex flex-col items-center">
      <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)] mb-2">
        Mini Games
      </h1>
      <p className="text-[var(--text-muted)] mb-10">Minesweeper</p>

      <div className="flex flex-wrap gap-3 mb-6 justify-center">
        {(Object.keys(DIFFICULTIES) as Difficulty[]).map(diff => (
          <button
            key={diff}
            onClick={() => {
              setDifficulty(diff);
              if (gameState !== "idle") startGame(diff);
            }}
            className={`px-5 py-2 rounded-lg font-display font-semibold text-sm border transition-all duration-150 ${
              difficulty === diff
                ? "bg-orange-500/15 border-orange-500/50 text-[var(--accent-orange)]"
                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {DIFFICULTIES[diff].label}
            <span className="ml-2 text-[0.7rem] opacity-60">
              {DIFFICULTIES[diff].cols}×{DIFFICULTIES[diff].rows} · {DIFFICULTIES[diff].mines} мин
            </span>
          </button>
        ))}
      </div>

      {gameState === "idle" ? (
        <div className="flex flex-col items-center justify-center gap-6 py-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] w-full max-w-2xl">
          <Bomb size={48} className="text-[var(--accent-orange)] opacity-60" />
          <p className="text-[var(--text-secondary)] font-display font-medium text-center">
            Choose a difficulty and start playing — click cells and avoid the mines!
          </p>
          <button
            onClick={() => startGame()}
            className="px-8 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Start Game
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-display font-semibold text-sm">
              <Flag size={15} className="text-[var(--accent-orange)]" />
              {minesLeft}
            </div>

            <button
              onClick={() => startGame()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-semibold text-sm hover:text-[var(--text-primary)] transition-colors"
            >
              <RotateCcw size={14} />
              New Game
            </button>

            {gameState === "won" && (
              <span className="flex items-center gap-2 text-green-400 font-display font-bold text-sm">
                <Trophy size={15} /> Victory!
              </span>
            )}
            {gameState === "lost" && (
              <span className="flex items-center gap-2 text-red-400 font-display font-bold text-sm">
                <Bomb size={15} /> Blast!
              </span>
            )}
          </div>

          {/* CENTERED + RESPONSIVE BOARD WRAPPER */}
          <div className="w-full flex justify-center overflow-x-auto">
            <div
              className="inline-grid gap-[2px] mx-auto"
              style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
              onContextMenu={e => e.preventDefault()}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  let bg = "bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border-[var(--border-subtle)]";
                  let content: React.ReactNode = null;

                  if (cell.isRevealed) {
                    if (cell.isMine) {
                      bg = gameState === "lost"
                        ? "bg-red-500/20 border-red-500/40"
                        : "bg-[var(--bg-card)] border-[var(--border-subtle)]";
                      content = <Bomb size={12} className="text-red-400" />;
                    } else {
                      bg = "bg-[var(--bg-secondary)] border-[var(--border-subtle)]";
                      if (cell.neighborCount > 0) {
                        content = (
                          <span className={`font-display font-bold ${NEIGHBOR_COLORS[cell.neighborCount]}`}>
                            {cell.neighborCount}
                          </span>
                        );
                      }
                    }
                  } else if (cell.isFlagged) {
                    content = <Flag size={12} className="text-[var(--accent-orange)]" />;
                  }

                  return (
                    <button
                      key={`${r}-${c}`}
                      className={`${cellSize} flex items-center justify-center rounded border transition-colors duration-75 cursor-pointer ${bg}`}
                      onClick={() => handleReveal(r, c)}
                      onContextMenu={e => handleFlag(e, r, c)}
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
