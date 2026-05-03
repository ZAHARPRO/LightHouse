"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Send, Crown, Flag, RotateCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getLegalMoves, type Board, type Cell, type Move, type Color } from "@/lib/checkers";
import { getRank } from "@/lib/elo";

// ── Types ─────────────────────────────────────────────────────────────────────
type ChatMsg  = { userId: string; name: string; text: string; at: number };
type RoomData = {
  id: string; status: string; timeControl: string; myRole: string;
  hostId: string; hostName: string | null; hostImage: string | null;
  guestId: string | null; guestName: string | null; guestImage: string | null;
  hostReady: boolean; guestReady: boolean; hostColor: string;
  board: Board | null; moveCount: number; mustJumpFrom: [number, number] | null;
  whiteTimeMs: number | null; blackTimeMs: number | null;
  winner: string | null; winReason: string | null;
  startedAt: string | null; endedAt: string | null; rated: boolean;
  hostElo: number; guestElo: number | null; hostEloDelta: number | null; guestEloDelta: number | null;
  chat: ChatMsg[]; spectatorCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ms: number | null) {
  if (ms === null) return "∞";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Piece component ───────────────────────────────────────────────────────────
function Piece({ cell, selected }: { cell: Cell; selected?: boolean }) {
  const isWhite = cell === "w" || cell === "W";
  const king    = cell === "W" || cell === "B";
  return (
    <div className={[
      "w-[78%] h-[78%] rounded-full flex items-center justify-center transition-all duration-100 select-none",
      isWhite
        ? "bg-gradient-to-br from-amber-50 to-amber-200 border-2 border-amber-300 shadow-md"
        : "bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-600 shadow-md",
      selected ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent scale-110" : "",
    ].join(" ")}>
      {king && <Crown size={12} className={isWhite ? "text-amber-600" : "text-amber-400"} />}
    </div>
  );
}

// ── Board component ───────────────────────────────────────────────────────────
function CheckersBoard({
  board, selected, legalTargets, captureTargets, lastMove, flipped,
  mustJumpFrom, onCellClick,
}: {
  board: Board;
  selected: [number, number] | null;
  legalTargets: [number, number][];
  captureTargets: [number, number][];
  lastMove: { from: [number, number]; to: [number, number] } | null;
  flipped: boolean;
  mustJumpFrom: [number, number] | null;
  onCellClick: (r: number, c: number) => void;
}) {
  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  return (
    <div className="border-2 border-amber-900/60 rounded-sm overflow-hidden shadow-2xl"
      style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", width: "min(90vw,520px)", aspectRatio: "1" }}>
      {rows.flatMap(r => cols.map(c => {
        const isDark    = (r + c) % 2 === 1;
        const cell      = board[r][c];
        const isSel     = selected?.[0] === r && selected?.[1] === c;
        const isTarget  = legalTargets.some(t => t[0] === r && t[1] === c);
        const isCapture = captureTargets.some(t => t[0] === r && t[1] === c);
        const isLast    = lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c));
        const isMust    = mustJumpFrom?.[0] === r && mustJumpFrom?.[1] === c;

        return (
          <div key={`${r}${c}`}
            onClick={() => isDark && onCellClick(r, c)}
            className={[
              "flex items-center justify-center relative",
              isDark ? "bg-amber-900" : "bg-amber-100",
              isLast && isDark ? "bg-amber-700" : "",
              isSel  ? "bg-amber-600" : "",
              isDark && (isTarget || cell) ? "cursor-pointer" : "",
            ].join(" ")}
          >
            {isDark && isTarget && !cell && (
              <div className={["w-[30%] h-[30%] rounded-full opacity-70",
                isCapture ? "bg-red-400" : "bg-yellow-400"].join(" ")} />
            )}
            {isDark && isTarget && cell && (
              <div className="absolute inset-0 ring-2 ring-yellow-400 ring-inset z-10 pointer-events-none" />
            )}
            {isMust && !isSel && cell && (
              <div className="absolute inset-0 ring-2 ring-red-400 ring-inset z-10 pointer-events-none animate-pulse" />
            )}
            {cell && <Piece cell={cell} selected={isSel} />}
          </div>
        );
      }))}
    </div>
  );
}

// ── Timer hook ────────────────────────────────────────────────────────────────
function useCountdown(initMs: number | null, running: boolean) {
  const [ms, setMs] = useState(initMs ?? 0);
  const ref = useRef(ms);
  ref.current = ms;
  useEffect(() => { setMs(initMs ?? 0); }, [initMs]);
  useEffect(() => {
    if (!running || initMs === null) return;
    const t = setInterval(() => setMs(v => Math.max(0, v - 100)), 100);
    return () => clearInterval(t);
  }, [running, initMs]);
  return ms;
}

