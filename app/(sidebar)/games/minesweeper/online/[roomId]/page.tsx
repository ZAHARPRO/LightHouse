"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Flag, Bomb, Loader2, Trophy, Skull, LogOut, CheckCircle2, Clock, Wifi } from "lucide-react";
import Image from "next/image";
import { computeNeighbors } from "@/lib/minesweeper";

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
};

const NUM_COLORS: Record<number, string> = {
  1: "text-blue-400", 2: "text-green-400", 3: "text-red-400", 4: "text-purple-400",
  5: "text-orange-400", 6: "text-cyan-400", 7: "text-pink-400", 8: "text-gray-300",
};

const DIFF_LABEL: Record<string, string> = {
  easy: "Легко", medium: "Средне", hard: "Сложно",
};

const WIN_REASON: Record<string, string> = {
  cleared: "очистил поле",
  exploded: "противник подорвался",
  left: "противник вышел",
};

// ── Mini board renderer ───────────────────────────────────────────────────────

interface BoardProps {
  rows: number;
  cols: number;
  mines: number[] | null;
  revealed: number[];
  flagged: number[];
  isHit: boolean;
  interactive: boolean;
  compact?: boolean;
  onReveal?: (idx: number) => void;
  onFlag?: (e: React.MouseEvent, idx: number) => void;
}

