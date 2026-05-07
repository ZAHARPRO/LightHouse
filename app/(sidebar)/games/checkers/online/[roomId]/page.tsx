"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2, Crown, Flag, RotateCcw, CheckCircle2, Clock,
  ArrowLeft, ChevronLeft, ChevronRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  initialBoard, getLegalMoves, applyMove, countPieces,
  type Board, type Cell, type Color, type Move,
} from "@/lib/checkers";
import { getRank } from "@/lib/elo";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import SpectatorBadge from "@/components/SpectatorBadge";
import GameReportButton from "@/components/GameReportButton";
import GameChat from "@/components/GameChat";
import { preloadSounds, playSound } from "@/lib/gameSounds";

// ── Constants ─────────────────────────────────────────────────────────────────
const LIGHT_SQ = "#fef3c7";
const DARK_SQ  = "#78350f";

// ── Types ─────────────────────────────────────────────────────────────────────
type ChatMsg = { userId: string; name: string; text: string; at: number };
type StoredMove = { from: [number,number]; to: [number,number]; color: "w"|"b"; captured: boolean };
type HistoryEntry = { board: Board; from: [number,number]; to: [number,number]; color: "w"|"b"; captured: boolean };
type RoomData = {
  id: string; status: string; timeControl: string; myRole: string;
  hostId: string; hostName: string | null; hostImage: string | null;
  guestId: string | null; guestName: string | null; guestImage: string | null;
  hostReady: boolean; guestReady: boolean; hostColor: string;
  board: Board | null; moveCount: number; mustJumpFrom: [number,number] | null;
  whiteTimeMs: number | null; blackTimeMs: number | null;
  winner: string | null; winReason: string | null;
  startedAt: string | null; endedAt: string | null; rated: boolean;
  hostElo: number; guestElo: number | null; hostEloDelta: number | null; guestEloDelta: number | null;
  chat: ChatMsg[]; spectatorCount: number; movesJson: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toAlg(r: number, c: number) {
  return `${String.fromCharCode(97 + c)}${r + 1}`;
}
function fmtTime(ms: number | null) {
  if (ms === null) return "∞";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── useCellPx ─────────────────────────────────────────────────────────────────
function useCellPx() {
  const [cellPx, setCellPx] = useState(52);
  useEffect(() => {
    function compute() {
      const isLg = window.innerWidth >= 1024;
      const SIDE  = isLg ? 296 : 0;
      const RANK  = 24;
      const PAD   = isLg ? 48 : 24;
      const ROWS  = 108;
      const availH = Math.floor((window.innerHeight - 64 - PAD - ROWS) / 8);
      const availW = Math.floor((window.innerWidth  - SIDE - PAD - RANK) / 8);
      setCellPx(Math.max(34, Math.min(78, availH, availW)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return cellPx;
}

// ── Piece ─────────────────────────────────────────────────────────────────────
function Piece({ cell, cellPx, dragging }: { cell: Cell; cellPx: number; dragging?: boolean }) {
  if (!cell) return null;
  const isWhite = cell === "w" || cell === "W";
  const king    = cell === "W" || cell === "B";
  const size    = Math.round(cellPx * 0.72);
  const crown   = Math.round(cellPx * 0.30);
  return (
    <div className="relative flex items-center justify-center select-none pointer-events-none"
      style={{ width: size, height: size, opacity: dragging ? 0.3 : 1 }}>
      <div className="absolute inset-0 rounded-full" style={{
        background: isWhite
          ? "radial-gradient(circle at 38% 35%, #fef9ee, #d97706)"
          : "radial-gradient(circle at 38% 35%, #6b7280, #1f2937)",
        boxShadow: isWhite
          ? "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.4)"
          : "0 2px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.15)",
      }} />
      {king && (
        <Crown size={crown} className="relative z-10"
          style={{ color: isWhite ? "#92400e" : "#d1d5db", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
      )}
    </div>
  );
}

// ── CheckersBoard ─────────────────────────────────────────────────────────────
function CheckersBoard({ board, cellPx, flipped, selected, legalDots, lastMove, mustJumpFrom, onSquare, onDrop, disabled }: {
  board: Board; cellPx: number; flipped: boolean;
  selected: [number,number] | null; legalDots: [number,number][];
  lastMove: { from: [number,number]; to: [number,number] } | null;
  mustJumpFrom: [number,number] | null;
  onSquare: (r: number, c: number) => void;
  onDrop: (from: [number,number], to: [number,number]) => void;
  disabled?: boolean;
}) {
  const [ghost, setGhost] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const dragSrc = useRef<[number,number] | null>(null);
  const rows = flipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

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
        {rows.map(r => (
          <div key={r} className="flex">
            <div className="flex items-center justify-center font-mono shrink-0"
              style={{ width: 20, color: "#92400e", fontSize: Math.max(9, cellPx * 0.18) }}>
              {r + 1}
            </div>
            {cols.map(c => {
              const isDark     = (r + c) % 2 === 1;
              const isSel      = selected?.[0] === r && selected?.[1] === c;
              const isLM       = !!lastMove && (
                (lastMove.from[0] === r && lastMove.from[1] === c) ||
                (lastMove.to[0]   === r && lastMove.to[1]   === c)
              );
              const isDot      = legalDots.some(([lr, lc]) => lr === r && lc === c);
              const isMust     = mustJumpFrom?.[0] === r && mustJumpFrom?.[1] === c;
              const cell       = board[r][c];
              let bg           = isDark ? DARK_SQ : LIGHT_SQ;
              if (isSel || isLM) bg = "#fde047";
              const isDragging = dragSrc.current?.[0] === r && dragSrc.current?.[1] === c;
              return (
                <div key={c} data-sq={`${r}-${c}`}
                  className="relative flex items-center justify-center"
                  style={{ width: cellPx, height: cellPx, background: bg, flexShrink: 0, cursor: disabled ? "default" : "pointer" }}
                  onClick={() => !disabled && onSquare(r, c)}
                >
                  {isDot && isDark && !cell && (
                    <div className="absolute w-[34%] h-[34%] rounded-full bg-yellow-400/50 pointer-events-none z-10" />
                  )}
                  {isDot && isDark && cell && (
                    <div className="absolute inset-0 border-4 border-yellow-400/60 pointer-events-none z-10" />
                  )}
                  {isMust && (
                    <div className="absolute inset-0 border-[3px] border-red-400 animate-pulse pointer-events-none z-20" />
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
          {cols.map(c => (
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

// ── useCountdown ──────────────────────────────────────────────────────────────
function useCountdown(initMs: number | null, running: boolean) {
  const [ms, setMs] = useState(initMs ?? 0);
  useEffect(() => { setMs(initMs ?? 0); }, [initMs]);
  useEffect(() => {
    if (!running || initMs === null) return;
    const t = setInterval(() => setMs(v => Math.max(0, v - 100)), 100);
    return () => clearInterval(t);
  }, [running, initMs]);
  return ms;
}

// ── PlayerCard ────────────────────────────────────────────────────────────────
function PlayerCard({ name, image, elo, color, timeMs, active, isMe, eloDelta, pieces }: {
  name: string | null; image: string | null; elo: number; color: "w"|"b";
  timeMs: number | null; active: boolean; isMe: boolean;
  eloDelta?: number | null; pieces: number;
}) {
  const rank = getRank(elo);
  const low  = timeMs !== null && timeMs < 30_000;
  return (
    <div className={[
      "flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors",
      active ? "border-pink-500/50 bg-pink-500/5" : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]",
    ].join(" ")}>
      {image
        ? <Image src={image} alt="" width={32} height={32} className="rounded-full shrink-0" />
        : <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-[var(--accent-pink)] font-bold text-xs shrink-0">{name?.[0] ?? "?"}</div>}
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm text-[var(--text-primary)] truncate">
          {name ?? "Anonymous"}{isMe && <span className="text-[0.6rem] text-[var(--accent-orange)] ml-1">(you)</span>}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6rem] font-bold" style={{ color: rank?.color }}>{rank?.emoji} {rank?.label}</span>
          <span className="text-[0.55rem] text-[var(--text-muted)]">ELO {elo}</span>
          {eloDelta !== undefined && eloDelta !== null && (
            <span className={`text-[0.6rem] font-bold ${eloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
              {eloDelta >= 0 ? "+" : ""}{eloDelta}
            </span>
          )}
        </div>
      </div>
      <div className={["w-5 h-5 rounded-full border-2 shrink-0", color === "w" ? "bg-amber-100 border-amber-300" : "bg-gray-800 border-gray-600"].join(" ")} />
      <span className="text-xs font-mono font-bold text-[var(--text-muted)] shrink-0 w-4 text-center">{pieces}</span>
      {timeMs !== null && (
        <span className={[
          "text-sm font-mono font-bold shrink-0 w-14 text-right",
          low && active ? "text-red-400 animate-pulse" : active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]",
        ].join(" ")}>
          {fmtTime(timeMs)}
        </span>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CheckersRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const cellPx = useCellPx();

  const [room, setRoom]         = useState<RoomData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<[number,number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [flipped, setFlipped]   = useState(false);
  const [moving, setMoving]     = useState(false);
  const [readying, setReadying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>("ok");
  const [history, setHistory]   = useState<HistoryEntry[]>([]);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);

  const connFailsRef     = useRef(0);
  const prevRoomRef      = useRef<RoomData | null>(null);
  const lastMovesJsonRef = useRef("");
  const historyListRef   = useRef<HTMLDivElement>(null);

  const myRole    = room?.myRole ?? "spectator";
  const myColor: Color = myRole === "host"  ? (room?.hostColor ?? "w") as Color
                       : myRole === "guest" ? (room?.hostColor === "w" ? "b" : "w") as Color
                       : "w";
  const isWhiteTurn = (room?.moveCount ?? 0) % 2 === 0;
  const isMyTurn    = room?.status === "PLAYING" && (myColor === "w" ? isWhiteTurn : !isWhiteTurn);

  const whiteActive = room?.status === "PLAYING" && isWhiteTurn  && room.timeControl !== "none";
  const blackActive = room?.status === "PLAYING" && !isWhiteTurn && room.timeControl !== "none";
  const whiteMs = useCountdown(room?.whiteTimeMs ?? null, whiteActive);
  const blackMs = useCountdown(room?.blackTimeMs ?? null, blackActive);

  // Rebuild move history from movesJson whenever it changes
  useEffect(() => {
    const mj = room?.movesJson;
    if (!mj || mj === lastMovesJsonRef.current) return;
    lastMovesJsonRef.current = mj;
    try {
      const raw: StoredMove[] = JSON.parse(mj);
      if (raw.length === 0) { setHistory([]); return; }
      let b = initialBoard();
      const entries: HistoryEntry[] = [];
      for (const m of raw) {
        const legal = getLegalMoves(b, m.color as Color);
        const move  = legal.find(lm =>
          lm.from[0] === m.from[0] && lm.from[1] === m.from[1] &&
          lm.to[0]   === m.to[0]   && lm.to[1]   === m.to[1],
        );
        if (!move) break;
        const { board: nb } = applyMove(b, move);
        entries.push({ board: nb, from: m.from, to: m.to, color: m.color, captured: m.captured });
        b = nb;
      }
      setHistory(entries);
    } catch { /* malformed */ }
  }, [room?.movesJson]);

  // Auto-scroll history to bottom when new move arrives (not in replay)
  useEffect(() => {
    if (replayIdx === null && historyListRef.current)
      historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
  }, [history.length, replayIdx]);

  // Player heartbeat
  useEffect(() => {
    if (!room || myRole === "spectator") return;
    const ping = () => fetch(`/api/checkers-rooms/${roomId}/ping`, { method: "POST" }).catch(() => {});
    ping();
    const t = setInterval(ping, 10_000);
    return () => clearInterval(t);
  }, [roomId, room?.status, myRole]);

  // Spectator heartbeat
  useEffect(() => {
    if (!room || room.status !== "PLAYING" || myRole !== "spectator") return;
    fetch(`/api/checkers-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    const t = setInterval(() => fetch(`/api/checkers-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {}), 25_000);
    return () => clearInterval(t);
  }, [roomId, room?.status, myRole]);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkers-rooms/${roomId}`);
      if (!res.ok) { connFailsRef.current++; }
      else {
        connFailsRef.current = 0;
        const data: RoomData = await res.json();
        setRoom(prev => { prevRoomRef.current = prev; return data; });
        setLoading(false);
        if (data.myRole !== "spectator") {
          const mc: Color = data.myRole === "host" ? data.hostColor as Color : (data.hostColor === "w" ? "b" : "w");
          setFlipped(mc === "b");
        }
      }
    } catch { connFailsRef.current++; }
    const f = connFailsRef.current;
    setConnStatus(f === 0 ? "ok" : f <= 4 ? "slow" : "lost");
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    const t = setInterval(() => { if (document.visibilityState !== "hidden") fetchRoom(); }, 1500);
    return () => clearInterval(t);
  }, [fetchRoom]);

  useEffect(() => { preloadSounds(); }, []);

  // Sound effects
  useEffect(() => {
    if (!room) return;
    const prev = prevRoomRef.current;
    if (prev) {
      if (prev.status === "WAITING" && room.status === "PLAYING") playSound("match_start");
      if (prev.status === "WAITING" && !prev.guestReady && room.guestReady) playSound("player_ready");
      if (room.status === "PLAYING" && room.moveCount > prev.moveCount) playSound("opponent_move");
    }
  }, [room]);

  // Clear selection when turn changes
  useEffect(() => { if (!isMyTurn) { setSelected(null); setLegalMoves([]); } }, [isMyTurn]);

  // Auto-select forced jump piece
  useEffect(() => {
    if (!room?.mustJumpFrom || !isMyTurn || !room.board) return;
    const [r, c] = room.mustJumpFrom;
    const myMoves = getLegalMoves(room.board, myColor, room.mustJumpFrom);
    setSelected([r, c]); setLegalMoves(myMoves);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.mustJumpFrom, isMyTurn]);

  // ── Board interaction ────────────────────────────────────────────────────
  function handleSquare(r: number, c: number) {
    if (!room?.board || !isMyTurn || moving || replayIdx !== null) return;
    const mjFrom = room.mustJumpFrom;
    const cell   = room.board[r][c];
    if (selected) {
      const move = legalMoves.find(m => m.to[0] === r && m.to[1] === c);
      if (move) { doMove(move); return; }
    }
    if (mjFrom && (mjFrom[0] !== r || mjFrom[1] !== c)) return;
    if (cell && (cell.toLowerCase() as Color) === myColor) {
      const myMoves = getLegalMoves(room.board, myColor, mjFrom ?? undefined).filter(m => m.from[0] === r && m.from[1] === c);
      setSelected([r, c]); setLegalMoves(myMoves);
      return;
    }
    setSelected(null); setLegalMoves([]);
  }

  function handleDrop(from: [number,number], to: [number,number]) {
    if (!room?.board || !isMyTurn || moving || replayIdx !== null) return;
    const mjFrom = room.mustJumpFrom;
    const move   = getLegalMoves(room.board, myColor, mjFrom ?? undefined)
      .find(m => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1]);
    if (move) doMove(move);
  }

  async function doMove(move: Move) {
    if (moving) return;
    setMoving(true); setSelected(null); setLegalMoves([]);
    try {
      const res = await fetch(`/api/checkers-rooms/${roomId}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: move.from, to: move.to }),
      });
      if (!res.ok) console.warn("Move error:", (await res.json()).error);
      await fetchRoom();
    } finally { setMoving(false); }
  }

  async function toggleReady() {
    setReadying(true);
    await fetch(`/api/checkers-rooms/${roomId}/ready`, { method: "POST" }).catch(() => {});
    await fetchRoom(); setReadying(false);
  }

  async function startGame() {
    setStarting(true);
    await fetch(`/api/checkers-rooms/${roomId}/start`, { method: "POST" }).catch(() => {});
    await fetchRoom(); setStarting(false);
  }

  async function handleCancelRoom() {
    await fetch(`/api/checkers-rooms/${roomId}`, { method: "DELETE" }).catch(() => {});
    router.push("/games/checkers/online");
  }

  async function resign() {
    if (!confirm("Resign this game?")) return;
    setResigning(true);
    await fetch(`/api/checkers-rooms/${roomId}/resign`, { method: "POST" }).catch(() => {});
    await fetchRoom(); setResigning(false);
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const isFinished  = room?.status === "FINISHED";
  const hostColor   = (room?.hostColor ?? "w") as Color;
  const guestColor  = hostColor === "w" ? "b" : "w";
  const hostIsWhite = hostColor === "w";

  const displayBoard     = replayIdx !== null ? (history[replayIdx]?.board ?? room?.board ?? null) : (room?.board ?? null);
  const displayLastMove  = replayIdx !== null
    ? (history[replayIdx] ? { from: history[replayIdx].from, to: history[replayIdx].to } : null)
    : (history.length > 0 ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null);
  const displayMustJump  = replayIdx !== null ? null : (room?.mustJumpFrom ?? null);
  const displaySelected  = replayIdx !== null ? null : selected;
  const displayLegalDots = replayIdx !== null ? [] : (legalMoves.map(m => m.to) as [number,number][]);

  const whitePieces = displayBoard ? countPieces(displayBoard, "w") : 12;
  const blackPieces = displayBoard ? countPieces(displayBoard, "b") : 12;
  const hostPieces  = hostIsWhite ? whitePieces : blackPieces;
  const guestPieces = hostIsWhite ? blackPieces : whitePieces;

  const hostTimeMs  = room?.timeControl !== "none" ? (hostIsWhite ? whiteMs : blackMs) : null;
  const guestTimeMs = room?.timeControl !== "none" ? (hostIsWhite ? blackMs : whiteMs) : null;
  const hostActive  = room?.status === "PLAYING" && (hostIsWhite ?  isWhiteTurn : !isWhiteTurn);
  const guestActive = room?.status === "PLAYING" && (hostIsWhite ? !isWhiteTurn :  isWhiteTurn);

  const myColorStr = myColor === "w" ? "white" : "black";
  const iWon   = isFinished && room?.winner === myColorStr;
  const isDraw = isFinished && room?.winner === "draw";
  const myElo  = myRole === "host" ? (room?.hostElo ?? 0) : (room?.guestElo ?? 0);
  const myDelta = myRole === "host" ? room?.hostEloDelta : room?.guestEloDelta;
  const myUserId = session?.user?.id;

  // ── Loading / not found ──────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );
  if (!room) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <p className="text-[var(--text-muted)]">Room not found.</p>
      <Link href="/games/" className="text-pink-400 hover:opacity-80 text-sm">← Games</Link>
    </div>
  );

  // ── WAITING lobby ────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    const TC: Record<string, string> = {
      none: "∞ No time limit", "60": "⚡ 1 min", "300": "🔥 5 min",
      "600": "⏱ 10 min", "1500": "🕐 25 min", "3600": "🕐 1 hour",
    };
    const hostRank  = getRank(room.hostElo);
    const guestRank = room.guestElo ? getRank(room.guestElo) : null;
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <Link href="/games/" className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm mb-6">
          <ArrowLeft size={14} /> Games
        </Link>
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">Checkers Room</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          {TC[room.timeControl] ?? room.timeControl}
          {room.rated && <span className="ml-2 text-xs font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">Rated</span>}
        </p>
        <div className="flex flex-col gap-3 mb-8">
          {/* Host */}
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            {room.hostImage
              ? <Image src={room.hostImage} alt="" width={36} height={36} className="rounded-full shrink-0" />
              : <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold shrink-0">{room.hostName?.[0] ?? "?"}</div>}
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Anonymous"}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6rem] text-green-400">Host</span>
                {hostRank && <span className="text-[0.6rem] font-bold" style={{ color: hostRank.color }}>{hostRank.emoji} {hostRank.label}</span>}
                <span className="text-[0.55rem] text-[var(--text-muted)]">ELO {room.hostElo}</span>
              </div>
            </div>
            <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          </div>
          {/* Guest */}
          {room.guestId ? (
            <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.guestImage
                ? <Image src={room.guestImage} alt="" width={36} height={36} className="rounded-full shrink-0" />
                : <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">{room.guestName?.[0] ?? "?"}</div>}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Anonymous"}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.6rem] text-[var(--text-muted)]">Guest</span>
                  {guestRank && <span className="text-[0.6rem] font-bold" style={{ color: guestRank.color }}>{guestRank.emoji} {guestRank.label}</span>}
                  {room.guestElo && <span className="text-[0.55rem] text-[var(--text-muted)]">ELO {room.guestElo}</span>}
                </div>
              </div>
              {room.guestReady
                ? <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                : <Clock size={18} className="text-[var(--text-muted)] shrink-0" />}
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-center p-6 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] text-sm">
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border-subtle)]" />
              <p className="italic">Waiting for player…</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            {myRole === "guest" && (
              <button onClick={toggleReady} disabled={readying}
                className={["flex-1 py-2.5 rounded-xl font-display font-bold text-sm border transition-colors",
                  room.guestReady
                    ? "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    : "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25",
                ].join(" ")}>
                {readying && <Loader2 size={14} className="animate-spin inline mr-1" />}
                {room.guestReady ? "Cancel Ready" : "Ready!"}
              </button>
            )}
            {myRole === "host" && (
              <button onClick={startGame} disabled={!room.guestId || !room.guestReady || starting}
                className="flex-1 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity">
                {starting && <Loader2 size={14} className="animate-spin inline mr-1" />}
                {!room.guestId ? "Waiting for opponent…" : !room.guestReady ? "Opponent not ready" : "Start!"}
              </button>
            )}
          </div>
          {myRole === "host" && (
            <button onClick={handleCancelRoom}
              className="w-full py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-display font-semibold text-sm transition-colors">
              ← Leave &amp; close room
            </button>
          )}
          {myRole === "guest" && (
            <button onClick={() => router.push("/games/checkers/online")}
              className="w-full py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-display font-semibold text-sm transition-colors">
              ← Leave Room
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── PLAYING / FINISHED ───────────────────────────────────────────────────
  return (
    <main className="overflow-y-auto lg:overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:h-full items-center justify-center">

        {/* ── Board column ── */}
        <div className="flex flex-col shrink-0">
          {/* Top player */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <PlayerCard
                name={flipped ? (room.hostName ?? "?") : (room.guestName ?? "?")}
                image={flipped ? room.hostImage : room.guestImage}
                elo={flipped ? room.hostElo : (room.guestElo ?? 0)}
                color={flipped ? hostColor : guestColor}
                timeMs={flipped ? hostTimeMs : guestTimeMs}
                active={flipped ? hostActive : guestActive}
                isMe={flipped ? myUserId === room.hostId : myUserId === room.guestId}
                eloDelta={isFinished ? (flipped ? room.hostEloDelta : room.guestEloDelta) : undefined}
                pieces={flipped ? hostPieces : guestPieces}
              />
            </div>
            {myRole !== "spectator" && room.guestId && (
              <GameReportButton
                targetId={myRole === "host" ? (room.guestId ?? "") : room.hostId}
                targetName={flipped ? (room.hostName ?? "Opponent") : (room.guestName ?? "Opponent")}
                game="checkers"
                roomId={room.id}
              />
            )}
          </div>

          {/* Board */}
          <div className="relative">
            {displayBoard && (
              <CheckersBoard
                board={displayBoard}
                cellPx={cellPx}
                flipped={flipped}
                selected={displaySelected}
                legalDots={displayLegalDots}
                lastMove={displayLastMove}
                mustJumpFrom={displayMustJump}
                onSquare={handleSquare}
                onDrop={handleDrop}
                disabled={!isMyTurn || moving || replayIdx !== null}
              />
            )}

            {/* Finished overlay (hidden when in replay) */}
            {isFinished && replayIdx === null && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-sm gap-3">
                <p className={`text-3xl font-display font-extrabold ${iWon ? "text-green-400" : isDraw ? "text-yellow-400" : "text-red-400"}`}>
                  {isDraw ? "Draw" : iWon ? "You won!" : "You lost"}
                </p>
                <p className="text-[var(--text-muted)] text-sm capitalize">{room.winReason?.replace(/_/g, " ")}</p>
                {myDelta !== null && myDelta !== undefined && room.rated && (
                  <p className={`text-lg font-bold ${myDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {myDelta >= 0 ? "+" : ""}{myDelta} ELO · {myElo} now
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  <Link href="/games/checkers/online"
                    className="px-4 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 no-underline">
                    New game
                  </Link>
                  {history.length > 0 && (
                    <button onClick={() => setReplayIdx(history.length - 1)}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors">
                      Review
                    </button>
                  )}
                </div>
              </div>
            )}

            {moving && (
              <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                <Loader2 size={14} className="animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Bottom player */}
          <div className="mt-1">
            <PlayerCard
              name={flipped ? (room.guestName ?? "?") : (room.hostName ?? "?")}
              image={flipped ? room.guestImage : room.hostImage}
              elo={flipped ? (room.guestElo ?? 0) : room.hostElo}
              color={flipped ? guestColor : hostColor}
              timeMs={flipped ? guestTimeMs : hostTimeMs}
              active={flipped ? guestActive : hostActive}
              isMe={flipped ? myUserId === room.guestId : myUserId === room.hostId}
              eloDelta={isFinished ? (flipped ? room.guestEloDelta : room.hostEloDelta) : undefined}
              pieces={flipped ? guestPieces : hostPieces}
            />
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="flex flex-col gap-3 w-full max-w-xs lg:w-72 lg:self-stretch py-1">

          {/* Top bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/games/checkers/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xs transition-colors">← Lobby</Link>
            {room.rated && <span className="text-[0.65rem] font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-1.5 py-0.5 rounded-full">Rated</span>}
            <SpectatorBadge count={room.spectatorCount} />
            <div className="ml-auto flex items-center gap-1.5">
              <ConnectionBadge status={connStatus} />
              <button onClick={() => setFlipped(f => !f)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-subtle)] text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <RotateCcw size={9} /> Flip
              </button>
            </div>
          </div>

          {/* Turn indicator */}
          {room.status === "PLAYING" && replayIdx === null && (
            <p className="text-center text-xs">
              {isMyTurn
                ? <span className="text-pink-400 font-bold">Your turn</span>
                : <span className="text-[var(--text-muted)]">Opponent&apos;s turn</span>}
            </p>
          )}

          {/* Result banner */}
          {isFinished && (
            <div className={[
              "px-3 py-2 rounded-xl border text-sm font-display font-bold text-center",
              iWon  ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : isDraw ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400",
            ].join(" ")}>
              {isDraw ? "Draw" : iWon ? "You won!" : "You lost"}
              {myDelta !== null && myDelta !== undefined && room.rated && (
                <span className={`ml-2 text-xs ${myDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {myDelta >= 0 ? "+" : ""}{myDelta} ELO
                </span>
              )}
            </div>
          )}

          {/* Replay mode banner */}
          {replayIdx !== null && (
            <button onClick={() => setReplayIdx(null)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-pink-500/15 border border-pink-500/40 text-[var(--accent-orange)] text-xs font-display font-semibold hover:bg-pink-500/25 transition-colors">
              <ChevronRight size={12} /> Back to live
            </button>
          )}

          {/* Move history + replay */}
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 gap-2 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-display font-bold text-[var(--text-secondary)] uppercase tracking-wider">Moves</p>
              <span className="text-[0.65rem] text-[var(--text-muted)] font-mono">{history.length}</span>
            </div>

            <div ref={historyListRef} className="flex flex-col gap-px overflow-y-auto flex-1 max-h-52 lg:max-h-72">
              {history.length === 0 && (
                <p className="text-[0.68rem] text-[var(--text-muted)] text-center mt-6">No moves yet</p>
              )}
              {history.map((entry, i) => {
                const note     = `${toAlg(entry.from[0], entry.from[1])}${entry.captured ? "×" : "→"}${toAlg(entry.to[0], entry.to[1])}`;
                const isActive = replayIdx === i;
                const isLatest = replayIdx === null && i === history.length - 1;
                return (
                  <button key={i} onClick={() => setReplayIdx(i)}
                    className={[
                      "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left font-mono text-[0.65rem] transition-colors w-full",
                      isActive  ? "bg-pink-500/20 text-[var(--accent-orange)]"
                      : isLatest ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                                 : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
                    ].join(" ")}>
                    <span className="w-5 shrink-0 text-right text-[var(--text-muted)]">{i + 1}.</span>
                    <span className={entry.color === "w" ? "text-amber-300 font-bold" : "text-slate-400 font-bold"}>
                      {entry.color === "w" ? "W" : "B"}
                    </span>
                    <span>{note}</span>
                    {entry.captured && <span className="text-red-400 text-[0.6rem]">×</span>}
                  </button>
                );
              })}
            </div>

            {/* Replay controls */}
            <div className="flex items-center gap-0.5 pt-1 border-t border-[var(--border-subtle)]">
              <button onClick={() => setReplayIdx(0)}
                disabled={history.length === 0 || replayIdx === 0}
                className="px-2 py-0.5 font-mono text-base leading-none text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                title="First">«</button>
              <button
                onClick={() => setReplayIdx(i => i !== null ? Math.max(0, i - 1) : history.length - 1)}
                disabled={history.length === 0 || replayIdx === 0}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                title="Previous"><ChevronLeft size={14} /></button>
              <span className="flex-1 text-center text-[0.65rem] font-mono text-[var(--text-muted)]">
                {replayIdx !== null ? `${replayIdx + 1} / ${history.length}` : `${history.length} / ${history.length}`}
              </span>
              <button
                onClick={() => setReplayIdx(i => (i !== null && i < history.length - 1) ? i + 1 : null)}
                disabled={history.length === 0 || replayIdx === null}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                title="Next"><ChevronRight size={14} /></button>
              <button onClick={() => setReplayIdx(null)}
                disabled={replayIdx === null}
                className="px-2 py-0.5 font-mono text-base leading-none text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 transition-colors"
                title="Live">»</button>
            </div>
          </div>

          {/* Resign */}
          {room.status === "PLAYING" && myRole !== "spectator" && (
            <button onClick={resign} disabled={resigning}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors text-sm font-display font-semibold">
              {resigning ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />} Resign
            </button>
          )}

          {/* Chat */}
          {myRole !== "spectator" && (
            <GameChat
              msgs={room.chat}
              myUserId={myUserId ?? ""}
              roomId={roomId}
              apiBase="/api/checkers-rooms"
            />
          )}
        </div>
      </div>
    </main>
  );
}
