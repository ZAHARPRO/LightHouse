"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Flag, CheckCircle2, Clock, ChevronRight, LogOut, Trophy, Star } from "lucide-react";
import Image from "next/image";
import { fromFEN, toFEN, getLegalMoves, applyMove, type GameState, isInCheck } from "@/lib/chess";
import { getRank } from "@/lib/elo";
import GameReportButton from "@/components/GameReportButton";

type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

type RoomData = {
  id: string;
  status: RoomStatus;
  timeControl: string;
  myRole: "host" | "guest" | "spectator";
  hostId: string; hostName: string|null; hostImage: string|null;
  guestId: string|null; guestName: string|null; guestImage: string|null;
  hostReady: boolean; guestReady: boolean;
  hostColor: string;
  fen: string|null;
  movesSAN: string[];
  lastMove: { from:[number,number]; to:[number,number] }|null;
  whiteTimeMs: number|null;
  blackTimeMs: number|null;
  winner: string|null; winReason: string|null;
  startedAt: string|null; endedAt: string|null;
  rated: boolean;
  hostElo: number|null; guestElo: number|null;
  hostEloDelta: number|null; guestEloDelta: number|null;
};

function useCellPx() {
  const [cellPx, setCellPx] = useState(56);
  useEffect(() => {
    function compute() {
      const isXl = window.innerWidth >= 1280;
      const SIDE = isXl ? 272 : 0;
      const RANK = 18;
      const PAD = isXl ? 32 : 16;
      const PLAYER_ROWS = 108;
      const availH = Math.floor((window.innerHeight - 64 - PAD - PLAYER_ROWS) / 8);
      const availW = Math.floor((window.innerWidth - SIDE - PAD - RANK) / 8);
      setCellPx(Math.max(36, Math.min(72, availH, availW)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return cellPx;
}

// ── Chess pieces ────────────────────────────────────────────────────────────
const PIECE_U: Record<string,string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};
const FILES = "abcdefgh";
const LIGHT = "#f0d9b5", DARK = "#b58863";

interface BoardProps {
  state: GameState;
  flip: boolean;
  selected: [number,number]|null;
  legalDots: [number,number][];
  lastMove: { from:[number,number]; to:[number,number] }|null;
  onSquare?: (r:number,c:number)=>void;
  onDrop?: (from:[number,number], to:[number,number])=>void;
  disabled?: boolean;
  cellPx?: number;
}

function ChessBoard({ state, flip, selected, legalDots, lastMove, onSquare, onDrop, disabled, cellPx: cellPxProp }: BoardProps) {
  const sz = cellPxProp ?? 56;
  const base = [0,1,2,3,4,5,6,7];
  const displayRows = flip ? [...base].reverse() : base;
  const displayCols = flip ? [...base].reverse() : base;

  const [ghost, setGhost] = useState<{ key: string; x: number; y: number } | null>(null);
  const dragSrc = useRef<[number,number]|null>(null);

  function startDrag(e: React.PointerEvent, r: number, c: number, key: string) {
    if (disabled) return;
    e.preventDefault();
    onSquare?.(r, c); // select piece so legal dots appear
    dragSrc.current = [r, c];
    setGhost({ key, x: e.clientX, y: e.clientY });

    const onMove = (ev: PointerEvent) => {
      setGhost(g => g ? { ...g, x: ev.clientX, y: ev.clientY } : null);
    };
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
      <div className="inline-block select-none" style={{ border:"2px solid #8f7a5a" }}>
        {displayRows.map(r=>(
          <div key={r} className="flex">
            <div className="flex items-center justify-center font-mono" style={{ width:18, color:"#8f7a5a", fontSize:10 }}>
              {8-r}
            </div>
            {displayCols.map(c=>{
              const isLight=(r+c)%2===0;
              const isSel=selected?.[0]===r&&selected?.[1]===c;
              const isLM=lastMove&&((lastMove.from[0]===r&&lastMove.from[1]===c)||(lastMove.to[0]===r&&lastMove.to[1]===c));
              const isDot=legalDots.some(([lr,lc])=>lr===r&&lc===c);
              const piece=state.board[r][c];
              let bg=isLight?LIGHT:DARK;
              if(isSel||isLM) bg="#f6f669";
              const isDragging = dragSrc.current?.[0]===r && dragSrc.current?.[1]===c;
              return (
                <div key={c}
                  data-sq={`${r}-${c}`}
                  className="relative flex items-center justify-center cursor-pointer"
                  style={{ width:sz, height:sz, background:bg, flexShrink:0 }}
                  onClick={()=>!disabled&&onSquare?.(r,c)}
                >
                  {isDot&&(
                    <div className={["absolute rounded-full pointer-events-none",
                      piece?"inset-0 border-[4px] border-black/25":"w-[34%] h-[34%] bg-black/25"
                    ].join(" ")}/>
                  )}
                  {piece&&(
                    <span
                      className="select-none"
                      style={{
                        fontSize: Math.round(sz * 0.68), lineHeight:1,
                        color:piece.color==="w"?"#fff":"#1a1a1a",
                        textShadow:piece.color==="w"
                          ?"0 0 3px #000,0 0 6px #000,0 1px 2px #000"
                          :"0 1px 2px rgba(255,255,255,0.25)",
                        opacity: isDragging ? 0.3 : 1,
                        cursor: disabled ? "default" : "grab",
                      }}
                      onPointerDown={e => startDrag(e, r, c, piece.color+piece.type)}
                    >
                      {PIECE_U[piece.color+piece.type]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex" style={{ marginLeft:18 }}>
          {displayCols.map(c=>(
            <div key={c} style={{ width:sz, textAlign:"center", fontSize:10, color:"#8f7a5a", fontFamily:"monospace" }}>
              {FILES[c]}
            </div>
          ))}
        </div>
      </div>

      {ghost && typeof document !== "undefined" && createPortal(
        <div
          className="fixed pointer-events-none z-[9999] select-none"
          style={{ left: ghost.x - sz/2, top: ghost.y - sz/2, width:sz, height:sz, display:"flex", alignItems:"center", justifyContent:"center" }}
        >
          <span style={{
            fontSize: Math.round(sz * 0.68),
            lineHeight: 1,
            color: ghost.key[0]==="w" ? "#fff" : "#1a1a1a",
            textShadow: ghost.key[0]==="w"
              ? "0 0 3px #000,0 0 6px #000,0 1px 2px #000"
              : "0 1px 2px rgba(255,255,255,0.25)",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
            transform: "scale(1.15)",
          }}>
            {PIECE_U[ghost.key]}
          </span>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Captured pieces helpers ─────────────────────────────────────────────────
const PIECE_VALUES: Record<string,number> = { Q:9, R:5, B:3, N:3, P:1 };
const PIECE_ORDER = ["Q","R","B","N","P"];
const CAP_UNICODE: Record<"w"|"b", Record<string,string>> = {
  w: { Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟" },
  b: { Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙" },
};
const INITIAL_COUNTS: Record<string,number> = { Q:1,R:2,B:2,N:2,P:8 };

function getCaptured(state: GameState): { white: string[]; black: string[] } {
  const cur: Record<string,number> = {};
  for (const row of state.board)
    for (const p of row) if (p) cur[p.color+p.type] = (cur[p.color+p.type]??0)+1;
  const white: string[] = [], black: string[] = [];
  for (const t of PIECE_ORDER) {
    const wMiss = INITIAL_COUNTS[t] - (cur["w"+t]??0);
    const bMiss = INITIAL_COUNTS[t] - (cur["b"+t]??0);
    for (let i=0;i<bMiss;i++) white.push(t); // white captured black pieces
    for (let i=0;i<wMiss;i++) black.push(t); // black captured white pieces
  }
  return { white, black };
}

function CapturedRow({ color, captured }: { color:"w"|"b"; captured:string[] }) {
  if (captured.length === 0) return null;
  const uni = CAP_UNICODE[color];
  const adv = captured.reduce((s,p) => s+(PIECE_VALUES[p]??0),0);
  return (
    <div className="flex items-center gap-[1px] flex-wrap">
      {captured.map((p,i)=>(
        <span key={i} style={{ fontSize:13, lineHeight:1 }} className="opacity-60">{uni[p]}</span>
      ))}
      {adv>0&&<span className="text-[0.65rem] text-[var(--text-muted)] ml-1 font-bold">+{adv}</span>}
    </div>
  );
}

// ── Timer display ────────────────────────────────────────────────────────────
function Timer({ ms, active }: { ms: number|null; active: boolean }) {
  const [display, setDisplay] = useState(ms ?? 0);

  // Sync from server only if difference > 1s to avoid visible jumps from polling
  useEffect(() => {
    if (ms === null) return;
    setDisplay(prev => (Math.abs(prev - ms) > 1000 ? ms : prev));
  }, [ms]);

  // Reset fully when timer switches active state (turn change)
  const prevActive = useRef(active);
  useEffect(() => {
    if (prevActive.current !== active && ms !== null) setDisplay(ms);
    prevActive.current = active;
  }, [active, ms]);

  useEffect(() => {
    if (!active || ms === null) return;
    const t = setInterval(() => setDisplay(d => Math.max(0, d - 100)), 100);
    return () => clearInterval(t);
  }, [active, ms]);

  if (ms === null) return null;
  const secs = Math.ceil(display / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const low = display <= 60000;
  return (
    <div className={["px-3 py-1.5 rounded-lg font-mono font-bold text-lg tabular-nums border transition-colors",
      low ? "bg-red-500/15 border-red-500/40 text-red-400" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
    ].join(" ")}>
      {m}:{String(s).padStart(2,"0")}
    </div>
  );
}

// ── Move panel ───────────────────────────────────────────────────────────────
function MovePanel({ moves }: { moves: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top:9999, behavior:"smooth" }); }, [moves]);
  const pairs: [string,string|undefined][] = [];
  for (let i=0;i<moves.length;i+=2) pairs.push([moves[i],moves[i+1]]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto min-h-0 pr-1">
      {pairs.length===0&&<p className="text-[var(--text-muted)] text-xs italic py-2">The move history will appear here.</p>}
      {pairs.map(([w,b],i)=>(
        <div key={i} className="flex gap-1 text-sm font-mono px-2 py-0.5 rounded hover:bg-[var(--bg-secondary)]">
          <span className="text-[var(--text-muted)] w-6 shrink-0">{i+1}.</span>
          <span className="flex-1 text-[var(--text-primary)]">{w}</span>
          <span className="flex-1 text-[var(--text-secondary)]">{b??""}</span>
        </div>
      ))}
    </div>
  );
}

function Avatar({ name, image, size=32 }: { name:string|null; image:string|null; size?:number }) {
  if (image) return <Image src={image} alt="" width={size} height={size} className="rounded-full" style={{width:size,height:size}} />;
  return (
    <div className="rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold"
      style={{ width:size, height:size, fontSize:size*0.4 }}>
      {name?.[0]??"?"}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ChessOnlineRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const cellPx = useCellPx();
  const [room, setRoom] = useState<RoomData|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [selected, setSelected] = useState<[number,number]|null>(null);
  const [legalDots, setLegalDots] = useState<[number,number][]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/chess-rooms/${roomId}`);
    if (!res.ok) { setError("Room not found"); return; }
    setRoom(await res.json());
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, 800);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchRoom]);

  const doAction = useCallback(async (path: string, body?: object) => {
    await fetch(`/api/chess-rooms/${roomId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    fetchRoom();
  }, [roomId, fetchRoom]);

  function getMyColor(r: RoomData): string {
    return r.myRole === "host" ? r.hostColor : (r.hostColor === "w" ? "b" : "w");
  }

  function applyOptimistic(from: [number,number], to: [number,number]) {
    if (!room?.fen) return;
    const state = fromFEN(room.fen);
    const legal = getLegalMoves(state, from[0], from[1]);
    const move = legal.find(m => m.to[0]===to[0] && m.to[1]===to[1]);
    if (!move) return;
    const next = applyMove(state, move.promotion ? { ...move, promotion: "Q" as const } : move);
    setRoom(r => r ? { ...r, fen: toFEN(next), lastMove: { from, to } } : r);
  }

  function handleSquare(r: number, c: number) {
    if (!room || room.status !== "PLAYING" || !room.fen) return;
    const state = fromFEN(room.fen);
    const myColor = getMyColor(room);
    if (state.turn !== myColor) return;

    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); setLegalDots([]); return; }
      const legal = getLegalMoves(state, sr, sc);
      const move = legal.find(m => m.to[0]===r && m.to[1]===c);
      if (move) {
        setSelected(null); setLegalDots([]);
        applyOptimistic([sr, sc], [r, c]);
        doAction("move", { from: [sr,sc], to: [r,c], promotion: "Q" });
        return;
      }
    }
    const piece = state.board[r][c];
    if (piece?.color === myColor) {
      setSelected([r,c]);
      setLegalDots(getLegalMoves(state, r, c).map(m=>m.to));
    } else {
      setSelected(null); setLegalDots([]);
    }
  }

  function handleDrop(from: [number,number], to: [number,number]) {
    if (!room || room.status !== "PLAYING" || !room.fen) return;
    const state = fromFEN(room.fen);
    const myColor = getMyColor(room);
    if (state.turn !== myColor) return;
    const legal = getLegalMoves(state, from[0], from[1]);
    if (!legal.find(m => m.to[0]===to[0] && m.to[1]===to[1])) return;
    setSelected(null); setLegalDots([]);
    applyOptimistic(from, to);
    doAction("move", { from, to, promotion: "Q" });
  }

  async function handleResign() {
    await doAction("resign");
    router.push("/games/chess/online");
  }

  if (error) return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <p className="text-[var(--text-muted)]">{error}</p>
      <button onClick={() => router.push("/games/chess/online")} className="mt-4 px-5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-display">← Lobby</button>
    </main>
  );

  if (!room) return <main className="flex items-center justify-center py-40"><Loader2 size={28} className="animate-spin text-[var(--text-muted)]" /></main>;

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    const TC_LABELS: Record<string,string> = {
      none:"∞ No time limit","60":"⚡ 1 min","300":"🔥 5 min","600":"⏱ 10 min","1500":"🕐 25 min","3600":"🕐 1 hour",
    };
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleResign} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← Leave Room</button>
        </div>
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">Room</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">{TC_LABELS[room.timeControl] ?? room.timeControl} · Colors assigned randomly</p>

        <div className="flex flex-col gap-3 mb-8">
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            <Avatar name={room.hostName} image={room.hostImage} />
            <div className="flex-1">
              <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Anonymous"}</p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">Host</p>
            </div>
            <CheckCircle2 size={18} className="text-green-400" />
          </div>
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            {room.guestId ? (
              <>
                <Avatar name={room.guestName} image={room.guestImage} />
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Anonymous"}</p>
                  <p className="text-[0.7rem] text-[var(--text-muted)]">Guest</p>
                </div>
                {room.guestReady ? <CheckCircle2 size={18} className="text-green-400" /> : <Clock size={18} className="text-[var(--text-muted)]" />}
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border-subtle)]" />
                <p className="text-[var(--text-muted)] text-sm italic">Waiting for player…</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {room.myRole === "guest" && (
            <button onClick={() => doAction("ready")}
              className={["flex-1 py-2.5 rounded-xl font-display font-bold text-sm border transition-colors",
                room.guestReady
                  ? "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  : "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25"
              ].join(" ")}>
              {room.guestReady ? "Cancel Ready" : "Ready!"}
            </button>
          )}
          {room.myRole === "host" && (
            <button onClick={() => doAction("start")} disabled={!room.guestId || !room.guestReady}
              className="flex-1 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity">
              {!room.guestId ? "Waiting for opponent…" : !room.guestReady ? "Opponent not ready" : "Start!"}
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── FINISHED ───────────────────────────────────────────────────────────────
  if (room.status === "FINISHED") {
    const myColor = getMyColor(room);
    const myColorName = myColor === "w" ? "white" : "black";
    const iWon = room.winner === myColorName;
    const isDraw = room.winner === "draw";
    const reasons: Record<string,string> = { checkmate:"Checkmate",stalemate:"Stalemate — draw",timeout:"Time up",resigned:"Resigned" };
    const state = room.fen ? fromFEN(room.fen) : null;
    const flip = myColor === "b";

    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-6">
          {isDraw ? (
            <><Trophy size={40} className="mx-auto mb-2 text-yellow-400" />
              <h1 className="text-3xl font-display font-extrabold">Draw!</h1></>
          ) : iWon ? (
            <><Trophy size={40} className="mx-auto mb-2 text-yellow-400" />
              <h1 className="text-3xl font-display font-extrabold">Victory!</h1></>
          ) : (
            <><Flag size={40} className="mx-auto mb-2 text-red-400" />
              <h1 className="text-3xl font-display font-extrabold">Defeat</h1></>
          )}
          <p className="text-[var(--text-muted)] mt-1 text-sm">{reasons[room.winReason??""] ?? room.winReason}</p>
          {room.rated && (() => {
            const myDelta = room.myRole === "host" ? room.hostEloDelta : room.guestEloDelta;
            if (myDelta == null) return null;
            return (
              <div className={`mt-2 font-display font-bold text-lg ${myDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                {myDelta >= 0 ? "+" : ""}{myDelta} ELO
              </div>
            );
          })()}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {state && (
            <ChessBoard
              state={state} flip={flip}
              selected={null} legalDots={[]} lastMove={room.lastMove}
              disabled cellPx={44}
            />
          )}
          <div className="flex flex-col gap-3 w-64">
            <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 h-72">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight size={14} className="text-[var(--text-muted)]"/>
                <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Move History</span>
              </div>
              <MovePanel moves={room.movesSAN} />
            </div>
            <button onClick={() => router.push("/games/chess/online")}
              className="px-5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors text-center">
              ← Back to Lobby
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (!room.fen) return null;
  const state = fromFEN(room.fen);
  const myColor = getMyColor(room);
  const oppColor = myColor === "w" ? "b" : "w";
  const isMyTurn = state.turn === myColor;
  const flip = myColor === "b";

  const myName = room.myRole === "host" ? room.hostName : room.guestName;
  const myImage = room.myRole === "host" ? room.hostImage : room.guestImage;
  const oppName = room.myRole === "host" ? room.guestName : room.hostName;
  const oppImage = room.myRole === "host" ? room.guestImage : room.hostImage;

  const myTimeMs = myColor === "w" ? room.whiteTimeMs : room.blackTimeMs;
  const oppTimeMs = myColor === "w" ? room.blackTimeMs : room.whiteTimeMs;

  const inCheck = isInCheck(state, state.turn);
  const captured = getCaptured(state);
  const oppCaptured = oppColor === "w" ? captured.white : captured.black;
  const myCaptured  = myColor  === "w" ? captured.white : captured.black;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Board column */}
        <div>
          {/* Opponent info */}
          <div className="flex items-center gap-3 mb-1">
            <Avatar name={oppName} image={oppImage} size={28}/>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-[var(--text-primary)] text-sm">{oppName ?? "Opponent"}</span>
                <span className="text-xs text-[var(--text-muted)]">{oppColor==="w"?"(white)":"(black)"}</span>
                {room.rated && (() => {
                  const oppElo = room.myRole === "host" ? room.guestElo : room.hostElo;
                  const rank = oppElo ? getRank(oppElo) : null;
                  return oppElo ? (
                    <span className="text-[0.65rem] font-bold" style={{ color: rank?.color ?? "#888" }}>
                      {oppElo} ELO{rank ? ` · ${rank.label}` : ""}
                    </span>
                  ) : null;
                })()}
              </div>
              <CapturedRow color={oppColor as "w"|"b"} captured={oppCaptured} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {room.guestId && room.guestId !== room.hostId && (
                <GameReportButton
                  targetId={room.myRole === "host" ? (room.guestId ?? "") : room.hostId}
                  targetName={oppName ?? "Opponent"}
                  game="chess"
                  roomId={room.id}
                />
              )}
              <Timer ms={oppTimeMs} active={!isMyTurn && room.timeControl!=="none"}/>
            </div>
          </div>
          <div className="mb-2"/>

          <ChessBoard
            state={state}
            flip={flip}
            selected={selected}
            legalDots={legalDots}
            lastMove={room.lastMove}
            onSquare={handleSquare}
            onDrop={handleDrop}
            disabled={!isMyTurn}
            cellPx={cellPx}
          />

          {/* My info */}
          <div className="flex items-center gap-3 mt-2">
            <Avatar name={myName} image={myImage} size={28}/>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-[var(--text-primary)] text-sm">{myName ?? "You"}</span>
                <span className="text-xs text-[var(--text-muted)]">{myColor==="w"?"(white)":"(black)"}</span>
                {inCheck && isMyTurn && <span className="text-red-400 text-xs font-bold">Check!</span>}
                {room.rated && (() => {
                  const myElo = room.myRole === "host" ? room.hostElo : room.guestElo;
                  const rank  = myElo ? getRank(myElo) : null;
                  return myElo ? (
                    <span className="text-[0.65rem] font-bold" style={{ color: rank?.color ?? "#888" }}>
                      {myElo} ELO{rank ? ` · ${rank.label}` : ""}
                    </span>
                  ) : null;
                })()}
              </div>
              <CapturedRow color={myColor as "w"|"b"} captured={myCaptured} />
            </div>
            <div className="ml-auto"><Timer ms={myTimeMs} active={isMyTurn && room.timeControl!=="none"}/></div>
          </div>

          {/* Turn indicator */}
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            {isMyTurn ? "✦ Your turn" : "Waiting for opponent's move…"}
          </p>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full xl:w-60 min-h-[400px]">
          {room.rated && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-display font-bold">
              <Star size={11}/> Rated Match
            </div>
          )}
          <button onClick={handleResign}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
            <LogOut size={12}/> Resign
          </button>

          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1" style={{ minHeight:320, maxHeight:480 }}>
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight size={14} className="text-[var(--text-muted)]"/>
              <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Move History</span>
            </div>
            <MovePanel moves={room.movesSAN} />
          </div>
        </div>
      </div>
    </main>
  );
}