function MineBoard({ rows, cols, mines, revealed, flagged, isHit, interactive, compact, onReveal, onFlag }: BoardProps) {
  const mineSet = new Set(mines ?? []);
  const revSet = new Set(revealed);
  const flagSet = new Set(flagged);
  const neighbors = mines ? computeNeighbors(rows, cols, mineSet) : [];
  const total = rows * cols;
  const cellCls = compact ? "w-6 h-6 text-[0.6rem]" : "w-7 h-7 text-xs";

  return (
    <div
      className="overflow-x-auto"
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className="inline-grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {Array.from({ length: total }, (_, idx) => {
          const isRevealed = revSet.has(idx);
          const isMine = mineSet.has(idx);
          const isFlagged = flagSet.has(idx);
          const n = neighbors[idx] ?? 0;

          let bg = interactive
            ? "bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border-[var(--border-subtle)] cursor-pointer"
            : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] cursor-default";
          let content: React.ReactNode = null;

          if (isRevealed) {
            if (isMine) {
              bg = isHit ? "bg-red-500/20 border-red-500/40" : "bg-[var(--bg-card)] border-[var(--border-subtle)]";
              content = <Bomb size={10} className="text-red-400" />;
            } else {
              bg = "bg-[var(--bg-secondary)] border-[var(--border-subtle)]";
              if (n > 0) content = <span className={`font-display font-bold ${NUM_COLORS[n]}`}>{n}</span>;
            }
          } else if (isFlagged) {
            content = <Flag size={10} className="text-[var(--accent-orange)]" />;
          }

          return (
            <button
              key={idx}
              disabled={!interactive || isRevealed}
              className={`${cellCls} flex items-center justify-center rounded border transition-colors duration-75 ${bg}`}
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
  const lastStatusRef = useRef<RoomStatus | null>(null);

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/ms-rooms/${roomId}`);
    if (!res.ok) { setError("Комната не найдена"); return; }
    const data: RoomData = await res.json();
    setRoom(data);
    lastStatusRef.current = data.status;
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchRoom]);

  const doAction = useCallback(async (path: string, body?: object) => {
    await fetch(`/api/ms-rooms/${roomId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    fetchRoom();
  }, [roomId, fetchRoom]);

  const handleReveal = useCallback((idx: number) => doAction("move", { type: "reveal", idx }), [doAction]);
  const handleFlag   = useCallback((e: React.MouseEvent, idx: number) => { e.preventDefault(); doAction("move", { type: "flag", idx }); }, [doAction]);

  async function handleLeave() {
    await doAction("leave");
    router.push("/games/minesweeper/online");
  }

  if (error) return (
    <main className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-[var(--text-muted)]">{error}</p>
      <button onClick={() => router.push("/games/minesweeper/online")} className="mt-4 px-5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-display">
        ← Лобби
      </button>
    </main>
  );

  if (!room) return (
    <main className="flex items-center justify-center py-40">
      <Loader2 size={28} className="animate-spin text-[var(--text-muted)]" />
    </main>
  );

  const myName   = room.myRole === "host" ? room.hostName : room.guestName;
  const oppName  = room.myRole === "host" ? room.guestName : room.hostName;
  const oppImage = room.myRole === "host" ? room.guestImage : room.hostImage;
  const myImage  = room.myRole === "host" ? room.hostImage : room.guestImage;
  const iWon     = room.winner === room.myRole;
  const rows = room.rows ?? 9;
  const cols = room.cols ?? 9;

  // ── WAITING — lobby ────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    const myReady  = room.myRole === "host" ? room.hostReady : room.guestReady;
    const oppReady = room.myRole === "host" ? room.guestReady : room.hostReady;

    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleLeave} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
            ← Выйти
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-display font-semibold">
            <Wifi size={12} /> Ожидание
          </span>
        </div>

        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">Комната</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          {DIFF_LABEL[room.difficulty]} · {cols}×{rows} · {room.mineCount} мин
        </p>

        <div className="flex flex-col gap-3 mb-8">
          {/* Host row */}
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            <Avatar name={room.hostName} image={room.hostImage} />
            <div className="flex-1">
              <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Аноним"}</p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">Хост</p>
            </div>
            <CheckCircle2 size={18} className="text-green-400" />
          </div>

          {/* Guest row */}
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
            {room.guestId ? (
              <>
                <Avatar name={room.guestName} image={room.guestImage} />
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Аноним"}</p>
                  <p className="text-[0.7rem] text-[var(--text-muted)]">Гость</p>
                </div>
                {room.guestReady
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <Clock size={18} className="text-[var(--text-muted)]" />
                }
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border-subtle)]" />
                <p className="text-[var(--text-muted)] text-sm italic">Ожидаем игрока…</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {room.myRole === "guest" && !myReady && (
            <button
              onClick={() => doAction("ready")}
              className="flex-1 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-display font-bold text-sm hover:bg-green-500/25 transition-colors"
            >
              Готов!
            </button>
          )}
          {room.myRole === "guest" && myReady && (
            <button
              onClick={() => doAction("ready")}
              className="flex-1 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors"
            >
              Отменить готовность
            </button>
          )}
          {room.myRole === "host" && (
            <button
              onClick={() => doAction("start")}
              disabled={!room.guestId || !room.guestReady}
              className="flex-1 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              {!room.guestId ? "Ждём соперника…" : !room.guestReady ? "Соперник не готов" : "Начать!"}
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── FINISHED — review ──────────────────────────────────────────────────────
  if (room.status === "FINISHED") {
    const reason = room.winReason ? WIN_REASON[room.winReason] ?? room.winReason : "";
    const winnerName = room.winner === "host" ? room.hostName : room.guestName;

    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          {iWon ? (
            <div className="flex flex-col items-center gap-2">
              <Trophy size={40} className="text-yellow-400" />
              <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Победа!</h1>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Skull size={40} className="text-red-400" />
              <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Поражение</h1>
            </div>
          )}
          <p className="text-[var(--text-muted)] mt-2 text-sm">
            <span className="font-semibold text-[var(--text-secondary)]">{winnerName ?? "Кто-то"}</span> победил — {reason}
          </p>
        </div>

        {/* Review boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* My board */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={myName} image={myImage} size={28} />
              <span className="font-display font-bold text-[var(--text-primary)] text-sm">{myName ?? "Ты"}</span>
              {!iWon && <Skull size={14} className="text-red-400 ml-auto" />}
              {iWon && <Trophy size={14} className="text-yellow-400 ml-auto" />}
            </div>
            <MineBoard
              rows={rows} cols={cols}
              mines={room.myMines} revealed={room.myRevealed} flagged={room.myFlagged}
              isHit={room.myHit} interactive={false} compact
            />
          </div>
          {/* Opp board */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={oppName} image={oppImage} size={28} />
              <span className="font-display font-bold text-[var(--text-primary)] text-sm">{oppName ?? "Соперник"}</span>
              {iWon && <Skull size={14} className="text-red-400 ml-auto" />}
              {!iWon && <Trophy size={14} className="text-yellow-400 ml-auto" />}
            </div>
            <MineBoard
              rows={rows} cols={cols}
              mines={room.oppMines} revealed={room.oppRevealed} flagged={room.oppFlagged}
              isHit={room.oppHit} interactive={false} compact
            />
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => router.push("/games/minesweeper/online")}
            className="px-6 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors"
          >
            ← В лобби
          </button>
        </div>
      </main>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  const myFlagsLeft = (room.mineCount ?? 0) - room.myFlagged.length;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-green-400 font-display font-semibold">
          <Wifi size={12} /> Онлайн
        </div>
        <span className="text-[var(--text-muted)] text-xs">{DIFF_LABEL[room.difficulty]}</span>
        <div className="ml-auto flex items-center gap-2">
          <Flag size={13} className="text-[var(--accent-orange)]" />
          <span className="text-[var(--text-secondary)] font-display font-semibold text-sm">{myFlagsLeft}</span>
          <button
            onClick={handleLeave}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors"
          >
            <LogOut size={12} /> Сдаться
          </button>
        </div>
      </div>

      {/* Boards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* My board */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Avatar name={myName} image={myImage} size={28} />
            <span className="font-display font-bold text-[var(--text-primary)] text-sm">{myName ?? "Ты"}</span>
            <span className="ml-auto text-[0.7rem] text-[var(--text-muted)]">
              {room.myHit ? "💥 Взрыв" : "Твоё поле"}
            </span>
          </div>
          <MineBoard
            rows={rows} cols={cols}
            mines={room.myMines} revealed={room.myRevealed} flagged={room.myFlagged}
            isHit={room.myHit} interactive={!room.myHit}
            onReveal={handleReveal} onFlag={handleFlag}
          />
        </div>

        {/* Opponent board */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            {room.guestId ? (
              <>
                <Avatar name={oppName} image={oppImage} size={28} />
                <span className="font-display font-bold text-[var(--text-primary)] text-sm">{oppName ?? "Соперник"}</span>
                <span className="ml-auto text-[0.7rem] text-[var(--text-muted)]">
                  {room.oppHit ? "💥 Взрыв" : "Поле соперника"}
                </span>
              </>
            ) : (
              <p className="text-[var(--text-muted)] italic text-sm">Соперник не подключён</p>
            )}
          </div>
          <MineBoard
            rows={rows} cols={cols}
            mines={null} revealed={room.oppRevealed} flagged={room.oppFlagged}
            isHit={room.oppHit} interactive={false}
          />
        </div>
      </div>

      <p className="text-center text-[var(--text-muted)] text-xs mt-6">
        Нажми ЛКМ чтобы открыть клетку · ПКМ чтобы поставить флаг
      </p>
    </main>
  );
}