// ── Player card ───────────────────────────────────────────────────────────────
function PlayerCard({ name, image, elo, color, timeMs, active, isMe, eloDelta, pieces }:
  { name: string | null; image: string | null; elo: number; color: "w"|"b";
    timeMs: number | null; active: boolean; isMe: boolean; eloDelta?: number | null; pieces: number }) {
  const rank = getRank(elo);
  const low  = timeMs !== null && timeMs < 30_000;
  return (
    <div className={["flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors",
      active ? "border-orange-500/50 bg-orange-500/5" : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"].join(" ")}>
      {image
        ? <Image src={image} alt="" width={32} height={32} className="rounded-full shrink-0" />
        : <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-xs shrink-0">{name?.[0] ?? "?"}</div>}
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
      {/* Piece color indicator */}
      <div className={["w-5 h-5 rounded-full border-2 shrink-0", color === "w" ? "bg-amber-100 border-amber-300" : "bg-gray-800 border-gray-600"].join(" ")} />
      {/* Pieces remaining */}
      <span className="text-xs font-mono font-bold text-[var(--text-muted)] shrink-0 w-4 text-center">{pieces}</span>
      {/* Timer */}
      {timeMs !== null && (
        <span className={["text-sm font-mono font-bold shrink-0 w-14 text-right",
          low && active ? "text-red-400 animate-pulse" : active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"].join(" ")}>
          {fmtTime(timeMs)}
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckersRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: session } = useSession();
  const router = useRouter();

  const [room, setRoom]       = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [flipped, setFlipped]   = useState(false);
  const [moving, setMoving]     = useState(false);
  const [readying, setReadying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timers
  const myRole    = room?.myRole ?? "spectator";
  const myColor: Color = myRole === "host" ? (room?.hostColor ?? "w") as Color
                       : myRole === "guest" ? (room?.hostColor === "w" ? "b" : "w") as Color
                       : "w";
  const isWhiteTurn = (room?.moveCount ?? 0) % 2 === 0;
  const isMyTurn  = room?.status === "PLAYING" && (myColor === "w" ? isWhiteTurn : !isWhiteTurn) && !room?.mustJumpFrom
                  || (room?.mustJumpFrom !== null && room?.status === "PLAYING" &&
                      (myColor === "w" ? isWhiteTurn : !isWhiteTurn));

  const whiteActive = room?.status === "PLAYING" && isWhiteTurn && room.timeControl !== "none";
  const blackActive = room?.status === "PLAYING" && !isWhiteTurn && room.timeControl !== "none";

  const whiteMs = useCountdown(room?.whiteTimeMs ?? null, whiteActive);
  const blackMs = useCountdown(room?.blackTimeMs ?? null, blackActive);

  // Spectator heartbeat
  useEffect(() => {
    if (!room || room.status !== "PLAYING" || myRole !== "spectator") return;
    const t = setInterval(() => fetch(`/api/checkers-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {}), 25_000);
    fetch(`/api/checkers-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    return () => clearInterval(t);
  }, [roomId, room?.status, myRole]);

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/checkers-rooms/${roomId}`);
    if (!res.ok) { setLoading(false); return; }
    const data: RoomData = await res.json();
    setRoom(data);
    setLoading(false);
    // Set flip for black player
    if (data.myRole !== "spectator") {
      const mc: Color = data.myRole === "host" ? data.hostColor as Color : (data.hostColor === "w" ? "b" : "w");
      setFlipped(mc === "b");
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchRoom();
    }, 1500);
    return () => clearInterval(t);
  }, [fetchRoom]);

  // Scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [room?.chat]);

  // Clear selection when it's no longer our turn
  useEffect(() => { if (!isMyTurn) { setSelected(null); setLegalMoves([]); } }, [isMyTurn]);

  // ── Cell click handler ─────────────────────────────────────────────────────
  function handleCellClick(r: number, c: number) {
    if (!room?.board || !isMyTurn || moving) return;

    const cell = room.board[r][c];
    const mustFrom = room.mustJumpFrom;

    // If there's a mandatory jump from, only that piece can move
    if (mustFrom) {
      if (mustFrom[0] === r && mustFrom[1] === c) {
        // Select the mandatory piece
        const moves = getLegalMoves(room.board, myColor, mustFrom);
        setSelected([r, c]); setLegalMoves(moves);
        return;
      }
      // Check if clicking a target
      if (selected) {
        const move = legalMoves.find(m => m.to[0] === r && m.to[1] === c);
        if (move) { makeMove(move); return; }
      }
      return;
    }

    // Select own piece
    if (cell && (cell.toLowerCase() as Color) === myColor) {
      const moves = getLegalMoves(room.board, myColor);
      const myMoves = moves.filter(m => m.from[0] === r && m.from[1] === c);
      setSelected([r, c]); setLegalMoves(myMoves);
      return;
    }

    // Click a target square
    if (selected) {
      const move = legalMoves.find(m => m.to[0] === r && m.to[1] === c);
      if (move) { makeMove(move); return; }
    }

    setSelected(null); setLegalMoves([]);
  }

  async function makeMove(move: Move) {
    if (moving) return;
    setMoving(true);
    setSelected(null); setLegalMoves([]);
    setLastMove({ from: move.from, to: move.to });
    try {
      const res = await fetch(`/api/checkers-rooms/${roomId}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: move.from, to: move.to }),
      });
      if (!res.ok) { const d = await res.json(); console.warn("Move error:", d.error); }
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

  async function resign() {
    if (!confirm("Resign this game?")) return;
    setResigning(true);
    await fetch(`/api/checkers-rooms/${roomId}/resign`, { method: "POST" }).catch(() => {});
    await fetchRoom(); setResigning(false);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim() || sendingChat) return;
    setSending(true);
    await fetch(`/api/checkers-rooms/${roomId}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chatText }),
    }).catch(() => {});
    setChatText(""); await fetchRoom(); setSending(false);
  }

  // ── Derived board state ────────────────────────────────────────────────────
  const board = room?.board ?? null;
  const legalTargets:  [number, number][] = legalMoves.map(m => m.to);
  const captureTargets: [number, number][] = legalMoves.filter(m => m.captured).map(m => m.to);

  function countColor(color: Color) {
    if (!board) return 12;
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((board[r][c]?.toLowerCase() as Color) === color) n++;
    return n;
  }

  const whiteColor: Color = "w";
  const blackColor: Color = "b";
  const whitePieces = countColor(whiteColor);
  const blackPieces = countColor(blackColor);

  const hostColor = (room?.hostColor ?? "w") as Color;
  const guestColor = hostColor === "w" ? "b" : "w";

  const hostIsWhite  = hostColor  === "w";
  const hostPieces   = hostIsWhite  ? whitePieces : blackPieces;
  const guestPieces  = hostIsWhite  ? blackPieces : whitePieces;
  const hostTimeMs   = room?.timeControl !== "none" ? (hostIsWhite ? whiteMs : blackMs) : null;
  const guestTimeMs  = room?.timeControl !== "none" ? (hostIsWhite ? blackMs : whiteMs) : null;
  const hostActive   = room?.status === "PLAYING" && (hostIsWhite ? isWhiteTurn : !isWhiteTurn);
  const guestActive  = room?.status === "PLAYING" && (hostIsWhite ? !isWhiteTurn : isWhiteTurn);

  const myUserId = session?.user?.id;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

  if (!room) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <p className="text-[var(--text-muted)]">Room not found.</p>
      <Link href="/games/checkers/online" className="text-orange-400 hover:opacity-80 text-sm">← Back to lobby</Link>
    </div>
  );

  // ── WAITING LOBBY ──────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    return (
      <main className="max-w-md mx-auto px-4 py-12">
        <Link href="/games/checkers/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm mb-8 block transition-colors">← Lobby</Link>
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">Checkers Room</h1>
        {room.rated && <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">Rated</span>}
        <p className="text-[var(--text-muted)] text-sm mt-2 mb-8">
          {room.timeControl === "none" ? "∞ Infinite" : `${room.timeControl}s per side`}
        </p>

        <div className="flex flex-col gap-3 mb-8">
          {/* Host */}
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            {room.hostImage ? <Image src={room.hostImage} alt="" width={40} height={40} className="rounded-full" />
              : <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold">{room.hostName?.[0] ?? "?"}</div>}
            <div>
              <p className="font-display font-bold text-[var(--text-primary)]">{room.hostName ?? "Anonymous"}</p>
              <p className="text-[0.65rem] text-green-400">Host · Ready</p>
            </div>
            <span className="ml-auto text-xs text-[var(--text-muted)]">ELO {room.hostElo}</span>
          </div>

          {/* Guest */}
          {room.guestId ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              {room.guestImage ? <Image src={room.guestImage} alt="" width={40} height={40} className="rounded-full" />
                : <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">{room.guestName?.[0] ?? "?"}</div>}
              <div>
                <p className="font-display font-bold text-[var(--text-primary)]">{room.guestName ?? "Anonymous"}</p>
                <p className={`text-[0.65rem] ${room.guestReady ? "text-green-400" : "text-[var(--text-muted)]"}`}>
                  {room.guestReady ? "Ready ✓" : "Not ready"}
                </p>
              </div>
              <span className="ml-auto text-xs text-[var(--text-muted)]">ELO {room.guestElo ?? "?"}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center p-6 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] text-sm">
              <Loader2 size={14} className="animate-spin mr-2" /> Waiting for opponent…
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {myRole === "guest" && !room.guestReady && (
            <button onClick={toggleReady} disabled={readying}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-display font-bold hover:opacity-90 disabled:opacity-50">
              {readying ? <Loader2 size={14} className="animate-spin" /> : "✓"} Ready
            </button>
          )}
          {myRole === "host" && room.guestId && room.guestReady && (
            <button onClick={startGame} disabled={starting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold hover:opacity-90 disabled:opacity-50">
              {starting ? <Loader2 size={14} className="animate-spin" /> : "▶"} Start Game
            </button>
          )}
          {(myRole === "host" || myRole === "guest") && (
            <button onClick={resign}
              className="px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors font-display font-semibold text-sm">
              Leave
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── FINISHED overlay content ───────────────────────────────────────────────
  const isFinished = room.status === "FINISHED";
  const myColorStr = myColor === "w" ? "white" : "black";
  const iWon = isFinished && room.winner === myColorStr;
  const isDraw = isFinished && room.winner === "draw";
  const myElo  = myRole === "host" ? room.hostElo : room.guestElo ?? 0;
  const myDelta = myRole === "host" ? room.hostEloDelta : room.guestEloDelta;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/games/checkers/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Lobby</Link>
        {room.rated && <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">Rated</span>}
        {room.spectatorCount > 0 && <span className="text-xs text-[var(--text-muted)]">👁 {room.spectatorCount}</span>}
        <button onClick={() => setFlipped(f => !f)}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <RotateCcw size={10} /> Flip
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start justify-center">
        {/* Board + players column */}
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          {/* Top player (opposite side when not flipped) */}
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

          {/* Board */}
          <div className="relative">
            {board && (
              <CheckersBoard
                board={board}
                selected={selected}
                legalTargets={legalTargets}
                captureTargets={captureTargets}
                lastMove={lastMove}
                flipped={flipped}
                mustJumpFrom={room.mustJumpFrom}
                onCellClick={handleCellClick}
              />
            )}

            {/* Finished overlay */}
            {isFinished && (
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
                <div className="flex gap-2 mt-2">
                  <Link href="/games/checkers/online"
                    className="px-4 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 no-underline">
                    New game
                  </Link>
                </div>
              </div>
            )}

            {/* Move indicator */}
            {moving && (
              <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                <Loader2 size={14} className="animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Bottom player */}
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

          {/* Turn indicator */}
          {room.status === "PLAYING" && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-1">
              {isMyTurn
                ? <span className="text-orange-400 font-bold">Your turn{room.mustJumpFrom ? " — must jump!" : ""}</span>
                : "Opponent's turn"}
            </p>
          )}

          {/* Controls */}
          {room.status === "PLAYING" && myRole !== "spectator" && (
            <button onClick={resign} disabled={resigning}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors text-sm font-display font-semibold">
              {resigning ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />} Resign
            </button>
          )}
        </div>

        {/* Chat */}
        {room.status === "PLAYING" && myRole !== "spectator" && (
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden w-full lg:w-64 lg:self-stretch" style={{ minHeight: 200, maxHeight: 520 }}>
            <p className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 pt-3 pb-2 border-b border-[var(--border-subtle)]">Chat</p>
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1" style={{ minHeight: 0 }}>
              {room.chat.map((msg, i) => (
                <div key={i} className={`text-xs ${msg.userId === myUserId ? "text-right" : ""}`}>
                  <span className="text-[0.6rem] text-[var(--text-muted)]">{msg.name}: </span>
                  <span className="text-[var(--text-primary)]">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="flex gap-1 p-2 border-t border-[var(--border-subtle)]">
              <input value={chatText} onChange={e => setChatText(e.target.value)} maxLength={200}
                placeholder="Message…" className="flex-1 px-2 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-orange-500/50" />
              <button type="submit" disabled={sendingChat || !chatText.trim()}
                className="p-1.5 rounded-lg bg-[var(--accent-orange)] text-white disabled:opacity-40">
                <Send size={11} />
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
