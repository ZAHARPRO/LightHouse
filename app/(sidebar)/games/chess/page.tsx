"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Flag, ChevronRight } from "lucide-react";
import {
  initialState, getLegalMoves, applyMove, toSAN,
  isCheckmate, isStalemate, isInCheck,
  type GameState, type Move,
} from "@/lib/chess";
import { getBotMove } from "@/lib/chess-bot";
import { awardGameBadge } from "@/actions/badges";

type Difficulty = "easy" | "medium" | "hard";
type Status = "idle" | "playing" | "over";

const PIECE_UNICODE: Record<string, string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};
const FILES = "abcdefgh";
const LIGHT = "#f0d9b5", DARK = "#b58863";

function useCellPx() {
  const [cellPx, setCellPx] = useState(56);
  useEffect(() => {
    function compute() {
      const isLg = window.innerWidth >= 1024;
      const SIDE = isLg ? 272 : 0; // side panel only on lg+
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

interface BoardProps {
  state: GameState;
  cellPx: number;
  selected: [number,number]|null;
  legalDots: [number,number][];
  lastMove: Move|null;
  onSquare: (r:number,c:number)=>void;
  onDrop?: (from:[number,number], to:[number,number])=>void;
  disabled?: boolean;
}

function ChessBoard({ state, cellPx, selected, legalDots, lastMove, onSquare, onDrop, disabled }: BoardProps) {
  const [ghost, setGhost] = useState<{ key: string; x: number; y: number } | null>(null);
  const dragSrc = useRef<[number,number]|null>(null);
  const fontSize = Math.round(cellPx * 0.68);

  function startDrag(e: React.PointerEvent, r: number, c: number, key: string) {
    if (disabled) return;
    e.preventDefault();
    onSquare(r, c);
    dragSrc.current = [r, c];
    setGhost({ key, x: e.clientX, y: e.clientY });

    const onMove = (ev: PointerEvent) =>
      setGhost(g => g ? { ...g, x: ev.clientX, y: ev.clientY } : null);

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
        if (tr !== src[0] || tc !== src[1]) onDrop?.(src, [tr, tc]);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <>
      <div className="inline-block select-none" style={{ border: "2px solid #8f7a5a" }}>
        {[0,1,2,3,4,5,6,7].map(r => (
          <div key={r} className="flex">
            <div className="flex items-center justify-center font-mono shrink-0"
              style={{ width: 20, color: "#8f7a5a", fontSize: Math.max(9, cellPx * 0.18) }}>
              {8 - r}
            </div>
            {[0,1,2,3,4,5,6,7].map(c => {
              const isLight = (r + c) % 2 === 0;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isLM = lastMove && (
                (lastMove.from[0] === r && lastMove.from[1] === c) ||
                (lastMove.to[0] === r && lastMove.to[1] === c)
              );
              const isDot = legalDots.some(([lr, lc]) => lr === r && lc === c);
              const piece = state.board[r][c];
              let bg = isLight ? LIGHT : DARK;
              if (isSel || isLM) bg = "#f6f669";
              const isDragging = dragSrc.current?.[0] === r && dragSrc.current?.[1] === c;
              return (
                <div key={c} data-sq={`${r}-${c}`}
                  className="relative flex items-center justify-center cursor-pointer"
                  style={{ width: cellPx, height: cellPx, background: bg, flexShrink: 0 }}
                  onClick={() => !disabled && onSquare(r, c)}
                >
                  {isDot && (
                    <div className={["absolute rounded-full pointer-events-none",
                      piece ? "inset-0 border-[5px] border-black/25 rounded-none" : "w-[34%] h-[34%] bg-black/25"
                    ].join(" ")} />
                  )}
                  {piece && (
                    <span className="select-none leading-none"
                      style={{
                        fontSize,
                        color: piece.color === "w" ? "#fff" : "#1a1a1a",
                        textShadow: piece.color === "w"
                          ? "0 0 3px #000,0 0 6px #000,0 1px 2px #000"
                          : "0 1px 2px rgba(255,255,255,0.3)",
                        opacity: isDragging ? 0.3 : 1,
                        cursor: disabled ? "default" : "grab",
                      }}
                      onPointerDown={e => startDrag(e, r, c, piece.color + piece.type)}
                    >
                      {PIECE_UNICODE[piece.color + piece.type]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex" style={{ marginLeft: 20 }}>
          {[0,1,2,3,4,5,6,7].map(c => (
            <div key={c} style={{ width: cellPx, textAlign: "center", fontSize: Math.max(9, cellPx * 0.16), color: "#8f7a5a", fontFamily: "monospace" }}>
              {FILES[c]}
            </div>
          ))}
        </div>
      </div>

      {ghost && typeof document !== "undefined" && createPortal(
        <div className="fixed pointer-events-none z-[9999] select-none flex items-center justify-center"
          style={{ left: ghost.x - cellPx / 2, top: ghost.y - cellPx / 2, width: cellPx, height: cellPx }}>
          <span style={{
            fontSize,
            lineHeight: 1,
            color: ghost.key[0] === "w" ? "#fff" : "#1a1a1a",
            textShadow: ghost.key[0] === "w"
              ? "0 0 3px #000,0 0 6px #000,0 1px 2px #000"
              : "0 1px 2px rgba(255,255,255,0.3)",
            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.55))",
            transform: "scale(1.18)",
          }}>
            {PIECE_UNICODE[ghost.key]}
          </span>
        </div>,
        document.body
      )}
    </>
  );
}

function MovePanel({ moves }: { moves: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, [moves]);
  const pairs: [string, string|undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto min-h-0">
      {pairs.length === 0 && (
        <p className="text-[var(--text-muted)] text-xs italic py-2 px-1">No moves yet</p>
      )}
      {pairs.map(([w, b], i) => (
        <div key={i} className="flex gap-1 text-sm font-mono px-2 py-[3px] rounded hover:bg-[var(--bg-secondary)]">
          <span className="text-[var(--text-muted)] w-7 shrink-0">{i + 1}.</span>
          <span className="flex-1 text-[var(--text-primary)]">{w}</span>
          <span className="flex-1 text-[var(--text-secondary)]">{b ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerRow({ label, color, active, check }: { label: string; color: "w"|"b"; active?: boolean; check?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-base leading-none"
        style={{
          background: color === "w" ? "#f0d9b5" : "#1a1a1a",
          borderColor: active ? "#f97316" : "var(--border-subtle)",
        }}>
        {color === "w" ? "♙" : "♟"}
      </div>
      <span className="font-display font-semibold text-sm text-[var(--text-primary)]">{label}</span>
      {active && <span className="text-[0.7rem] text-[var(--accent-orange)] font-semibold">● Your turn</span>}
      {check && <span className="text-[0.7rem] text-red-400 font-bold ml-1">Check!</span>}
    </div>
  );
}

export default function ChessVsBotPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [status, setStatus] = useState<Status>("idle");
  const [gameState, setGameState] = useState<GameState>(initialState());
  const [selected, setSelected] = useState<[number,number]|null>(null);
  const [legalDots, setLegalDots] = useState<[number,number][]>([]);
  const [lastMove, setLastMove] = useState<Move|null>(null);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [result, setResult] = useState<string>("");
  const [botThinking, setBotThinking] = useState(false);
  const cellPx = useCellPx();

  function startGame() {
    setGameState(initialState());
    setSelected(null); setLegalDots([]); setLastMove(null);
    setMoveList([]); setResult(""); setBotThinking(false);
    setStatus("playing");
  }

  const doMove = useCallback((state: GameState, move: Move): GameState => {
    const san = toSAN(state, move);
    const next = applyMove(state, move);
    setLastMove(move);
    setMoveList(prev => [...prev, san]);
    setGameState(next);
    if (isCheckmate(next)) {
      const playerWon = next.turn === "b";
      setResult(playerWon ? "White wins!" : "Black wins!");
      setStatus("over");
      if (playerWon) awardGameBadge("CHESS_WIN").catch(() => {});
    } else if (isStalemate(next)) { setResult("Stalemate — draw!"); setStatus("over"); }
    return next;
  }, []);

  const triggerBot = useCallback((state: GameState) => {
    if (state.turn !== "b" || isCheckmate(state) || isStalemate(state)) return;
    setBotThinking(true);
    setTimeout(() => {
      const botMove = getBotMove(state, difficulty);
      if (botMove) doMove(state, botMove);
      setBotThinking(false);
    }, 300);
  }, [difficulty, doMove]);

  function handleSquare(r: number, c: number) {
    if (status !== "playing" || gameState.turn !== "w" || botThinking) return;
    const piece = gameState.board[r][c];
    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); setLegalDots([]); return; }
      const move = getLegalMoves(gameState, sr, sc).find(m => m.to[0] === r && m.to[1] === c);
      if (move) {
        setSelected(null); setLegalDots([]);
        const next = doMove(gameState, move.promotion ? { ...move, promotion: "Q" as const } : move);
        if (!isCheckmate(next) && !isStalemate(next)) triggerBot(next);
        return;
      }
    }
    if (piece?.color === "w") { setSelected([r, c]); setLegalDots(getLegalMoves(gameState, r, c).map(m => m.to)); }
    else { setSelected(null); setLegalDots([]); }
  }

  function handleDrop(from: [number,number], to: [number,number]) {
    if (status !== "playing" || gameState.turn !== "w" || botThinking) return;
    const move = getLegalMoves(gameState, from[0], from[1]).find(m => m.to[0] === to[0] && m.to[1] === to[1]);
    if (!move) return;
    setSelected(null); setLegalDots([]);
    const next = doMove(gameState, move.promotion ? { ...move, promotion: "Q" as const } : move);
    if (!isCheckmate(next) && !isStalemate(next)) triggerBot(next);
  }

  const inCheck = status === "playing" && isInCheck(gameState, gameState.turn);
  const isMyTurn = status === "playing" && gameState.turn === "w" && !botThinking;
  const isBotTurn = status === "playing" && (gameState.turn === "b" || botThinking);

  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <main className="flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex flex-col items-center gap-8 py-16 px-12 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="text-7xl leading-none">♛</div>
          <div>
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] text-center mb-1">Chess</h1>
            <p className="text-[var(--text-muted)] text-sm text-center">Play against the bot</p>
          </div>
          <div className="flex gap-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={["px-5 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  difficulty === d
                    ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                ].join(" ")}>
                {d === "easy" ? "Easy" : d === "medium" ? "Medium" : "Hard"}
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

  // ── PLAYING / OVER ──────────────────────────────────────────────────────────
  return (
    <main className="overflow-y-auto lg:overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:h-full items-center justify-center">

        {/* Board column */}
        <div className="flex flex-col shrink-0">
          {/* Opponent */}
          <PlayerRow label={`Bot · ${difficulty === "easy" ? "Easy" : difficulty === "medium" ? "Medium" : "Hard"}`} color="b" active={isBotTurn} />

          <ChessBoard
            state={gameState}
            cellPx={cellPx}
            selected={selected}
            legalDots={legalDots}
            lastMove={lastMove}
            onSquare={handleSquare}
            onDrop={handleDrop}
            disabled={status === "over" || gameState.turn !== "w" || botThinking}
          />

          {/* Player */}
          <PlayerRow label="You (White)" color="w" active={isMyTurn} check={inCheck && isMyTurn} />
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

          {/* Difficulty selector (only visible when not playing) */}
          {status === "over" && (
            <div className="flex gap-1.5">
              {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={["flex-1 py-1.5 rounded-lg text-[0.7rem] font-display font-semibold border transition-all",
                    difficulty === d
                      ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  ].join(" ")}>
                  {d === "easy" ? "Easy" : d === "medium" ? "Med" : "Hard"}
                </button>
              ))}
            </div>
          )}

          {/* Move history */}
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <ChevronRight size={13} className="text-[var(--text-muted)]" />
              <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Move History</span>
            </div>
            <MovePanel moves={moveList} />
          </div>
        </div>

      </div>
    </main>
  );
}
