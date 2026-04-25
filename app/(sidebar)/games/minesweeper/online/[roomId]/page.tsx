"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Flag, Bomb, Loader2, Trophy, Skull, LogOut, CheckCircle2, Clock, Wifi, Star } from "lucide-react";
import Image from "next/image";
import { computeNeighbors, floodReveal } from "@/lib/minesweeper";
import { getRank } from "@/lib/elo";
import GameReportButton from "@/components/GameReportButton";

type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

type RoomData = {
  id: string;
  status: RoomStatus;
  difficulty: string;
  rows: number | null;
  cols: number | null;
  mineCount: number | null;
  myRole: "host" | "guest" | "spectator";
  hostReady: boolean;
  guestReady: boolean;
  hostId: string;
  hostName: string | null;
  hostImage: string | null;
  guestId: string | null;
  guestName: string | null;
  guestImage: string | null;
  myMines: number[] | null;
  myRevealed: number[];
  myFlagged: number[];
  myHit: boolean;
  oppMines: number[] | null;
  oppRevealed: number[];
  oppFlagged: number[];
  oppHit: boolean;
  winner: string | null;
  winReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  rated: boolean;
  hostEloDelta: number | null;
  guestEloDelta: number | null;
};

const NUM_COLORS: Record<number, string> = {
  1: "text-blue-400", 2: "text-green-400", 3: "text-red-400", 4: "text-purple-400",
  5: "text-orange-400", 6: "text-cyan-400", 7: "text-pink-400", 8: "text-gray-300",
};

const DIFF_LABEL: Record<string, string> = {
  easy: "Easy", medium: "Medium", hard: "Hard",
};

const WIN_REASON: Record<string, string> = {
  cleared: "cleared the board",
  exploded: "opponent hit a mine",
  left: "opponent left",
};

// ── Cell size helpers ─────────────────────────────────────────────────────────
// main (interactive) board cell size in px based on column count
function mainCellPx(cols: number): number {
  if (cols >= 30) return 18;  // hard:   30 cols → board ~600px
  if (cols >= 16) return 22;  // medium: 16 cols → board ~382px
  return 28;                   // easy:    9 cols → board ~268px
}
// compact (view-only) opponent board
function oppCellPx(cols: number): number {
  if (cols >= 30) return 13;
  if (cols >= 16) return 15;
  return 20;
}
// both boards compact (FINISHED review)
function finCellPx(cols: number): number {
  if (cols >= 30) return 14;
  if (cols >= 16) return 17;
  return 22;
}
// breakpoint at which boards go side-by-side
function rowBreakClass(cols: number): string {
  if (cols >= 30) return "xl:flex-row";  // ~1150px needed
  if (cols >= 16) return "lg:flex-row";  // ~700px needed
  return "md:flex-row";                  // ~500px needed
}
function finBreakClass(cols: number): string {
  if (cols >= 30) return "xl:grid-cols-2";
  return "md:grid-cols-2";
}

// ── Mini board renderer ───────────────────────────────────────────────────────

interface BoardProps {
  rows: number;
  cols: number;
  mines: number[] | null;
  revealed: number[];
  flagged: number[];
  isHit: boolean;
  interactive: boolean;
  cellPx?: number;
  onReveal?: (idx: number) => void;
  onFlag?: (e: React.MouseEvent, idx: number) => void;
}

