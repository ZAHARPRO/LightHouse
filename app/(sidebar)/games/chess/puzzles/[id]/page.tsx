"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trophy, CheckCircle2, XCircle, ChevronLeft, Puzzle, ChevronRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import {
  fromFEN, getLegalMoves, applyMove, getAllLegalMoves,
  type GameState, type Move, type PieceType,
} from "@/lib/chess";

// ── Constants ────────────────────────────────────────────────────────────────
const FILES = "abcdefgh";
const PIECE_UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function moveToUCI(move: Move): string {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  return `${FILES[fc]}${8 - fr}${FILES[tc]}${8 - tr}${move.promotion?.toLowerCase() ?? ""}`;
}

function uciToMove(state: GameState, uci: string): Move | null {
  const fc = uci.charCodeAt(0) - 97;
  const fr = 8 - parseInt(uci[1]);
  const tc = uci.charCodeAt(2) - 97;
  const tr = 8 - parseInt(uci[3]);
  const prom = uci[4] ? (uci[4].toUpperCase() as PieceType) : undefined;
  const legal = getLegalMoves(state, fr, fc);
  return (
    legal.find((m) => m.to[0] === tr && m.to[1] === tc && (!prom || m.promotion === prom)) ?? null
  );
}

// ── Static board for read-only display ───────────────────────────────────────
function squareToRC(sq: string): [number, number] {
  return [8 - parseInt(sq[1]), sq.charCodeAt(0) - 97];
}

