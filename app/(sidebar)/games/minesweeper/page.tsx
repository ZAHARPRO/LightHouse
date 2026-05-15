"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { awardGameBadge } from "@/actions/badges";
import { Flag, Bomb, RotateCcw, Trophy, Link } from "lucide-react";
import { playSound, preloadSounds } from "@/lib/gameSounds";

type ActionEntry = {
  type: "reveal" | "flag" | "unflag";
  r: number; c: number;
  board: Cell[][];
  minesLeft: number;
};


type Difficulty = "easy" | "medium" | "hard";
type GameState = "idle" | "playing" | "won" | "lost";

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
}

const DIFFICULTIES: Record<Difficulty, { label: string }> = {
  easy:   { label: "Easy" },
  medium: { label: "Normal" },
  hard:   { label: "Hard" },
};

const DIFF_RANGES: Record<Difficulty, { minCols: number; maxCols: number; minRows: number; maxRows: number; density: number }> = {
  easy:   { minCols: 8,  maxCols: 12, minRows: 8,  maxRows: 12, density: 0.123 },
  medium: { minCols: 13, maxCols: 20, minRows: 13, maxRows: 20, density: 0.155 },
  hard:   { minCols: 18, maxCols: 28, minRows: 14, maxRows: 22, density: 0.206 },
};

function genBoard(difficulty: Difficulty): { rows: number; cols: number; mines: number } {
  const r = DIFF_RANGES[difficulty];
  const screenW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const maxColsByScreen = Math.floor((screenW - 32) / 24);
  const maxCols = Math.min(r.maxCols, Math.max(r.minCols, maxColsByScreen));
  const cols  = r.minCols + Math.floor(Math.random() * (maxCols - r.minCols + 1));
  const rows  = r.minRows + Math.floor(Math.random() * (r.maxRows - r.minRows + 1));
  const mines = Math.max(1, Math.round(cols * rows * r.density));
  return { rows, cols, mines };
}

