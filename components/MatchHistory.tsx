"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  History, X, Trophy, Skull, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Star, Loader2, Play, Pause,
} from "lucide-react";
import Image from "next/image";
import { fromFEN, getLegalMoves, applyMove, toSAN, type GameState } from "@/lib/chess";
import { computeNeighbors } from "@/lib/minesweeper";

// ─────────────────────────────────────────────────────────── types

type ChessGame = {
  id: string; rated: boolean; timeControl: string; myColor: string;
  startedAt: string | null; endedAt: string | null;
  winner: string | null; winReason: string | null;
  myEloDelta: number | null; myEloSnapshot: number | null;
  oppName: string | null; oppImage: string | null;
  movesSAN: string[]; totalMoves: number;
};

type MineGame = {
  id: string; rated: boolean; difficulty: string;
  rows: number; cols: number; mineCount: number;
  startedAt: string | null; endedAt: string | null;
  winner: string | null; winReason: string | null; iWon: boolean;
  myEloDelta: number | null; myEloSnapshot: number | null;
  oppName: string | null; oppImage: string | null;
  myMines: number[]; myRevealed: number[]; myFlagged: number[]; myHit: boolean;
  oppMines: number[]; oppRevealed: number[]; oppFlagged: number[]; oppHit: boolean;
};

// ─────────────────────────────────────────────────────────── chess constants

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PIECE_U: Record<string, string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};
const FILES = "abcdefgh";
const LIGHT = "#f0d9b5", DARK = "#b58863";

// ─────────────────────────────────────────────────────────── helpers

function fmtDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TC_LABEL: Record<string, string> = {
  "300":"5 min","600":"10 min","1500":"25 min","3600":"60 min","none":"Casual",
};
const DIFF_LABEL: Record<string, string> = { easy:"🟢 Easy", medium:"🟡 Medium", hard:"🔴 Hard" };
const NUM_COLORS: Record<number, string> = {
  1:"#3b82f6",2:"#16a34a",3:"#ef4444",4:"#1e40af",5:"#991b1b",6:"#0891b2",7:"#7c3aed",8:"#374151",
};

// ─────────────────────────────────────────────────────────── board size hook

function useBoardCellPx(mode: "replay" | "static") {
  const [cellPx, setCellPx] = useState(44);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w >= 1280) { setCellPx(62); return; }
      if (w >= 1024) { setCellPx(54); return; }
      if (w >= 768)  { setCellPx(46); return; }
      // Mobile: constrain by both width and height
      // Reserve space: header ~52px, controls+slider ~96px, moves list ~180px
      const reserved = mode === "replay" ? 328 : 0;
      const byW = Math.floor((w - 40) / 8);     // 40 = rank labels + padding
      const byH = Math.floor((h - reserved) / 8);
      setCellPx(Math.max(28, Math.min(byW, byH)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mode]);
  return cellPx;
}

// ─────────────────────────────────────────────────────────── chess replay board

type ReplayPos = { state: GameState; from: [number,number]|null; to: [number,number]|null };

function computePositions(sanMoves: string[]): ReplayPos[] {
  let state = fromFEN(INITIAL_FEN);
  const positions: ReplayPos[] = [{ state, from: null, to: null }];
  for (const san of sanMoves) {
    const all: ReturnType<typeof getLegalMoves> = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        all.push(...getLegalMoves(state, r, c));
    const mv = all.find(m => toSAN(state, m) === san);
    if (!mv) break;
    state = applyMove(state, mv);
    positions.push({ state, from: mv.from, to: mv.to });
  }
  return positions;
}

