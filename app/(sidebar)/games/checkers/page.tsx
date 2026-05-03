"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { RotateCcw, Flag, Crown } from "lucide-react";
import {
  initialBoard, getLegalMoves, applyMove, canContinueJump, isGameOver, countPieces,
  type Board, type Cell, type Move,
} from "@/lib/checkers";
import { getBotMove, type Difficulty } from "@/lib/checkers-bot";
import { awardGameBadge } from "@/actions/badges";

type Status = "idle" | "playing" | "over";

const LIGHT_SQ = "#fef3c7"; // amber-100
const DARK_SQ  = "#78350f"; // amber-900

function useCellPx() {
  const [cellPx, setCellPx] = useState(56);
  useEffect(() => {
    function compute() {
      const isLg = window.innerWidth >= 1024;
      const SIDE = isLg ? 272 : 0;
      const RANK = 20;
      const PAD = isLg ? 32 : 16;
      const PLAYER_ROWS = 108;
      const availH = Math.floor((window.innerHeight - 64 - PAD - PLAYER_ROWS) / 8);
      const availW = Math.floor((window.innerWidth - SIDE - PAD - RANK) / 8);
      setCellPx(Math.max(36, Math.min(82, availH, availW)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return cellPx;
}

function Piece({ cell, cellPx, dragging }: { cell: Cell; cellPx: number; dragging?: boolean }) {
  if (!cell) return null;
  const isWhite = cell === "w" || cell === "W";
  const king    = cell === "W" || cell === "B";
  const size = Math.round(cellPx * 0.72);
  const crown = Math.round(cellPx * 0.32);
  return (
    <div className="relative flex items-center justify-center select-none pointer-events-none"
      style={{ width: size, height: size, opacity: dragging ? 0.3 : 1 }}>
      <div className="absolute inset-0 rounded-full"
        style={{
          background: isWhite
            ? "radial-gradient(circle at 38% 35%, #fef9ee, #d97706)"
            : "radial-gradient(circle at 38% 35%, #6b7280, #1f2937)",
          boxShadow: isWhite
            ? "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.4)"
            : "0 2px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.15)",
        }}
      />
      {king && (
        <Crown size={crown} className="relative z-10"
          style={{ color: isWhite ? "#92400e" : "#d1d5db", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
        />
      )}
    </div>
  );
}

interface BoardProps {
  board: Board;
  cellPx: number;
  selected: [number, number] | null;
  legalDots: [number, number][];
  lastMove: Move | null;
  mustJumpFrom: [number, number] | null;
  onSquare: (r: number, c: number) => void;
  onDrop: (from: [number, number], to: [number, number]) => void;
  disabled?: boolean;
}

function CheckersBoard({ board, cellPx, selected, legalDots, lastMove, mustJumpFrom, onSquare, onDrop, disabled }: BoardProps) {
  const [ghost, setGhost] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const dragSrc = useRef<[number, number] | null>(null);

  function startDrag(e: React.PointerEvent, r: number, c: number, cell: Cell) {
    if (disabled || !cell) return;
    e.preventDefault();
    onSquare(r, c);
    dragSrc.current = [r, c];
    setGhost({ cell, x: e.clientX, y: e.clientY });
    const onMove = (ev: PointerEvent) => setGhost(g => g ? { ...g, x: ev.clientX, y: ev.clientY } : null);
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", onMove);
      setGhost(null);
      const src = dragSrc.current;
      dragSrc.current = null;
      if (!src) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const sq = el?.closest("[data-sq]")?.getAttribute("data-sq");
      if (sq) {
        const [tr, tc] = sq.split("-").map(Number);
        if (tr !== src[0] || tc !== src[1]) onDrop(src, [tr, tc]);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <>
      <div className="inline-block select-none" style={{ border: "2px solid #92400e" }}>
        {[7,6,5,4,3,2,1,0].map(r => (
          <div key={r} className="flex">
            <div className="flex items-center justify-center font-mono shrink-0"
              style={{ width: 20, color: "#92400e", fontSize: Math.max(9, cellPx * 0.18) }}>
              {r + 1}
            </div>
            {[0,1,2,3,4,5,6,7].map(c => {
              const isDark = (r + c) % 2 === 1;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isLM = lastMove && (
                (lastMove.from[0] === r && lastMove.from[1] === c) ||
                (lastMove.to[0] === r && lastMove.to[1] === c)
              );
              const isDot = legalDots.some(([lr, lc]) => lr === r && lc === c);
              const isMust = mustJumpFrom?.[0] === r && mustJumpFrom?.[1] === c;
              const cell = board[r][c];
              let bg = isDark ? DARK_SQ : LIGHT_SQ;
              if (isSel || isLM) bg = "#fde047"; // yellow-300
              const isDragging = dragSrc.current?.[0] === r && dragSrc.current?.[1] === c;
              return (
                <div key={c} data-sq={`${r}-${c}`}
                  className="relative flex items-center justify-center cursor-pointer"
                  style={{ width: cellPx, height: cellPx, background: bg, flexShrink: 0 }}
                  onClick={() => !disabled && onSquare(r, c)}
                >
                  {isDot && isDark && (
                    <div className={["absolute rounded-full pointer-events-none z-10",
                      cell ? "inset-0 border-4 border-yellow-400/60 rounded-none" : "w-[34%] h-[34%]",
                      cell ? "" : "bg-yellow-400/50 rounded-full"
                    ].join(" ")} />
                  )}
                  {isMust && (
                    <div className="absolute inset-0 rounded-none border-[3px] border-red-400 animate-pulse pointer-events-none z-20" />
                  )}
                  {cell && (
                    <div onPointerDown={e => startDrag(e, r, c, cell)} style={{ cursor: disabled ? "default" : "grab" }}>
                      <Piece cell={cell} cellPx={cellPx} dragging={isDragging} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex" style={{ marginLeft: 20 }}>
          {[0,1,2,3,4,5,6,7].map(c => (
            <div key={c} style={{ width: cellPx, textAlign: "center", fontSize: Math.max(9, cellPx * 0.16), color: "#92400e", fontFamily: "monospace" }}>
              {String.fromCharCode(97 + c)}
            </div>
          ))}
        </div>
      </div>

      {ghost && typeof document !== "undefined" && (
        <div className="fixed pointer-events-none z-[9999] select-none flex items-center justify-center"
          style={{ left: ghost.x - cellPx / 2, top: ghost.y - cellPx / 2, width: cellPx, height: cellPx }}>
          <div style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.55))", transform: "scale(1.18)" }}>
            <Piece cell={ghost.cell} cellPx={cellPx} />
          </div>
        </div>
      )}
    </>
  );
}

function PlayerRow({
  label, color, active, pieces,
}: { label: string; color: "w" | "b"; active?: boolean; pieces: number }) {
  return (
    <div className="flex items-center gap-2.5 py-2 min-h-[44px]">
      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
        style={{
          background: color === "w"
            ? "radial-gradient(circle at 38% 35%, #fef9ee, #d97706)"
            : "radial-gradient(circle at 38% 35%, #6b7280, #1f2937)",
          borderColor: active ? "#f97316" : "var(--border-subtle)",
        }}
      />
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-sm text-[var(--text-primary)]">{label}</span>
          {active && <span className="text-[0.7rem] text-[var(--accent-orange)] font-semibold">Your turn</span>}
        </div>
        <span className="text-[0.68rem] text-[var(--text-muted)]">{pieces} piece{pieces !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

export default function CheckersVsBotPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [status, setStatus]         = useState<Status>("idle");
  const [board, setBoard]           = useState<Board>(initialBoard());
  const [turn, setTurn]             = useState<"w" | "b">("w");
  const [selected, setSelected]     = useState<[number, number] | null>(null);
  const [legalDots, setLegalDots]   = useState<[number, number][]>([]);
  const [lastMove, setLastMove]     = useState<Move | null>(null);
  const [moveCount, setMoveCount]   = useState(0);
  const [mustJump, setMustJump]     = useState<[number, number] | null>(null);
  const [result, setResult]         = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const cellPx = useCellPx();

  function startGame() {
    const b = initialBoard();
    setBoard(b); setTurn("w"); setSelected(null); setLegalDots([]);
    setLastMove(null); setMoveCount(0); setMustJump(null);
    setResult(""); setBotThinking(false); setStatus("playing");
  }

  const doMove = useCallback((
    b: Board,
    move: Move,
    currentTurn: "w" | "b",
    currentMoveCount: number,
  ): { nextBoard: Board; nextTurn: "w" | "b"; nextCount: number } => {
    const { board: nb, promoted } = applyMove(b, move);
    setLastMove(move);
    setBoard(nb); setSelected(null); setLegalDots([]);
    // Multi-jump: same piece can capture again
    if (move.captured && !promoted && canContinueJump(nb, move.to[0], move.to[1])) {
      setMustJump(move.to);
      return { nextBoard: nb, nextTurn: currentTurn, nextCount: currentMoveCount };
    }
    setMustJump(null);
    const nextTurn: "w" | "b" = currentTurn === "w" ? "b" : "w";
    const nextCount = currentMoveCount + 1;
    setTurn(nextTurn); setMoveCount(nextCount);
    const { over, winner } = isGameOver(nb, nextTurn);
    if (over) {
      if (!winner) { setResult("Draw!"); }
      else if (winner === "w") { setResult("You win! 🎉"); awardGameBadge("CHECKERS_WIN").catch(() => {}); }
      else { setResult("Bot wins."); }
      setStatus("over");
    }
    return { nextBoard: nb, nextTurn, nextCount };
  }, []);

  const triggerBot = useCallback((b: Board, currentMoveCount: number, mj: [number, number] | null = null) => {
    setBotThinking(true);
    setTimeout(() => {
      const botMove = getBotMove(b, "b", difficulty, mj);
      if (!botMove) { setBotThinking(false); return; }
      const { nextBoard, nextTurn, nextCount } = doMove(b, botMove, "b", currentMoveCount);
      if (nextTurn === "b") {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        triggerBot(nextBoard, nextCount, botMove.to);
      } else {
        setBotThinking(false);
      }
    }, 350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, doMove]);

  function handleMove(from: [number, number], to: [number, number]) {
    if (status !== "playing" || turn !== "w" || botThinking) return;
    const move = getLegalMoves(board, "w", mustJump).find(m =>
      m.from[0] === from[0] && m.from[1] === from[1] &&
      m.to[0] === to[0]   && m.to[1] === to[1],
    );
    if (!move) return;
    const { nextBoard, nextTurn, nextCount } = doMove(board, move, "w", moveCount);
    if (nextTurn === "b") triggerBot(nextBoard, nextCount);
  }

  function handleSquare(r: number, c: number) {
    if (status !== "playing" || turn !== "w" || botThinking) return;

    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); setLegalDots([]); return; }
      const move = getLegalMoves(board, "w", mustJump).find(m =>
        m.to[0] === r && m.to[1] === c && m.from[0] === sr && m.from[1] === sc,
      );
      if (move) {
        const { nextBoard, nextTurn, nextCount } = doMove(board, move, "w", moveCount);
        if (nextTurn === "b") triggerBot(nextBoard, nextCount);
        return;
      }
    }

    // During a multi-jump chain, only the jumping piece can be selected
    if (mustJump) {
      if (mustJump[0] === r && mustJump[1] === c) {
        const fromMoves = getLegalMoves(board, "w", mustJump);
        setSelected([r, c]);
        setLegalDots(fromMoves.map(m => m.to));
      }
      return;
    }

    const cell = board[r][c];
    if (cell === "w" || cell === "W") {
      const fromMoves = getLegalMoves(board, "w").filter(m => m.from[0] === r && m.from[1] === c);
      if (fromMoves.length > 0) {
        setSelected([r, c]);
        setLegalDots(fromMoves.map(m => m.to));
        return;
      }
    }
    setSelected(null); setLegalDots([]);
  }

  const whitePieces = countPieces(board, "w");
  const blackPieces = countPieces(board, "b");
  const isMyTurn  = status === "playing" && turn === "w" && !botThinking;
  const isBotTurn = status === "playing" && (turn === "b" || botThinking);
  const diffLabel = difficulty === "easy" ? "Easy" : difficulty === "normal" ? "Normal" : "Hard";

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <main className="flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex flex-col items-center gap-8 py-16 px-12 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="text-7xl leading-none select-none">🔴</div>
          <div>
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] text-center mb-1">Checkers vs Bot</h1>
            <p className="text-[var(--text-muted)] text-sm text-center">Russian rules · You play White</p>
          </div>
          <div className="flex gap-3">
            {(["easy", "normal", "hard"] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={["px-5 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  difficulty === d
                    ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                ].join(" ")}>
                {d === "easy" ? "Easy" : d === "normal" ? "Normal" : "Hard"}
              </button>
            ))}
          </div>
          <button onClick={startGame}
            className="px-10 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-base hover:opacity-90 transition-opacity">
            Start Game
          </button>
        </div>
      </main>
    );
  }

  // ── PLAYING / OVER ─────────────────────────────────────────────────────────
  return (
    <main className="overflow-y-auto lg:overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:h-full items-center justify-center">

        {/* Board column */}
        <div className="flex flex-col shrink-0">
          <PlayerRow label={`Bot · ${diffLabel}`} color="b" active={isBotTurn} pieces={blackPieces} />

          <CheckersBoard
            board={board}
            cellPx={cellPx}
            selected={selected}
            legalDots={legalDots}
            lastMove={lastMove}
            mustJumpFrom={mustJump}
            onSquare={handleSquare}
            onDrop={handleMove}
            disabled={status === "over" || turn !== "w" || botThinking}
          />

          <PlayerRow label="You (White)" color="w" active={isMyTurn} pieces={whitePieces} />
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full max-w-xs lg:w-60 lg:self-stretch py-1">
          {/* Controls */}
          <div className="flex gap-2">
            <button onClick={startGame}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
              <RotateCcw size={12} /> New Game
            </button>
            {status === "playing" && (
              <button onClick={() => { setResult("You surrendered."); setStatus("over"); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
                <Flag size={12} /> Surrender
              </button>
            )}
          </div>

          {/* Result banner */}
          {status === "over" && result && (
            <div className="px-3 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[var(--accent-orange)] font-display font-bold text-sm text-center">
              {result}
            </div>
          )}

          {/* Difficulty selector when game is over */}
          {status === "over" && (
            <div className="flex gap-1.5">
              {(["easy", "normal", "hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={["flex-1 py-1.5 rounded-lg text-[0.7rem] font-display font-semibold border transition-all",
                    difficulty === d
                      ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  ].join(" ")}>
                  {d === "easy" ? "Easy" : d === "normal" ? "Normal" : "Hard"}
                </button>
              ))}
            </div>
          )}

          {/* Info panel */}
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 gap-3">
            <p className="text-xs font-display font-bold text-[var(--text-secondary)] uppercase tracking-wider">Game Info</p>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Move</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{moveCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Difficulty</span>
              <span className="font-display font-semibold text-[var(--accent-orange)]">{diffLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Turn</span>
              <span className="font-display font-semibold text-[var(--text-primary)]">
                {status === "over" ? "—" : turn === "w" ? "White (You)" : "Black (Bot)"}
              </span>
            </div>
            {botThinking && (
              <p className="text-[0.7rem] text-[var(--text-muted)] animate-pulse">Bot is thinking…</p>
            )}
          </div>

          {/* Rules reminder */}
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 gap-1.5">
            <p className="text-xs font-display font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Rules</p>
            {[
              "Captures are mandatory",
              "Multi-jump if possible",
              "Reach last row → King",
              "No moves = you lose",
            ].map(r => (
              <p key={r} className="text-[0.68rem] text-[var(--text-muted)]">· {r}</p>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