function MineBoard({ rows, cols, mines, revealed, flagged, isHit, interactive, cellPx = 28, onReveal, onFlag }: BoardProps) {
  const mineSet = new Set(mines ?? []);
  const revSet  = new Set(revealed);
  const flagSet = new Set(flagged);
  const neighbors = mines ? computeNeighbors(rows, cols, mineSet) : [];
  const total     = rows * cols;
  const iconPx    = Math.max(8, Math.floor(cellPx * 0.48));
  const fontPx    = Math.max(7, Math.floor(cellPx * 0.42));

  return (
    <div className="overflow-x-auto" onContextMenu={e => e.preventDefault()}>
      <div
        className="inline-grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cols}, ${cellPx}px)` }}
      >
        {Array.from({ length: total }, (_, idx) => {
          const isRevealed = revSet.has(idx);
          const isMine     = mineSet.has(idx);
          const isFlagged  = flagSet.has(idx);
          const n          = neighbors[idx] ?? 0;

          let bgCls = interactive
            ? "bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border-[var(--border-subtle)] cursor-pointer"
            : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] cursor-default";
          let content: React.ReactNode = null;

          if (isRevealed) {
            if (isMine) {
              bgCls = isHit ? "bg-red-500/20 border-red-500/40" : "bg-[var(--bg-card)] border-[var(--border-subtle)]";
              content = <Bomb size={iconPx} className="text-red-400" />;
            } else {
              bgCls = "bg-[var(--bg-secondary)] border-[var(--border-subtle)]";
              if (n > 0) content = <span className={`font-display font-bold ${NUM_COLORS[n]}`} style={{ fontSize: fontPx }}>{n}</span>;
            }
          } else if (isFlagged) {
            content = <Flag size={iconPx} className="text-[var(--accent-orange)]" />;
          }

          return (
            <button
              key={idx}
              disabled={!interactive || isRevealed}
              style={{ width: cellPx, height: cellPx }}
              className={`flex items-center justify-center rounded border transition-colors duration-75 ${bgCls}`}
              onClick={() => interactive && onReveal?.(idx)}
              onContextMenu={e => interactive && onFlag?.(e, idx)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Player avatar ─────────────────────────────────────────────────────────────

function Avatar({ name, image, size = 32 }: { name: string | null; image: string | null; size?: number }) {
  if (image) return <Image src={image} alt="" width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />;
  return (
    <div
      className="rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name?.[0] ?? "?"}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/ms-rooms/${roomId}`);
    if (!res.ok) { setError("Room not found"); return; }
    setRoom(await res.json());
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, 400);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchRoom]);

  const doAction = useCallback(async (path: string, body?: object) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await fetch(`/api/ms-rooms/${roomId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    await fetchRoom();
    pollRef.current = setInterval(fetchRoom, 400);
  }, [roomId, fetchRoom]);

  const handleReveal = useCallback((idx: number) => {
    setRoom(r => {
      if (!r) return r;
      // Optimistic reveal only when mines are already placed
      if (r.myMines) {
        const mineSet   = new Set(r.myMines);
        const revealed  = new Set(r.myRevealed);
        if (mineSet.has(idx)) {
          // Hit a mine — reveal all mines immediately
          const exploded = new Set(revealed);
          for (const m of mineSet) exploded.add(m);
          return { ...r, myRevealed: [...exploded], myHit: true };
        }
        const neighbors = computeNeighbors(r.rows!, r.cols!, mineSet);
        const next = floodReveal(r.rows!, r.cols!, mineSet, neighbors, revealed, idx);
        return { ...r, myRevealed: [...next] };
      }
      return r; // first click — can't predict, wait for server
    });
    doAction("move", { type: "reveal", idx });
  }, [doAction]);

  const handleFlag = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    setRoom(r => {
      if (!r) return r;
      const flagged = new Set(r.myFlagged);
      if (flagged.has(idx)) flagged.delete(idx); else flagged.add(idx);
      return { ...r, myFlagged: [...flagged] };
    });
    doAction("move", { type: "flag", idx });
  }, [doAction]);

  async function handleLeave() {
    await doAction("leave");
    router.push("/games/minesweeper/online");
  }

  if (error) return (
    <main className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-[var(--text-muted)]">{error}</p>
      <button onClick={() => router.push("/games/minesweeper/online")}
        className="mt-4 px-5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-display">
        ← Lobby
      </button>
    </main>
  );

  if (!room) return (
    <main className="flex items-center justify-center py-40">
      <Loader2 size={28} className="animate-spin text-[var(--text-muted)]" />
    </main>
  );

  const myName   = room.myRole === "host" ? room.hostName  : room.guestName;
  const oppName  = room.myRole === "host" ? room.guestName : room.hostName;
  const oppImage = room.myRole === "host" ? room.guestImage : room.hostImage;
  const myImage  = room.myRole === "host" ? room.hostImage  : room.guestImage;
  const iWon     = room.winner === room.myRole;
  const rows     = room.rows ?? 9;
  const cols     = room.cols ?? 9;

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    const myReady  = room.myRole === "host" ? room.hostReady : room.guestReady;

    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleLeave} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Leave</button>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-display font-semibold">
            <Wifi size={12} /> Waiting
          </span>
        </div>

        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">Room</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          {DIFF_LABEL[room.difficulty]} · {cols}×{rows} · {room.mineCount} mines
        </p>

        <div className="flex flex-col gap-3 mb-8">
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            <Avatar name={room.hostName} image={room.hostImage} />
            <div className="flex-1">
              <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Аноним"}</p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">Host</p>
            </div>
            <CheckCircle2 size={18} className="text-green-400" />
          </div>

          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            {room.guestId ? (
              <>
                <Avatar name={room.guestName} image={room.guestImage} />
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Аноним"}</p>
                  <p className="text-[0.7rem] text-[var(--text-muted)]">Guest</p>
                </div>
                {room.guestReady
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <Clock size={18} className="text-[var(--text-muted)]" />}
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
          {room.myRole === "guest" && !myReady && (
            <button onClick={() => doAction("ready")}
              className="flex-1 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-display font-bold text-sm hover:bg-green-500/25 transition-colors">
              Ready!
            </button>
          )}
          {room.myRole === "guest" && myReady && (
            <button onClick={() => doAction("ready")}
              className="flex-1 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors">
              Cancel Ready
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
    const reason     = room.winReason ? WIN_REASON[room.winReason] ?? room.winReason : "";
    const winnerName = room.winner === "host" ? room.hostName : room.guestName;
    const fPx        = finCellPx(cols);
    const fBreak     = finBreakClass(cols);

    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          {iWon ? (
            <div className="flex flex-col items-center gap-2">
              <Trophy size={40} className="text-yellow-400" />
              <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Victory!</h1>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Skull size={40} className="text-red-400" />
              <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Defeat</h1>
            </div>
          )}
          <p className="text-[var(--text-muted)] mt-2 text-sm">
            <span className="font-semibold text-[var(--text-secondary)]">{winnerName ?? "Someone"}</span> won — {reason}
          </p>
          {room.rated && (() => {
            const myDelta = room.myRole === "host" ? room.hostEloDelta : room.guestEloDelta;
            if (myDelta == null) return null;
            return (
              <div className={`mt-2 font-display font-bold text-xl ${myDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                {myDelta >= 0 ? "+" : ""}{myDelta} ELO
              </div>
            );
          })()}
        </div>

        <div className={`grid grid-cols-1 ${fBreak} gap-6 mb-8`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={myName} image={myImage} size={26} />
              <span className="font-display font-bold text-[var(--text-primary)] text-sm">{myName ?? "You"}</span>
              {iWon
                ? <Trophy size={13} className="text-yellow-400 ml-auto" />
                : <Skull size={13} className="text-red-400 ml-auto" />}
            </div>
            <MineBoard rows={rows} cols={cols} mines={room.myMines} revealed={room.myRevealed} flagged={room.myFlagged}
              isHit={room.myHit} interactive={false} cellPx={fPx} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={oppName} image={oppImage} size={26} />
              <span className="font-display font-bold text-[var(--text-primary)] text-sm">{oppName ?? "Opponent"}</span>
              {iWon
                ? <Skull size={13} className="text-red-400 ml-auto" />
                : <Trophy size={13} className="text-yellow-400 ml-auto" />}
            </div>
            <MineBoard rows={rows} cols={cols} mines={room.oppMines} revealed={room.oppRevealed} flagged={room.oppFlagged}
              isHit={room.oppHit} interactive={false} cellPx={fPx} />
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={() => router.push("/games/minesweeper/online")}
            className="px-6 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors">
            ← Back to Lobby
          </button>
        </div>
      </main>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  const mPx       = mainCellPx(cols);
  const oPx       = oppCellPx(cols);
  const rBreak    = rowBreakClass(cols);
  const myFlagsLeft = (room.mineCount ?? 0) - room.myFlagged.length;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-green-400 font-display font-semibold">
          <Wifi size={12} /> Online
        </span>
        {room.rated && (
          <span className="flex items-center gap-1 text-xs text-yellow-400 font-display font-bold bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
            <Star size={10} /> Rated
          </span>
        )}
        <span className="text-[var(--text-muted)] text-xs">{DIFF_LABEL[room.difficulty]} · {cols}×{rows}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-display font-semibold text-[var(--text-secondary)]">
            <Flag size={13} className="text-[var(--accent-orange)]" />
            {myFlagsLeft}
          </span>
          {room.guestId && (
            <GameReportButton
              targetId={room.myRole === "host" ? (room.guestId ?? "") : room.hostId}
              targetName={oppName ?? "Opponent"}
              game="minesweeper"
              roomId={room.id}
            />
          )}
          <button onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
            <LogOut size={12} /> Surrender
          </button>
        </div>
      </div>

      {/* Boards — stacked on small screens, side-by-side on wider */}
      <div className={`flex flex-col ${rBreak} gap-6 items-start`}>

        {/* My board — interactive, larger cells */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Avatar name={myName} image={myImage} size={26} />
            <span className="font-display font-bold text-[var(--text-primary)] text-sm">{myName ?? "You"}</span>
            <span className="ml-auto text-[0.7rem] text-[var(--text-muted)]">
              {room.myHit ? "💥 Explosion" : "Your field"}
            </span>
          </div>
          <MineBoard rows={rows} cols={cols} mines={room.myMines} revealed={room.myRevealed} flagged={room.myFlagged}
            isHit={room.myHit} interactive={!room.myHit} cellPx={mPx}
            onReveal={handleReveal} onFlag={handleFlag} />
        </div>

        {/* Divider on mobile only */}
        <div className={`w-full border-t border-[var(--border-subtle)] ${rBreak.replace("flex-row", "hidden")}`} />

        {/* Opponent board — view-only, compact cells */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {room.guestId ? (
              <>
                <Avatar name={oppName} image={oppImage} size={26} />
                <span className="font-display font-bold text-[var(--text-primary)] text-sm">{oppName ?? "Opponent"}</span>
                <span className="ml-auto text-[0.7rem] text-[var(--text-muted)]">
                  {room.oppHit ? "💥 Explosion" : "Opponent's field"}
                </span>
              </>
            ) : (
              <p className="text-[var(--text-muted)] italic text-sm">Opponent not connected</p>
            )}
          </div>
          <MineBoard rows={rows} cols={cols} mines={null} revealed={room.oppRevealed} flagged={room.oppFlagged}
            isHit={room.oppHit} interactive={false} cellPx={oPx} />
        </div>
      </div>

      <p className="text-[var(--text-muted)] text-xs mt-5 text-center">
        LMB — reveal · RMB — flag
      </p>
    </main>
  );
}