function useCellPx(cols: number) {
  const [px, setPx] = useState(30);
  useEffect(() => {
    function compute() {
      const gap = 2;
      const fromW = Math.floor((window.innerWidth - 32 - (cols - 1) * gap) / cols);
      setPx(Math.max(22, Math.min(36, fromW)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [cols]);
  return px;
}

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

function ReplayPanel({
  actions,
  replayIdx,
  onReplay,
  actionsRef,
}: {
  actions: ActionEntry[];
  replayIdx: number | null;
  onReplay: (idx: number | null) => void;
  actionsRef: React.RefObject<HTMLDivElement>;
}) {
  if (actions.length === 0) return null;
  const atLive = replayIdx === null;
  return (
    <div className="flex flex-col gap-2 w-full max-w-xs">
      <div
        ref={actionsRef}
        className="h-36 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 flex flex-col gap-0.5"
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => onReplay(i)}
            className={`text-left text-xs px-2 py-0.5 rounded transition-colors font-mono ${
              (replayIdx === i || (replayIdx === null && i === actions.length - 1))
                ? "bg-orange-500/20 text-[var(--accent-orange)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {i + 1}. {a.type === "reveal" ? "↗" : a.type === "flag" ? "⚑" : "⚐"} ({a.r},{a.c})
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 justify-center">
        <button
          onClick={() => onReplay(0)}
          disabled={replayIdx === 0}
          className="px-2 py-1 rounded text-xs border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors"
        >«</button>
        <button
          onClick={() => onReplay(replayIdx !== null && replayIdx > 0 ? replayIdx - 1 : 0)}
          disabled={replayIdx === 0 || replayIdx === null}
          className="px-2 py-1 rounded text-xs border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors"
        >‹</button>
        <button
          onClick={() => onReplay(replayIdx !== null && replayIdx < actions.length - 1 ? replayIdx + 1 : actions.length - 1)}
          disabled={atLive}
          className="px-2 py-1 rounded text-xs border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors"
        >›</button>
        <button
          onClick={() => onReplay(null)}
          disabled={atLive}
          className="px-2 py-1 rounded text-xs border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors"
        >»</button>
        {!atLive && (
          <span className="text-xs text-[var(--text-muted)] ml-1">
            {replayIdx! + 1}/{actions.length}
          </span>
        )}
      </div>
    </div>
  );
}

export default function GamesPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [board, setBoard] = useState<Cell[][]>([]);
  const [minesLeft, setMinesLeft] = useState(0);
  const [firstClick, setFirstClick] = useState(true);
  const [hitPos, setHitPos] = useState<{ r: number; c: number } | null>(null);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressCell  = useRef<{ r: number; c: number } | null>(null);
  const pressDidFlag = useRef(false);

  useEffect(() => { preloadSounds(); }, []);

  const [cfg, setCfg] = useState<{ rows: number; cols: number; mines: number }>({ rows: 9, cols: 9, mines: 10 });
  const cellPx = useCellPx(cfg.cols);

  useEffect(() => {
    if (replayIdx === null && actionsRef.current)
      actionsRef.current.scrollTop = actionsRef.current.scrollHeight;
  }, [actions.length, replayIdx]);

  const startGame = useCallback((diff: Difficulty = difficulty) => {
    setDifficulty(diff);
    const newCfg = genBoard(diff);
    setCfg(newCfg);
    setBoard(createEmptyBoard(newCfg.rows, newCfg.cols));
    setMinesLeft(newCfg.mines);
    setGameState("playing");
    setFirstClick(true);
    setHitPos(null);
    setActions([]);
    setReplayIdx(null);
  }, [difficulty]);

  const handleReveal = useCallback((r: number, c: number) => {
    if (gameState !== "playing" || replayIdx !== null) return;

    let b = board.map(row => row.map(cell => ({ ...cell })));
    if (b[r][c].isRevealed || b[r][c].isFlagged) return;

    if (firstClick) {
      b = placeMines(b, cfg.mines, r, c);
      setFirstClick(false);
    }

    if (b[r][c].isMine) {
      b = b.map(row => row.map(cell => cell.isMine ? { ...cell, isRevealed: true } : cell));
      setHitPos({ r, c });
      setBoard(b);
      setActions(prev => [...prev, { type: "reveal", r, c, board: b, minesLeft }]);
      setGameState("lost");
      playSound("mine_explode");
      return;
    }

    b = floodReveal(b, r, c);
    setBoard(b);
    setActions(prev => [...prev, { type: "reveal", r, c, board: b, minesLeft }]);
    playSound("cell_reveal");

    const unrevealed = b.flat().filter(cell => !cell.isRevealed && !cell.isMine).length;
    if (unrevealed === 0) {
      setGameState("won");
      playSound("mine_win");
      awardGameBadge("MINESWEEPER_WIN").catch(() => {});
      if (difficulty === "hard") awardGameBadge("MINESWEEPER_EXPERT").catch(() => {});
    }
  }, [gameState, firstClick, cfg.mines, difficulty, board, minesLeft, replayIdx]);

  const toggleFlag = useCallback((r: number, c: number) => {
    if (gameState !== "playing" || replayIdx !== null) return;
    if (board[r][c].isRevealed) return;
    const willFlag = !board[r][c].isFlagged;
    const newMinesLeft = minesLeft + (willFlag ? -1 : 1);
    setMinesLeft(newMinesLeft);
    const b = board.map(row => row.map(cell => ({ ...cell })));
    b[r][c].isFlagged = !b[r][c].isFlagged;
    setBoard(b);
    setActions(prev => [...prev, {
      type: willFlag ? "flag" as const : "unflag" as const,
      r, c, board: b, minesLeft: newMinesLeft,
    }]);
    playSound(willFlag ? "flag_place" : "flag_remove");
    navigator.vibrate?.(30);
  }, [gameState, board, minesLeft, replayIdx]);

  const handleFlag = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    toggleFlag(r, c);
  }, [toggleFlag]);

  function handlePointerDown(r: number, c: number, e: React.PointerEvent) {
    if (e.button !== 0) return; // right-click handled by onContextMenu
    if (gameState !== "playing" || replayIdx !== null) return;
    e.preventDefault();
    pressCell.current = { r, c };
    pressDidFlag.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      pressDidFlag.current = true;
      toggleFlag(r, c);
    }, 450);
  }

  function handlePointerUp(r: number, c: number) {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (!pressDidFlag.current && pressCell.current?.r === r && pressCell.current?.c === c) {
      handleReveal(r, c);
    }
    pressCell.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pressTimer.current && Math.hypot(e.movementX, e.movementY) > 6) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  const displayBoard = replayIdx !== null ? (actions[replayIdx]?.board ?? board) : board;
  const displayMinesLeft = replayIdx !== null ? (actions[replayIdx]?.minesLeft ?? minesLeft) : minesLeft;

  const iconSz = Math.max(9, Math.round(cellPx * 0.42));

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-12 flex flex-col items-center">
           <div className="flex items-center gap-3 mb-2">
        <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Games</Link>
      </div>
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
              {DIFF_RANGES[diff].minCols}-{DIFF_RANGES[diff].maxCols}×{DIFF_RANGES[diff].minRows}-{DIFF_RANGES[diff].maxRows}
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
              {displayMinesLeft}
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
              {displayBoard.map((row, r) =>
                row.map((cell, c) => {
                  let bg = "bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border-[var(--border-subtle)]";
                  let content: React.ReactNode = null;

                  if (cell.isRevealed) {
                    if (cell.isMine) {
                      const isDeath = hitPos?.r === r && hitPos?.c === c;
                      bg = isDeath
                        ? "bg-red-500/55 border-red-500/70"
                        : gameState === "lost"
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-[var(--bg-card)] border-[var(--border-subtle)]";
                      content = (
                        <Bomb
                          size={iconSz}
                          className={isDeath ? "text-red-400" : "text-red-400/40"}
                          style={isDeath ? { filter: "drop-shadow(0 0 4px rgba(239,68,68,0.8))" } : undefined}
                        />
                      );
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
                    content = <Flag size={iconSz} className="text-[var(--accent-orange)]" />;
                  }

                  return (
                    <button
                      key={`${r}-${c}`}
                      className={`flex items-center justify-center rounded border transition-colors duration-75 ${replayIdx !== null ? "cursor-default" : "cursor-pointer"} ${bg}`}
                      style={{ width: cellPx, height: cellPx, fontSize: Math.max(10, Math.round(cellPx * 0.38)), touchAction: "manipulation" }}
                      onPointerDown={e => handlePointerDown(r, c, e)}
                      onPointerUp={() => handlePointerUp(r, c)}
                      onPointerMove={handlePointerMove}
                      onPointerLeave={() => {
                        if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
                      }}
                      onContextMenu={e => { e.preventDefault(); if (replayIdx === null) handleFlag(e, r, c); }}
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-[0.7rem] text-[var(--text-muted)] text-center md:hidden">
            Tap to reveal · Hold to flag 🚩
          </p>

          <ReplayPanel
            actions={actions}
            replayIdx={replayIdx}
            onReplay={setReplayIdx}
            actionsRef={actionsRef}
          />
        </div>
      )}
    </main>
  );
}