function PuzzleBoard({
  state,
  flip,
  selected,
  dots,
  lastMove,
  shake,
  onSquare,
  disabled,
  hintFrom,
  hintTo,
}: {
  state: GameState;
  flip: boolean;
  selected: [number, number] | null;
  dots: [number, number][];
  lastMove: [[number, number], [number, number]] | null;
  shake: boolean;
  onSquare: (r: number, c: number) => void;
  disabled: boolean;
  hintFrom?: [number, number] | null;
  hintTo?: [number, number] | null;
}) {
  const ranks = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const fileRow = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const dotSet = new Set(dots.map(([r, c]) => r * 8 + c));
  const CELL = 64;

  return (
    <div
      style={{
        display: "inline-block",
        animation: shake ? "puzzleShake 0.4s ease" : undefined,
      }}
    >
      <style>{`
        @keyframes puzzleShake {
          0%,100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          35% { transform: translateX(6px); }
          55% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(8, ${CELL}px)`,
          border: "2px solid rgba(139,92,246,0.3)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {ranks.map((r) =>
          fileRow.map((c) => {
            const piece = state.board[r][c];
            const light = (r + c) % 2 === 0;
            const isSel = selected?.[0] === r && selected?.[1] === c;
            const isDot = dotSet.has(r * 8 + c);
            const isLast =
              lastMove &&
              ((lastMove[0][0] === r && lastMove[0][1] === c) ||
                (lastMove[1][0] === r && lastMove[1][1] === c));
            const isHintFrom = hintFrom?.[0] === r && hintFrom?.[1] === c;
            const isHintTo   = hintTo?.[0]   === r && hintTo?.[1]   === c;

            let bg = light ? "#f0d9b5" : "#b58863";
            if (isSel) bg = "#f6f669";
            else if (isHintTo)   bg = light ? "#f5c842" : "#d4a017";
            else if (isHintFrom) bg = light ? "#f5c842" : "#d4a017";
            else if (isLast) bg = light ? "#cdd16f" : "#aaa23a";

            const key = `${r}-${c}`;
            return (
              <div
                key={key}
                onClick={() => !disabled && onSquare(r, c)}
                style={{
                  width: CELL, height: CELL,
                  background: bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                  cursor: disabled ? "default" : "pointer",
                  userSelect: "none",
                }}
              >
                {isDot && (
                  <div
                    style={{
                      position: "absolute",
                      width: piece ? "88%" : "30%",
                      height: piece ? "88%" : "30%",
                      borderRadius: "50%",
                      background: piece ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.18)",
                      border: piece ? "3px solid rgba(0,0,0,0.25)" : undefined,
                      pointerEvents: "none",
                    }}
                  />
                )}
                {piece && (
                  <span
                    style={{
                      fontSize: 42,
                      lineHeight: 1,
                      position: "relative",
                      zIndex: 1,
                      color: piece.color === "w" ? "#fff" : "#1a1a1a",
                      textShadow: piece.color === "w"
                        ? "0 0 3px #000,0 0 6px #000,0 1px 2px #000"
                        : "0 1px 2px rgba(255,255,255,0.3)",
                    }}
                  >
                    {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                  </span>
                )}
                {/* Rank labels */}
                {c === (flip ? 7 : 0) && (
                  <span style={{ position: "absolute", top: 2, left: 3, fontSize: 10, fontWeight: 700, color: light ? "#b58863" : "#f0d9b5", lineHeight: 1 }}>
                    {8 - r}
                  </span>
                )}
                {/* File labels */}
                {r === (flip ? 0 : 7) && (
                  <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: 10, fontWeight: 700, color: light ? "#b58863" : "#f0d9b5", lineHeight: 1 }}>
                    {FILES[c]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Promotion picker ──────────────────────────────────────────────────────────
function PromotionPicker({ color, onPick }: { color: "w" | "b"; onPick: (p: PieceType) => void }) {
  const pieces: PieceType[] = ["Q", "R", "B", "N"];
  return (
    <div className="absolute z-50 flex gap-1 bg-[var(--bg-elevated)] border border-violet-500/30 rounded-xl p-2 shadow-xl" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
      {pieces.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-violet-500/20 transition-colors"
        >
          <span style={{ fontSize: 32 }}>{PIECE_UNICODE[`${color}${p}`]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PuzzleData = {
  id: string;
  title: string;
  difficulty: "mate1" | "mate2";
  fen: string;
  alreadySolved: boolean;
};

type Status = "playing" | "wrong" | "opponent" | "solved";

const DIFF_LABEL: Record<string, string> = { mate1: "Mate in 1", mate2: "Mate in 2" };

// ── Main component ────────────────────────────────────────────────────────────
export default function PuzzleSolverPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [state, setState] = useState<GameState | null>(null);
  const [flip, setFlip] = useState(false);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [dots, setDots] = useState<[number, number][]>([]);
  const [lastMove, setLastMove] = useState<[[number, number], [number, number]] | null>(null);
  const [promoState, setPromoState] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [shake, setShake] = useState(false);
  const [nextId, setNextId] = useState<string | null>(null);
  const [hintStage, setHintStage] = useState<0 | 1 | 2>(0);
  const [hintFrom, setHintFrom] = useState<[number, number] | null>(null);
  const [hintTo, setHintTo]     = useState<[number, number] | null>(null);
  const puzzleFen = useRef("");

  // Load puzzle (public endpoint — solution NOT exposed)
  useEffect(() => {
    fetch(`/api/puzzles/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PuzzleData) => {
        setPuzzle(data);
        puzzleFen.current = data.fen;
        const gs = fromFEN(data.fen);
        setState(gs);
        // Flip board if black to play
        setFlip(gs.turn === "b");
        if (data.alreadySolved) setStatus("solved");
      })
      .catch(() => setLoadError(true));
  }, [id]);

  const reset = useCallback((targetFen?: string) => {
    const fen = targetFen ?? puzzleFen.current;
    const gs = fromFEN(fen);
    setState(gs);
    if (!targetFen) {
      // Full reset to puzzle start
      setFlip(gs.turn === "b");
      setStep(0);
      puzzleFen.current = puzzle?.fen ?? fen;
    }
    setSelected(null);
    setDots([]);
    setLastMove(null);
    setStatus("playing");
    setShake(false);
    setPromoState(null);
    setHintStage(0);
    setHintFrom(null);
    setHintTo(null);
  }, [puzzle]);

  const submitMove = useCallback(
    async (move: Move) => {
      if (!state || !puzzle || status !== "playing") return;

      const uci = moveToUCI(move);
      const newState = applyMove(state, move);
      setState(newState);
      setLastMove([move.from, move.to]);
      setSelected(null);
      setDots([]);

      const res = await fetch(`/api/puzzles/${puzzle.id}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: uci, step }),
      });
      const data = await res.json() as {
        correct: boolean; solved?: boolean;
        response?: string; responseFen?: string; nextStep?: number;
      };

      if (!data.correct) {
        setShake(true);
        setStatus("wrong");
        // Restore to checkpoint FEN (position before wrong move)
        const checkpoint = puzzleFen.current;
        setTimeout(() => {
          setShake(false);
          setState(fromFEN(checkpoint));
          setLastMove(null);
          setSelected(null);
          setDots([]);
          setStatus("playing");
        }, 700);
        return;
      }

      if (data.solved) {
        setStatus("solved");
        fetch("/api/puzzles")
          .then((r) => r.json())
          .then((list: { id: string; solved: boolean }[]) => {
            const idx = list.findIndex((p) => p.id === puzzle.id);
            const next = list.slice(idx + 1).find((p) => !p.solved) ?? list.slice(0, idx).find((p) => !p.solved);
            setNextId(next?.id ?? null);
          })
          .catch(() => {});
        return;
      }

      // Opponent response — show briefly then update board
      setStatus("opponent");
      setTimeout(() => {
        if (data.responseFen) {
          const nextState = fromFEN(data.responseFen);
          setState(nextState);
          if (data.response) {
            const fc = data.response.charCodeAt(0) - 97;
            const fr = 8 - parseInt(data.response[1]);
            const tc = data.response.charCodeAt(2) - 97;
            const tr = 8 - parseInt(data.response[3]);
            setLastMove([[fr, fc], [tr, tc]]);
          }
          puzzleFen.current = data.responseFen;
          setStep(data.nextStep!);
          setStatus("playing");
        }
      }, 700);
    },
    [state, puzzle, status, step, reset]
  );

  const handleSquare = useCallback(
    (r: number, c: number) => {
      if (!state || status !== "playing") return;
      const piece = state.board[r][c];

      // If promotion picker is open, ignore
      if (promoState) return;

      if (selected) {
        const [sr, sc] = selected;
        const legal = getLegalMoves(state, sr, sc);
        const move = legal.find((m) => m.to[0] === r && m.to[1] === c);

        if (move) {
          // Check if pawn promotion
          const isPromo =
            state.board[sr][sc]?.type === "P" &&
            ((state.turn === "w" && r === 0) || (state.turn === "b" && r === 7));

          if (isPromo) {
            setPromoState({ from: [sr, sc], to: [r, c] });
            return;
          }

          submitMove(move);
          return;
        }

        // Click on own piece — reselect
        if (piece?.color === state.turn) {
          setSelected([r, c]);
          setDots(getLegalMoves(state, r, c).map((m) => m.to));
          return;
        }

        setSelected(null);
        setDots([]);
        return;
      }

      if (piece?.color === state.turn) {
        setSelected([r, c]);
        setDots(getLegalMoves(state, r, c).map((m) => m.to));
      }
    },
    [state, selected, status, promoState, submitMove]
  );

  const handlePromo = useCallback(
    (p: PieceType) => {
      if (!state || !promoState) return;
      const legal = getLegalMoves(state, promoState.from[0], promoState.from[1]);
      const move = legal.find(
        (m) => m.to[0] === promoState.to[0] && m.to[1] === promoState.to[1] && m.promotion === p
      );
      setPromoState(null);
      if (move) submitMove(move);
    },
    [state, promoState, submitMove]
  );

  // Loading / error
  if (loadError) return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center">
      <p className="text-[var(--text-muted)]">Puzzle not found.</p>
      <Link href="/games/chess/puzzles" className="mt-4 inline-block text-violet-400 text-sm hover:underline">← Back to puzzles</Link>
    </main>
  );

  if (!puzzle || !state) return (
    <main className="flex items-center justify-center py-40">
      <Loader2 size={28} className="animate-spin text-[var(--text-muted)]" />
    </main>
  );

  async function handleHint() {
    if (status !== "playing" || !puzzle) return;
    if (hintStage === 0) {
      const d = await fetch(`/api/puzzles/${puzzle.id}/hint`).then((r) => r.json()) as { from: string; to: string };
      setHintFrom(squareToRC(d.from));
      setHintTo(null);
      setHintStage(1);
    } else if (hintStage === 1) {
      const d = await fetch(`/api/puzzles/${puzzle.id}/hint`).then((r) => r.json()) as { from: string; to: string };
      setHintFrom(squareToRC(d.from));
      setHintTo(squareToRC(d.to));
      setHintStage(2);
    }
  }

  const turnLabel = state.turn === "w" ? "White" : "Black";
  const diffLabel = DIFF_LABEL[puzzle.difficulty];

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Nav */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/games/chess/puzzles" className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          <ChevronLeft size={15} /> Puzzles
        </Link>
      </div>

      {/* Title row */}
      <div className="flex items-center gap-3 mb-1">
        <Puzzle size={20} className="text-violet-400" />
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">{puzzle.title}</h1>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[0.7rem] font-display font-bold px-2 py-0.5 rounded-full border text-orange-400 bg-orange-500/10 border-orange-500/20">
          {diffLabel}
        </span>
        <span className="text-sm text-[var(--text-muted)]">
          {turnLabel} to play — {diffLabel.toLowerCase()}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Board */}
        <div className="relative">
          <PuzzleBoard
            state={state}
            flip={flip}
            selected={selected}
            dots={dots}
            lastMove={lastMove}
            shake={shake}
            onSquare={handleSquare}
            disabled={status !== "playing"}
            hintFrom={hintFrom}
            hintTo={hintTo}
          />
          {promoState && (
            <div className="absolute inset-0 bg-black/30 rounded-md flex items-center justify-center">
              <PromotionPicker color={state.turn} onPick={handlePromo} />
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4 min-w-[200px]">
          {/* Status card */}
          <div className={[
            "rounded-2xl border px-5 py-4 flex flex-col items-center gap-2 text-center",
            status === "solved"
              ? "bg-green-500/10 border-green-500/25"
              : status === "wrong"
              ? "bg-red-500/10 border-red-500/25"
              : status === "opponent"
              ? "bg-indigo-500/10 border-indigo-500/20"
              : "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
          ].join(" ")}>
            {status === "solved" ? (
              <>
                <Trophy size={28} className="text-yellow-400" />
                <p className="font-display font-bold text-green-400 text-base">Puzzle Solved!</p>
                <p className="text-[var(--text-muted)] text-xs">Well done</p>
              </>
            ) : status === "wrong" ? (
              <>
                <XCircle size={28} className="text-red-400" />
                <p className="font-display font-bold text-red-400 text-sm">Wrong move</p>
                <p className="text-[var(--text-muted)] text-xs">Try again</p>
              </>
            ) : status === "opponent" ? (
              <>
                <Loader2 size={24} className="animate-spin text-indigo-400" />
                <p className="font-display font-bold text-indigo-400 text-sm">Opponent responds…</p>
              </>
            ) : (
              <>
                <CheckCircle2 size={24} className="text-violet-400" />
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">
                  {diffLabel}
                </p>
                <p className="text-[var(--text-muted)] text-xs">
                  {turnLabel} to move
                </p>
              </>
            )}
          </div>

          {/* Controls */}
          <button
            onClick={() => setFlip((f) => !f)}
            className="px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-secondary)] transition-colors"
          >
            ⇅ Flip board
          </button>

          {status === "playing" && (
            <button
              onClick={handleHint}
              disabled={hintStage === 2}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-display font-semibold hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
            >
              <Lightbulb size={13} />
              {hintStage === 0 ? "Hint" : hintStage === 1 ? "Show move" : "Hint used"}
            </button>
          )}

          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-violet-400 transition-colors"
          >
            <RotateCcw size={13} /> Reset puzzle
          </button>

          {status === "solved" && (
            <>
              {nextId && (
                <Link
                  href={`/games/chess/puzzles/${nextId}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 text-white text-xs font-display font-bold hover:opacity-90 transition-opacity no-underline"
                >
                  Next puzzle <ChevronRight size={13} />
                </Link>
              )}
              <Link
                href="/games/chess/puzzles"
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-display font-bold hover:bg-violet-500/25 transition-colors no-underline"
              >
                ← More puzzles
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