function ReplayBoard({ pos, flip, cellPx }: { pos: ReplayPos; flip: boolean; cellPx: number }) {
  const base = [0,1,2,3,4,5,6,7];
  const rows = flip ? [...base].reverse() : base;
  const cols = flip ? [...base].reverse() : base;
  return (
    <div className="inline-block select-none" style={{ border: "2px solid #8f7a5a", flexShrink: 0 }}>
      {rows.map(r => (
        <div key={r} className="flex">
          <div style={{ width:16, display:"flex", alignItems:"center", justifyContent:"center",
            color:"#8f7a5a", fontSize:9, fontFamily:"monospace", userSelect:"none" }}>
            {flip ? r+1 : 8-r}
          </div>
          {cols.map(c => {
            const isLM = pos.from && pos.to &&
              ((pos.from[0]===r&&pos.from[1]===c)||(pos.to[0]===r&&pos.to[1]===c));
            const piece = pos.state.board[r][c];
            const bg = isLM ? "#f6f669" : ((r+c)%2===0 ? LIGHT : DARK);
            return (
              <div key={c} style={{ width:cellPx, height:cellPx, background:bg, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {piece && (
                  <span style={{
                    fontSize: Math.round(cellPx * 0.72), lineHeight:1, pointerEvents:"none",
                    color: piece.color==="w" ? "#fff" : "#1a1a1a",
                    textShadow: piece.color==="w"
                      ? "0 0 3px #000,0 0 6px #000,0 1px 2px #000"
                      : "0 1px 2px rgba(255,255,255,0.25)",
                  }}>
                    {PIECE_U[piece.color+piece.type]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex" style={{ marginLeft:16 }}>
        {cols.map(c => (
          <div key={c} style={{ width:cellPx, textAlign:"center", fontSize:9,
            color:"#8f7a5a", fontFamily:"monospace", userSelect:"none" }}>
            {FILES[c]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── chess replay modal

function ChessReplayModal({ game, onClose }: { game: ChessGame; onClose: () => void }) {
  const positions = useMemo(() => computePositions(game.movesSAN), [game.movesSAN]);
  const [idx, setIdx]         = useState(positions.length - 1);
  const [autoplay, setAutoplay] = useState(false);
  const cellPx = useBoardCellPx("replay");
  const flip   = game.myColor === "b";

  const go = useCallback((n: number) => {
    setAutoplay(false);
    setIdx(Math.max(0, Math.min(positions.length - 1, n)));
  }, [positions.length]);

  // Autoplay
  useEffect(() => {
    if (!autoplay) return;
    const t = setInterval(() => {
      setIdx(i => {
        if (i >= positions.length - 1) { setAutoplay(false); return i; }
        return i + 1;
      });
    }, 500);
    return () => clearInterval(t);
  }, [autoplay, positions.length]);

  // Keyboard navigation
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  go(idx - 1);
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === " ")          { e.preventDefault(); setAutoplay(a => !a); }
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [idx, go, onClose]);

  // Scroll active move into view
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    moveListRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  // Swipe navigation on the board area
  const swipeRef   = useRef<HTMLDivElement>(null);
  const touchStart = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? idx + 1 : idx - 1);
  };

  const iWon   = (game.winner==="white"&&game.myColor==="w")||(game.winner==="black"&&game.myColor==="b");
  const isDraw = game.winner === "draw";

  const pairs: { white: string|null; black: string|null }[] = [];
  for (let i = 0; i < game.movesSAN.length; i += 2)
    pairs.push({ white: game.movesSAN[i] ?? null, black: game.movesSAN[i+1] ?? null });

  const resultColor = isDraw ? "text-[var(--text-muted)]" : iWon ? "text-yellow-400" : "text-red-400";
  const resultLabel = isDraw ? "Draw" : iWon ? "Victory" : "Defeat";
  const resultIcon  = isDraw ? null : iWon ? <Trophy size={13}/> : <Skull size={13}/>;

  const boardWidth = cellPx * 8 + 16; // 16px for rank labels

  return createPortal(
    <div className="fixed inset-0 z-[960] flex flex-col md:items-center md:justify-center md:p-6"
      style={{ background: "rgba(0,0,0,0.9)" }}>
      <div className="bg-[var(--bg-card)] md:rounded-2xl md:border border-[var(--border-subtle)]
        w-full md:max-w-[1200px] h-full md:h-auto md:max-h-[95vh]
        flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-[var(--border-subtle)] shrink-0 min-h-[48px]">
          <span className={`flex items-center gap-1 font-display font-bold text-sm shrink-0 ${resultColor}`}>
            {resultIcon}{resultLabel}
          </span>
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[0.65rem] text-[var(--text-muted)]">
            <span className="whitespace-nowrap">{game.oppName ?? "Opponent"}</span>
            <span>·</span>
            <span className="whitespace-nowrap">{TC_LABEL[game.timeControl] ?? game.timeControl}</span>
            <span>·</span>
            <span className="whitespace-nowrap">{game.totalMoves}mv</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline whitespace-nowrap">{fmtDuration(game.startedAt, game.endedAt)}</span>
            {game.myEloDelta != null && (
              <span className={`font-bold whitespace-nowrap ${game.myEloDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta} ELO
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 touch-manipulation">
            <X size={18}/>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          {/* Board panel */}
          <div
            ref={swipeRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="flex flex-col items-center shrink-0 px-3 sm:px-4 pt-3 pb-2 md:border-r border-[var(--border-subtle)] touch-pan-y"
          >
            <ReplayBoard pos={positions[idx]} flip={flip} cellPx={cellPx} />

            {/* Slider */}
            <input
              type="range" min={0} max={positions.length - 1} value={idx}
              onChange={e => go(Number(e.target.value))}
              className="mt-2 cursor-pointer accent-yellow-500 touch-manipulation"
              style={{ width: boardWidth }}
            />

            {/* Controls */}
            <div className="flex items-center gap-2 mt-1.5" style={{ width: boardWidth }}>
              <button onClick={() => go(0)} disabled={idx===0}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors touch-manipulation flex-1 flex justify-center">
                <ChevronsLeft size={16}/>
              </button>
              <button onClick={() => go(idx-1)} disabled={idx===0}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors touch-manipulation flex-1 flex justify-center">
                <ChevronLeft size={16}/>
              </button>

              <button
                onClick={() => { if (idx >= positions.length-1) go(0); setAutoplay(a => !a); }}
                className={["p-2.5 rounded-xl border transition-colors touch-manipulation flex-1 flex justify-center",
                  autoplay
                    ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                    : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                ].join(" ")}>
                {autoplay ? <Pause size={16}/> : <Play size={16}/>}
              </button>

              <button onClick={() => go(idx+1)} disabled={idx===positions.length-1}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors touch-manipulation flex-1 flex justify-center">
                <ChevronRight size={16}/>
              </button>
              <button onClick={() => go(positions.length-1)} disabled={idx===positions.length-1}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors touch-manipulation flex-1 flex justify-center">
                <ChevronsRight size={16}/>
              </button>
            </div>

            <p className="mt-1 text-[0.6rem] text-[var(--text-muted)] tabular-nums" style={{ width: boardWidth }}>
              <span className="font-medium">{idx === 0 ? "Start" : `Move ${idx} / ${game.movesSAN.length}`}</span>
              <span className="ml-2 opacity-40 hidden sm:inline">← → Space · swipe board</span>
            </p>
          </div>

          {/* Move list */}
          <div ref={moveListRef}
            className="flex-1 min-h-0 overflow-y-auto border-t md:border-t-0 px-3 sm:px-4 py-3">
            <p className="text-[0.6rem] font-display font-bold text-[var(--text-muted)] mb-2 uppercase tracking-widest">Moves</p>
            <div className="grid gap-px" style={{ gridTemplateColumns:"auto 1fr 1fr" }}>
              {pairs.map((pair, pi) => (
                <Fragment key={pi}>
                  <span className="text-[var(--text-muted)] text-[0.65rem] font-mono flex items-center justify-end pr-1.5 py-1 select-none">
                    {pi+1}.
                  </span>
                  <button
                    data-active={idx === 2*pi+1 ? "true" : "false"}
                    onClick={() => go(2*pi+1)}
                    className={["px-2 py-1 rounded text-left text-xs font-mono transition-colors touch-manipulation",
                      idx === 2*pi+1
                        ? "bg-yellow-500/25 text-yellow-300 font-bold"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
                    ].join(" ")}>
                    {pair.white ?? ""}
                  </button>
                  <button
                    data-active={idx === 2*pi+2 ? "true" : "false"}
                    onClick={() => pair.black ? go(2*pi+2) : undefined}
                    className={["px-2 py-1 rounded text-left text-xs font-mono transition-colors touch-manipulation",
                      idx === 2*pi+2
                        ? "bg-yellow-500/25 text-yellow-300 font-bold"
                        : pair.black
                          ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
                          : "opacity-0 pointer-events-none"
                    ].join(" ")}>
                    {pair.black ?? ""}
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────── minesweeper board view

function MineBoardView({ mines, revealed, flagged, isHit, rows, cols, label }:
  { mines: number[]; revealed: number[]; flagged: number[]; isHit: boolean; rows: number; cols: number; label: string }) {
  const mineSet   = useMemo(() => new Set(mines),   [mines]);
  const revealSet = useMemo(() => new Set(revealed), [revealed]);
  const flagSet   = useMemo(() => new Set(flagged),  [flagged]);
  const neighbors = useMemo(() => computeNeighbors(rows, cols, mineSet), [rows, cols, mineSet]);

  // Responsive cell size
  const [cellPx, setCellPx] = useState(20);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const maxBoardW = (w < 640 ? w - 32 : Math.min((w - 64) / 2, 400));
      setCellPx(Math.max(12, Math.min(28, Math.floor((maxBoardW - 4) / cols))));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [cols]);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-display font-semibold text-[var(--text-muted)] mb-2">{label}</p>
      <div className="overflow-x-auto">
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},${cellPx}px)`, gap:1, width:"fit-content" }}>
          {Array.from({ length: rows*cols }, (_,i) => {
            const isMine = mineSet.has(i);
            const isRev  = revealSet.has(i);
            const isFl   = flagSet.has(i);
            const n      = neighbors[i];
            const bg = isRev ? (isMine ? "#7f1d1d" : "#1f2937") : isFl ? "#92400e" : "#374151";
            return (
              <div key={i} style={{ width:cellPx, height:cellPx, background:bg, borderRadius:2,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {isRev && isMine
                  ? <span style={{ fontSize: Math.round(cellPx*0.55) }}>💣</span>
                  : isRev && n > 0
                  ? <span style={{ fontSize:Math.round(cellPx*0.6), fontWeight:700, lineHeight:1, color:NUM_COLORS[n]??"#fff" }}>{n}</span>
                  : isFl && !isRev
                  ? <span style={{ fontSize: Math.round(cellPx*0.55) }}>🚩</span>
                  : null}
              </div>
            );
          })}
        </div>
      </div>
      {isHit && <p className="text-[0.65rem] text-red-400 mt-1.5">💥 Explosion</p>}
    </div>
  );
}

function MineFinalModal({ game, onClose }: { game: MineGame; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[960] flex flex-col sm:items-center sm:justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-card)] sm:rounded-2xl sm:border border-[var(--border-subtle)]
        w-full sm:max-w-5xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">

        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {game.iWon
              ? <span className="flex items-center gap-1.5 text-sm font-display font-bold text-yellow-400"><Trophy size={13}/> Victory</span>
              : <span className="flex items-center gap-1.5 text-sm font-display font-bold text-red-400"><Skull size={13}/> Defeat</span>}
            <span className="text-[0.65rem] text-[var(--text-muted)]">
              {DIFF_LABEL[game.difficulty]} · {fmtDuration(game.startedAt, game.endedAt)}
            </span>
            {game.myEloDelta != null && (
              <span className={`text-[0.65rem] font-bold ${game.myEloDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta} ELO
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors touch-manipulation">
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <MineBoardView
              mines={game.myMines} revealed={game.myRevealed} flagged={game.myFlagged}
              isHit={game.myHit} rows={game.rows} cols={game.cols} label="Your board" />
            <MineBoardView
              mines={game.oppMines} revealed={game.oppRevealed} flagged={game.oppFlagged}
              isHit={game.oppHit} rows={game.rows} cols={game.cols}
              label={`${game.oppName ?? "Opponent"}'s board`} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────── game cards

function AvatarImg({ name, image, size = 28 }: { name: string | null; image: string | null; size?: number }) {
  if (image) {
    if (image.startsWith("data:") || image.startsWith("http")) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={image} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width:size, height:size }} />;
    }
    return <Image src={image} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <div style={{ width:size, height:size }}
      className="rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-xs font-bold border border-[var(--border-subtle)] shrink-0">
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function ChessGameCard({ game, onReplay }: { game: ChessGame; onReplay: () => void }) {
  const iWon   = (game.winner==="white"&&game.myColor==="w")||(game.winner==="black"&&game.myColor==="b");
  const isDraw = game.winner === "draw";
  const WIN_REASON: Record<string,string> = { checkmate:"Checkmate",stalemate:"Stalemate",timeout:"Timeout",resigned:"Resigned" };
  const resultColor = isDraw ? "text-[var(--text-muted)]" : iWon ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] active:border-[var(--border-default)] transition-colors">
      <AvatarImg name={game.oppName} image={game.oppImage} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-display font-bold text-xs ${resultColor}`}>
            {isDraw ? "Draw" : iWon ? "Win" : "Loss"}
          </span>
          <span className="text-[0.6rem] text-[var(--text-muted)]">{WIN_REASON[game.winReason ?? ""] ?? game.winReason}</span>
          {game.rated && <Star size={8} className="text-yellow-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="text-[0.6rem] text-[var(--text-muted)] truncate max-w-[90px]">{game.oppName ?? "Opp"}</span>
          <span className="text-[0.55rem] text-[var(--border-default)]">·</span>
          <span className="text-[0.6rem] text-[var(--text-muted)] whitespace-nowrap">{TC_LABEL[game.timeControl] ?? game.timeControl}</span>
          <span className="text-[0.55rem] text-[var(--border-default)]">·</span>
          <span className="text-[0.6rem] text-[var(--text-muted)] whitespace-nowrap">{game.totalMoves}mv</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {game.myEloDelta != null && (
          <span className={`text-xs font-bold ${game.myEloDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta}
          </span>
        )}
        <span className="text-[0.55rem] text-[var(--text-muted)]">{fmtAgo(game.endedAt)}</span>
        <button onClick={onReplay}
          className="px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-[0.62rem] font-bold hover:bg-yellow-500/20 active:bg-yellow-500/25 transition-colors touch-manipulation whitespace-nowrap">
          Replay
        </button>
      </div>
    </div>
  );
}

function MineGameCard({ game, onView }: { game: MineGame; onView: () => void }) {
  const WIN_REASON: Record<string,string> = { cleared:"Cleared", exploded:"Hit mine" };
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] active:border-[var(--border-default)] transition-colors">
      <AvatarImg name={game.oppName} image={game.oppImage} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-display font-bold text-xs ${game.iWon ? "text-yellow-400" : "text-red-400"}`}>
            {game.iWon ? "Win" : "Loss"}
          </span>
          <span className="text-[0.6rem] text-[var(--text-muted)]">{WIN_REASON[game.winReason ?? ""] ?? game.winReason}</span>
          {game.rated && <Star size={8} className="text-yellow-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="text-[0.6rem] text-[var(--text-muted)] truncate max-w-[90px]">{game.oppName ?? "Opp"}</span>
          <span className="text-[0.55rem] text-[var(--border-default)]">·</span>
          <span className="text-[0.6rem] text-[var(--text-muted)]">{DIFF_LABEL[game.difficulty] ?? game.difficulty}</span>
          <span className="text-[0.55rem] text-[var(--border-default)]">·</span>
          <span className="text-[0.6rem] text-[var(--text-muted)] whitespace-nowrap">{fmtDuration(game.startedAt, game.endedAt)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {game.myEloDelta != null && (
          <span className={`text-xs font-bold ${game.myEloDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta}
          </span>
        )}
        <span className="text-[0.55rem] text-[var(--text-muted)]">{fmtAgo(game.endedAt)}</span>
        <button onClick={onView}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[0.62rem] font-bold hover:bg-cyan-500/20 active:bg-cyan-500/25 transition-colors touch-manipulation whitespace-nowrap">
          View
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── history panels

function ChessHistoryPanel({ userId }: { userId: string }) {
  const [games, setGames]     = useState<ChessGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [replay, setReplay]   = useState<ChessGame | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/chess-rooms/history?userId=${userId}&page=${page}`)
      .then(r => r.ok ? r.json() : { items: [], hasMore: false })
      .then(d => { setGames(p => page===0 ? d.items : [...p,...d.items]); setHasMore(d.hasMore); })
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading && page===0) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]"/></div>;
  if (!loading && games.length===0) return (
    <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
      <span className="text-3xl">♟️</span><p className="text-sm">No chess games yet</p>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        {games.map(g => <ChessGameCard key={g.id} game={g} onReplay={() => setReplay(g)} />)}
      </div>
      {hasMore && (
        <button onClick={() => setPage(p=>p+1)} disabled={loading}
          className="mt-3 w-full py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors touch-manipulation">
          {loading ? <Loader2 size={14} className="animate-spin mx-auto"/> : "Load more"}
        </button>
      )}
      {replay && <ChessReplayModal game={replay} onClose={() => setReplay(null)} />}
    </>
  );
}

function MineHistoryPanel({ userId }: { userId: string }) {
  const [games, setGames]     = useState<MineGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [view, setView]       = useState<MineGame | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ms-rooms/history?userId=${userId}&page=${page}`)
      .then(r => r.ok ? r.json() : { items: [], hasMore: false })
      .then(d => { setGames(p => page===0 ? d.items : [...p,...d.items]); setHasMore(d.hasMore); })
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading && page===0) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]"/></div>;
  if (!loading && games.length===0) return (
    <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
      <span className="text-3xl">💣</span><p className="text-sm">No minesweeper games yet</p>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        {games.map(g => <MineGameCard key={g.id} game={g} onView={() => setView(g)} />)}
      </div>
      {hasMore && (
        <button onClick={() => setPage(p=>p+1)} disabled={loading}
          className="mt-3 w-full py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors touch-manipulation">
          {loading ? <Loader2 size={14} className="animate-spin mx-auto"/> : "Load more"}
        </button>
      )}
      {view && <MineFinalModal game={view} onClose={() => setView(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────── main modal + button

function MatchHistoryModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"chess"|"mine">("chess");

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    // Full-screen on mobile, centered card on sm+
    <div className="fixed inset-0 z-[955] sm:flex sm:items-center sm:justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-card)] sm:rounded-2xl sm:border border-[var(--border-subtle)]
        w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2">
            <History size={17} className="text-[var(--accent-orange)]"/>
            <h2 className="font-display font-bold text-[var(--text-primary)] text-base">Match History</h2>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors touch-manipulation">
            <X size={18}/>
          </button>
        </div>

        <div className="flex border-b border-[var(--border-subtle)] shrink-0">
          {([["chess","♟️ Chess"],["mine","💣 Minesweeper"]] as const).map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={["flex-1 py-3 text-sm font-display font-semibold border-b-2 transition-colors touch-manipulation",
                tab === key
                  ? "border-[var(--accent-orange)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              ].join(" ")}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {tab === "chess"
            ? <ChessHistoryPanel userId={userId} />
            : <MineHistoryPanel  userId={userId} />}
        </div>
      </div>
    </div>
  );
}

export default function MatchHistoryButton({ userId, label = "Match History" }: { userId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-primary)] active:text-[var(--text-primary)] transition-colors touch-manipulation">
        <History size={13}/>
        {label}
      </button>
      {open && <MatchHistoryModal userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
