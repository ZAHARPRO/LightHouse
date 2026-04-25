"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Flag, CheckCircle2, Clock, ChevronRight, LogOut, Trophy } from "lucide-react";
import Image from "next/image";
import { fromFEN, getLegalMoves, type GameState, type Move, isInCheck } from "@/lib/chess";

type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

type RoomData = {
  id: string;
  status: RoomStatus;
  timeControl: string;
  myRole: "host" | "guest" | "spectator";
  hostId: string; hostName: string|null; hostImage: string|null;
  guestId: string|null; guestName: string|null; guestImage: string|null;
  hostReady: boolean; guestReady: boolean;
  fen: string|null;
  movesSAN: string[];
  lastMove: { from:[number,number]; to:[number,number] }|null;
  whiteTimeMs: number|null;
  blackTimeMs: number|null;
  winner: string|null; winReason: string|null;
  startedAt: string|null; endedAt: string|null;
};

// ── Chess pieces ────────────────────────────────────────────────────────────
const PIECE_U: Record<string,string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};
const FILES = "abcdefgh";
const LIGHT = "#f0d9b5", DARK = "#b58863";

interface BoardProps {
  state: GameState;
  flip: boolean; // true = black at bottom
  selected: [number,number]|null;
  legalDots: [number,number][];
  lastMove: { from:[number,number]; to:[number,number] }|null;
  onSquare?: (r:number,c:number)=>void;
  disabled?: boolean;
  compact?: boolean;
}

function ChessBoard({ state, flip, selected, legalDots, lastMove, onSquare, disabled, compact }: BoardProps) {
  const sz = compact ? 44 : 56;
  const base = [0,1,2,3,4,5,6,7];

  const displayRows = flip ? [...base].reverse() : base;
  const displayCols = flip ? [...base].reverse() : base;
  return (
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
            return (
              <div key={c} className="relative flex items-center justify-center cursor-pointer"
                style={{ width:sz, height:sz, background:bg, flexShrink:0 }}
                onClick={()=>!disabled&&onSquare?.(r,c)}
              >
                {isDot&&(
                  <div className={["absolute rounded-full pointer-events-none",
                    piece?"inset-0 border-[4px] border-black/25":"w-[34%] h-[34%] bg-black/25"
                  ].join(" ")}/>
                )}
                {piece&&(
                  <span className="pointer-events-none" style={{
                    fontSize: compact?28:38, lineHeight:1,
                    color:piece.color==="w"?"#fff":"#1a1a1a",
                    textShadow:piece.color==="w"
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
      <div className="flex" style={{ marginLeft:18 }}>
        {displayCols.map(c=>(
          <div key={c} style={{ width:sz, textAlign:"center", fontSize:10, color:"#8f7a5a", fontFamily:"monospace" }}>
            {FILES[c]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Timer display ────────────────────────────────────────────────────────────
function Timer({ ms, active }: { ms: number|null; active: boolean }) {
  const [display, setDisplay] = useState(ms ?? 0);
  useEffect(() => { setDisplay(ms ?? 0); }, [ms]);
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
    pollRef.current = setInterval(fetchRoom, 1500);
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

  function handleSquare(r: number, c: number) {
    if (!room || room.status !== "PLAYING" || !room.fen) return;
    const state = fromFEN(room.fen);
    const myColor = room.myRole === "host" ? "w" : "b";
    if (state.turn !== myColor) return;

    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); setLegalDots([]); return; }
      const legal = getLegalMoves(state, sr, sc);
      const move = legal.find(m => m.to[0]===r && m.to[1]===c);
      if (move) {
        setSelected(null); setLegalDots([]);
        doAction("move", { from: [sr,sc], to: [r,c], promotion: "Q" });
        return;
      }
    }
    if (!room.fen) return;
    const state2 = fromFEN(room.fen);
    const piece = state2.board[r][c];
    const myColor2 = room.myRole === "host" ? "w" : "b";
    if (piece?.color === myColor2) {
      setSelected([r,c]);
      setLegalDots(getLegalMoves(state2, r, c).map(m=>m.to));
    } else {
      setSelected(null); setLegalDots([]);
    }
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
        <p className="text-[var(--text-muted)] text-sm mb-8">{TC_LABELS[room.timeControl] ?? room.timeControl} · Host = Whites</p>

        <div className="flex flex-col gap-3 mb-8">
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            <Avatar name={room.hostName} image={room.hostImage} />
            <div className="flex-1">
              <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Anonymous"}</p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">Host · Whites</p>
            </div>
            <CheckCircle2 size={18} className="text-green-400" />
          </div>
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            {room.guestId ? (
              <>
                <Avatar name={room.guestName} image={room.guestImage} />
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Anonymous"}</p>
                  <p className="text-[0.7rem] text-[var(--text-muted)]">Guest · Blacks</p>
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
    const myColor = room.myRole === "host" ? "white" : "black";
    const iWon = room.winner === myColor;
    const isDraw = room.winner === "draw";
    const reasons: Record<string,string> = { checkmate:"Checkmate",stalemate:"Stalemate — draw",timeout:"Time up",resigned:"Resigned" };
    const state = room.fen ? fromFEN(room.fen) : null;
    const flip = room.myRole === "guest";

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
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {state && (
            <ChessBoard
              state={state} flip={flip}
              selected={null} legalDots={[]} lastMove={room.lastMove}
              disabled compact
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
  const myColor = room.myRole === "host" ? "w" : "b";
  const oppColor = myColor === "w" ? "b" : "w";
  const isMyTurn = state.turn === myColor;
  const flip = myColor === "b"; // black sees board flipped

  const myName = myColor === "w" ? room.hostName : room.guestName;
  const myImage = myColor === "w" ? room.hostImage : room.guestImage;
  const oppName = myColor === "w" ? room.guestName : room.hostName;
  const oppImage = myColor === "w" ? room.guestImage : room.hostImage;

  const myTimeMs = myColor === "w" ? room.whiteTimeMs : room.blackTimeMs;
  const oppTimeMs = myColor === "w" ? room.blackTimeMs : room.whiteTimeMs;

  const inCheck = isInCheck(state, state.turn);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Board column */}
        <div>
          {/* Opponent info */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={oppName} image={oppImage} size={28}/>
            <span className="font-display font-semibold text-[var(--text-primary)] text-sm">{oppName ?? "Соперник"}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1">{oppColor==="w"?"(белые)":"(чёрные)"}</span>
            <div className="ml-auto"><Timer ms={oppTimeMs} active={!isMyTurn && room.timeControl!=="none"}/></div>
          </div>

          <ChessBoard
            state={state}
            flip={flip}
            selected={selected}
            legalDots={legalDots}
            lastMove={room.lastMove}
            onSquare={handleSquare}
            disabled={!isMyTurn}
          />

          {/* My info */}
          <div className="flex items-center gap-3 mt-3">
            <Avatar name={myName} image={myImage} size={28}/>
            <span className="font-display font-semibold text-[var(--text-primary)] text-sm">{myName ?? "Вы"}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1">{myColor==="w"?"(белые)":"(чёрные)"}</span>
            {inCheck && isMyTurn && <span className="text-red-400 text-xs font-bold ml-2">Шах!</span>}
            <div className="ml-auto"><Timer ms={myTimeMs} active={isMyTurn && room.timeControl!=="none"}/></div>
          </div>

          {/* Turn indicator */}
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            {isMyTurn ? "✦ Your turn" : "Waiting for opponent's move…"}
          </p>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full xl:w-60 min-h-[400px]">
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
