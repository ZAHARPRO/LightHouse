"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  History, X, Trophy, Skull, Clock, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Star, Flag, Loader2,
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

const TC_LABEL: Record<string, string> = { "300":"5 min","600":"10 min","1500":"25 min","none":"Casual" };
const DIFF_LABEL: Record<string, string> = { easy:"🟢 Easy", medium:"🟡 Medium", hard:"🔴 Hard" };
const NUM_COLORS: Record<number, string> = { 1:"#3b82f6",2:"#16a34a",3:"#ef4444",4:"#1e40af",5:"#991b1b",6:"#0891b2",7:"#7c3aed",8:"#374151" };

// ─────────────────────────────────────────────────────────── chess replay

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
    <div className="inline-block select-none shrink-0" style={{ border:"2px solid #8f7a5a" }}>
      {rows.map(r => (
        <div key={r} className="flex">
          <div style={{ width:16, display:"flex", alignItems:"center", justifyContent:"center", color:"#8f7a5a", fontSize:10, fontFamily:"monospace" }}>
            {flip ? r+1 : 8-r}
          </div>
          {cols.map(c => {
            const isLM = pos.from && pos.to &&
              ((pos.from[0]===r&&pos.from[1]===c)||(pos.to[0]===r&&pos.to[1]===c));
            const piece = pos.state.board[r][c];
            const bg = isLM ? "#f6f669" : ((r+c)%2===0 ? LIGHT : DARK);
            return (
              <div key={c} style={{ width:cellPx, height:cellPx, background:bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {piece && (
                  <span style={{
                    fontSize: Math.round(cellPx*0.68), lineHeight:1,
                    color: piece.color==="w"?"#fff":"#1a1a1a",
                    textShadow: piece.color==="w"
                      ?"0 0 3px #000,0 0 6px #000,0 1px 2px #000"
                      :"0 1px 2px rgba(255,255,255,0.25)",
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
          <div key={c} style={{ width:cellPx, textAlign:"center", fontSize:10, color:"#8f7a5a", fontFamily:"monospace" }}>
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
  const [idx, setIdx] = useState(positions.length - 1); // start at final position
  const flip = game.myColor === "b";

  const go = useCallback((next: number) => setIdx(Math.max(0, Math.min(positions.length - 1, next))), [positions.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  go(idx - 1);
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go, onClose]);

  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  // Determine result
  const iWon = (game.winner === "white" && game.myColor === "w") || (game.winner === "black" && game.myColor === "b");
  const isDraw = game.winner === "draw";
  const cellPx = typeof window !== "undefined" && window.innerWidth < 640 ? 36 : 46;

  // Build move pairs for list
  const pairs: { white: string|null; black: string|null }[] = [];
  for (let i = 0; i < game.movesSAN.length; i += 2) {
    pairs.push({ white: game.movesSAN[i] ?? null, black: game.movesSAN[i+1] ?? null });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4" style={{ background:"rgba(0,0,0,0.85)" }}>
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            {isDraw ? (
              <span className="text-sm font-display font-bold text-[var(--text-muted)]">Draw</span>
            ) : iWon ? (
              <span className="flex items-center gap-1.5 text-sm font-display font-bold text-yellow-400"><Trophy size={15}/> Victory</span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-display font-bold text-red-400"><Skull size={15}/> Defeat</span>
            )}
            <span className="text-[var(--text-muted)] text-xs">{TC_LABEL[game.timeControl] ?? game.timeControl} · {game.totalMoves} moves · {fmtDuration(game.startedAt, game.endedAt)}</span>
            {game.myEloDelta != null && (
              <span className={`text-xs font-display font-bold ${game.myEloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta} ELO
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Board + controls */}
          <div className="flex flex-col items-center gap-3 p-4 shrink-0">
            <ReplayBoard pos={positions[idx]} flip={flip} cellPx={cellPx} />

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button onClick={() => go(0)} disabled={idx===0}
                className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
                <ChevronsLeft size={16}/>
              </button>
              <button onClick={() => go(idx-1)} disabled={idx===0}
                className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
                <ChevronLeft size={16}/>
              </button>
              <span className="text-xs text-[var(--text-muted)] font-mono w-16 text-center">
                {idx === 0 ? "Start" : `${idx}/${game.movesSAN.length}`}
              </span>
              <button onClick={() => go(idx+1)} disabled={idx===positions.length-1}
                className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
                <ChevronRight size={16}/>
              </button>
              <button onClick={() => go(positions.length-1)} disabled={idx===positions.length-1}
                className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
                <ChevronsRight size={16}/>
              </button>
            </div>
            <p className="text-[0.65rem] text-[var(--text-muted)]">← → to navigate</p>
          </div>

          {/* Move list */}
          <div ref={moveListRef} className="flex-1 overflow-y-auto p-3 border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)]">
            <p className="text-[0.7rem] font-display font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">Moves</p>
            <div className="space-y-0.5">
              {pairs.map((pair, pi) => (
                <div key={pi} className="flex items-center gap-1 text-xs font-mono">
                  <span className="text-[var(--text-muted)] w-6 text-right shrink-0">{pi+1}.</span>
                  {/* White move = index 2*pi+1 */}
                  <button
                    data-active={idx === 2*pi+1 ? "true" : "false"}
                    onClick={() => go(2*pi+1)}
                    className={["px-1.5 py-0.5 rounded flex-1 text-left transition-colors",
                      idx === 2*pi+1
                        ? "bg-yellow-500/20 text-yellow-300 font-bold"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                    ].join(" ")}>
                    {pair.white ?? ""}
                  </button>
                  {/* Black move = index 2*pi+2 */}
                  <button
                    data-active={idx === 2*pi+2 ? "true" : "false"}
                    onClick={() => pair.black ? go(2*pi+2) : undefined}
                    className={["px-1.5 py-0.5 rounded flex-1 text-left transition-colors",
                      idx === 2*pi+2
                        ? "bg-yellow-500/20 text-yellow-300 font-bold"
                        : pair.black
                          ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                          : "opacity-0 pointer-events-none"
                    ].join(" ")}>
                    {pair.black ?? "—"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── minesweeper final modal

function MineBoardView({ mines, revealed, flagged, isHit, rows, cols, label }:
  { mines: number[]; revealed: number[]; flagged: number[]; isHit: boolean; rows: number; cols: number; label: string }) {
  const mineSet    = useMemo(() => new Set(mines), [mines]);
  const revealSet  = useMemo(() => new Set(revealed), [revealed]);
  const flagSet    = useMemo(() => new Set(flagged), [flagged]);
  const neighbors  = useMemo(() => computeNeighbors(rows, cols, mineSet), [rows, cols, mineSet]);

  const cellPx = cols >= 30 ? 16 : cols >= 16 ? 20 : 28;

  return (
    <div className="min-w-0">
      <p className="text-xs font-display font-semibold text-[var(--text-muted)] mb-1.5">{label}</p>
      <div className="overflow-x-auto pb-1">
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, ${cellPx}px)`, gap:1 }}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const isMine  = mineSet.has(i);
            const isRev   = revealSet.has(i);
            const isFl    = flagSet.has(i);
            const n       = neighbors[i];
            let bg = "#374151";
            if (isRev) bg = isMine ? "#7f1d1d" : "#1f2937";
            else if (isFl) bg = "#92400e";
            return (
              <div key={i} style={{ width:cellPx, height:cellPx, background:bg, borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {isRev && isMine ? (
                  <span style={{ fontSize: Math.round(cellPx*0.6) }}>💣</span>
                ) : isRev && n > 0 ? (
                  <span style={{ fontSize: Math.round(cellPx*0.6), fontWeight:700, lineHeight:1, color: NUM_COLORS[n] ?? "#fff" }}>{n}</span>
                ) : isFl && !isRev ? (
                  <span style={{ fontSize: Math.round(cellPx*0.6) }}>🚩</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {isHit && <p className="text-[0.65rem] text-red-400 mt-1">💥 Explosion</p>}
    </div>
  );
}

function MineFinalModal({ game, onClose }: { game: MineGame; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4" style={{ background:"rgba(0,0,0,0.85)" }}>
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            {game.iWon
              ? <span className="flex items-center gap-1.5 text-sm font-display font-bold text-yellow-400"><Trophy size={15}/> Victory</span>
              : <span className="flex items-center gap-1.5 text-sm font-display font-bold text-red-400"><Skull size={15}/> Defeat</span>}
            <span className="text-[var(--text-muted)] text-xs">{DIFF_LABEL[game.difficulty]} · {fmtDuration(game.startedAt, game.endedAt)}</span>
            {game.myEloDelta != null && (
              <span className={`text-xs font-display font-bold ${game.myEloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta} ELO
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Boards */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <MineBoardView
              mines={game.myMines} revealed={game.myRevealed} flagged={game.myFlagged}
              isHit={game.myHit} rows={game.rows} cols={game.cols}
              label="Your board" />
            <MineBoardView
              mines={game.oppMines} revealed={game.oppRevealed} flagged={game.oppFlagged}
              isHit={game.oppHit} rows={game.rows} cols={game.cols}
              label={`${game.oppName ?? "Opponent"}'s board`} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── game cards

function AvatarImg({ name, image, size = 28 }: { name: string | null; image: string | null; size?: number }) {
  if (image) {
    if (image.startsWith("data:") || image.startsWith("http")) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={image} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width:size, height:size }} />;
    }
    return <Image src={image} alt="" width={size} height={size} className="rounded-full object-cover" />;
  }
  return (
    <div style={{ width:size, height:size }} className="rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-xs font-bold border border-[var(--border-subtle)]">
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function ChessGameCard({ game, onReplay }: { game: ChessGame; onReplay: () => void }) {
  const iWon  = (game.winner==="white"&&game.myColor==="w")||(game.winner==="black"&&game.myColor==="b");
  const isDraw = game.winner === "draw";
  const resultColor = isDraw ? "text-[var(--text-muted)]" : iWon ? "text-yellow-400" : "text-red-400";
  const resultLabel = isDraw ? "Draw" : iWon ? "Win" : "Loss";
  const WIN_REASON: Record<string, string> = { checkmate:"Checkmate", stalemate:"Stalemate", timeout:"Timeout", resigned:"Resigned" };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors">
      <AvatarImg name={game.oppName} image={game.oppImage} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-display font-bold text-xs ${resultColor}`}>{resultLabel}</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{WIN_REASON[game.winReason ?? ""] ?? game.winReason}</span>
          {game.rated && <Star size={9} className="text-yellow-400" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.65rem] text-[var(--text-muted)] truncate">{game.oppName ?? "Opponent"}</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">·</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{TC_LABEL[game.timeControl] ?? game.timeControl}</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">·</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{game.totalMoves}mv</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">·</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtDuration(game.startedAt, game.endedAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {game.myEloDelta != null && (
          <span className={`text-xs font-display font-bold ${game.myEloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
            {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta}
          </span>
        )}
        <span className="text-[0.6rem] text-[var(--text-muted)]">{fmtAgo(game.endedAt)}</span>
        <button onClick={onReplay}
          className="px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-[0.65rem] font-display font-bold hover:bg-yellow-500/20 transition-colors whitespace-nowrap">
          Replay
        </button>
      </div>
    </div>
  );
}

function MineGameCard({ game, onView }: { game: MineGame; onView: () => void }) {
  const WIN_REASON: Record<string, string> = { cleared:"Board cleared", exploded:"Hit mine" };
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors">
      <AvatarImg name={game.oppName} image={game.oppImage} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-display font-bold text-xs ${game.iWon ? "text-yellow-400" : "text-red-400"}`}>
            {game.iWon ? "Win" : "Loss"}
          </span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{WIN_REASON[game.winReason ?? ""] ?? game.winReason}</span>
          {game.rated && <Star size={9} className="text-yellow-400" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.65rem] text-[var(--text-muted)] truncate">{game.oppName ?? "Opponent"}</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">·</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{DIFF_LABEL[game.difficulty] ?? game.difficulty}</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">·</span>
          <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtDuration(game.startedAt, game.endedAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {game.myEloDelta != null && (
          <span className={`text-xs font-display font-bold ${game.myEloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
            {game.myEloDelta >= 0 ? "+" : ""}{game.myEloDelta}
          </span>
        )}
        <span className="text-[0.6rem] text-[var(--text-muted)]">{fmtAgo(game.endedAt)}</span>
        <button onClick={onView}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[0.65rem] font-display font-bold hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
          View
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── history panels

function ChessHistoryPanel({ userId }: { userId: string }) {
  const [games, setGames]       = useState<ChessGame[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [replay, setReplay]     = useState<ChessGame | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/chess-rooms/history?userId=${userId}&page=${page}`)
      .then(r => r.ok ? r.json() : { items: [], hasMore: false })
      .then(data => {
        setGames(prev => page === 0 ? data.items : [...prev, ...data.items]);
        setHasMore(data.hasMore);
      })
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading && page === 0) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]"/>
    </div>
  );

  if (!loading && games.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
      <span className="text-3xl">♟️</span>
      <p className="text-sm">No chess games yet</p>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        {games.map(g => <ChessGameCard key={g.id} game={g} onReplay={() => setReplay(g)} />)}
      </div>
      {hasMore && (
        <button onClick={() => setPage(p => p+1)} disabled={loading}
          className="mt-3 w-full py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-display font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors">
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
      .then(data => {
        setGames(prev => page === 0 ? data.items : [...prev, ...data.items]);
        setHasMore(data.hasMore);
      })
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading && page === 0) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]"/>
    </div>
  );

  if (!loading && games.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
      <span className="text-3xl">💣</span>
      <p className="text-sm">No minesweeper games yet</p>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        {games.map(g => <MineGameCard key={g.id} game={g} onView={() => setView(g)} />)}
      </div>
      {hasMore && (
        <button onClick={() => setPage(p => p+1)} disabled={loading}
          className="mt-3 w-full py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-display font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors">
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
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background:"rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[var(--accent-orange)]"/>
            <h2 className="font-display font-bold text-[var(--text-primary)]">Match History</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] px-4 shrink-0">
          {([["chess","♟️ Chess"],["mine","💣 Minesweeper"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={["px-4 py-2.5 text-sm font-display font-semibold border-b-2 transition-colors",
                tab === key
                  ? "border-[var(--accent-orange)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              ].join(" ")}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "chess"
            ? <ChessHistoryPanel  userId={userId} />
            : <MineHistoryPanel   userId={userId} />}
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
        <History size={13}/>
        {label}
      </button>
      {open && <MatchHistoryModal userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
