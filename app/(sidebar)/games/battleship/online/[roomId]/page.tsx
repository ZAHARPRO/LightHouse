"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, Flag, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Board, Ship, emptyBoard } from "@/lib/battleship";
import { BattleshipPlacement, type ShipRot } from "@/components/BattleshipPlacement";
import GameChat, { type ChatMsg } from "@/components/GameChat";
import SpectatorBadge from "@/components/SpectatorBadge";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import { playBattleshipSound } from "@/lib/gameSounds";

// ─── Константы сетки ─────────────────────────────────────────────────────────
const CELL = 36;
const LABEL_W = 32;

// Cell renders water or miss only — hit marks are separate overlays above ship images
function Cell({
  state, onClick, onMouseEnter,
}: {
  state: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
}) {
  const imgSrc = state === "miss" ? "/battleship/miss.png" : "/battleship/water.png";
  const bg = state === "miss" ? "#3b82f6" : "#1e3a5f";

  return (
    <div
      className="border border-blue-900/40 cursor-pointer select-none relative overflow-hidden flex-shrink-0"
      style={{ width: CELL, height: CELL, backgroundColor: bg }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt="" draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
    </div>
  );
}

// ─── BattleBoard ──────────────────────────────────────────────────────────────
function BattleBoard({
  board, label, interactive = false,
  onCellClick, ships, shipRotations, onlySunk,
}: {
  board: Board;
  label: string;
  interactive?: boolean;
  onCellClick?: (r: number, c: number) => void;
  ships?: Ship[];
  shipRotations?: ShipRot[];
  onlySunk?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <p className="text-center text-xs font-semibold text-[var(--text-secondary)] mb-1">{label}</p>
      <div className="flex" style={{ marginLeft: LABEL_W }}>
        {"ABCDEFGHIJ".split("").map(l => (
          <div key={l} className="text-[var(--text-muted)] text-[0.6rem] text-center flex-shrink-0" style={{ width: CELL }}>{l}</div>
        ))}
      </div>
      <div style={{ position: "relative" }}>
        {board.map((row, r) => (
          <div key={r} className="flex">
            <div className="text-[var(--text-muted)] text-[0.6rem] flex items-center justify-end pr-1 flex-shrink-0"
              style={{ width: LABEL_W }}>{r + 1}</div>
            {row.map((cell, c) => (
              <Cell
                key={c} state={cell}
                onClick={interactive ? () => onCellClick?.(r, c) : undefined}
              />
            ))}
          </div>
        ))}

        {/* Оверлеи кораблей: живые z:1, потопленные (_broke) z:2 */}
        {ships?.map((ship, i) => {
          const rot    = shipRotations?.[i];
          const sorted = [...ship.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          const [sr, sc] = sorted[0];
          const isH   = rot ? rot.isH : (ship.size === 1 ? true : sorted[0][0] === sorted[1][0]);
          const flip  = rot?.flip ?? false;
          const isSunk = ship.cells.every(([r, c]) => board[r][c] === "sunk");
          if (onlySunk && !isSunk) return null;
          const suffix = isSunk ? "_broke" : "";
          const src = `/battleship/ships/ship_${ship.size}_${isH ? "left" : "top"}${suffix}.png`;
          const transform = !flip ? undefined : isH ? "scaleX(-1)" : "scaleY(-1)";
          return (
            <div key={i} style={{
              position: "absolute",
              left: LABEL_W + sc * CELL,
              top:  sr * CELL,
              width:  isH ? ship.size * CELL : CELL,
              height: isH ? CELL : ship.size * CELL,
              pointerEvents: "none",
              zIndex: isSunk ? 2 : 1,
              backgroundColor: "#374151",
              border: "1px solid #4b5563",
              borderRadius: 3,
              boxSizing: "border-box",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "fill", display: "block", transform }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          );
        })}

        {/* Hit marks — z:3, above ship and _broke overlays, transparent cross PNG */}
        {board.flatMap((row, r) =>
          row.map((cell, c) => {
            if (cell !== "hit" && cell !== "sunk") return null;
            return (
              <div
                key={`hm-${r}-${c}`}
                style={{
                  position: "absolute",
                  left: LABEL_W + c * CELL,
                  top: r * CELL,
                  width: CELL, height: CELL,
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/battleship/hit.png" alt="" draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Replay helper ─────────────────────────────────────────────────────────────
type MoveEntry = { shooter: "host" | "guest"; row: number; col: number; hit: boolean; sunk: boolean };

function getBoardsAtIndex(
  moves: MoveEntry[],
  myShips: Ship[],
  myRole: "host" | "guest",
  index: number,
): { myBoard: Board; opponentBoard: Board } {
  const myBoard = emptyBoard();
  for (const ship of myShips) for (const [r, c] of ship.cells) myBoard[r][c] = "ship";
  const opponentBoard = emptyBoard();

  for (let i = 0; i <= index && i < moves.length; i++) {
    const m = moves[i];
    if (m.shooter === myRole) opponentBoard[m.row][m.col] = m.sunk ? "sunk" : m.hit ? "hit" : "miss";
    else myBoard[m.row][m.col] = m.sunk ? "sunk" : m.hit ? "hit" : "miss";
  }
  return { myBoard, opponentBoard };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BattleshipOnlineRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: session } = useSession();
  const t = useTranslations("battleship");

  const [room, setRoom]             = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [connStatus, setConnStatus] = useState<ConnStatus>("ok");
  const connFailsRef                = useRef(0);

  // Placement
  const [myBoard, setMyBoard]             = useState<Board>(emptyBoard());
  const [myShips, setMyShips]             = useState<Ship[]>([]);
  const [shipRotations, setShipRotations] = useState<ShipRot[]>([]);
  const [placed, setPlaced]               = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  // Battle
  const [shooting, setShooting]   = useState(false);
  const [resigning, setResigning] = useState(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  // ─── Fetch room ────────────────────────────────────────────────────────────
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/battleship-rooms/${roomId}`);
      if (!res.ok) {
        connFailsRef.current++;
      } else {
        connFailsRef.current = 0;
        const data = await res.json();
        if (data.room) {
          setRoom(data.room);
          if (data.room.myBoard) setPlaced(true);
        }
        setLoading(false);
      }
    } catch {
      connFailsRef.current++;
    }
    const f = connFailsRef.current;
    setConnStatus(f === 0 ? "ok" : f <= 3 ? "slow" : "lost");
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    const poll = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchRoom();
    }, 1500);
    return () => clearInterval(poll);
  }, [fetchRoom]);

  // Player ping
  useEffect(() => {
    if (!room || !session?.user?.id) return;
    const myRole = session.user.id === room.hostId ? "host"
                 : session.user.id === room.guestId ? "guest" : "spectator";
    if (myRole === "spectator") return;
    const ping = () => fetch(`/api/battleship-rooms/${roomId}/ping`, { method: "POST" }).catch(() => {});
    ping();
    const interval = setInterval(ping, 10_000);
    return () => clearInterval(interval);
  }, [roomId, room?.status, session?.user?.id]);

  // Spectator ping
  useEffect(() => {
    if (!room || room.status !== "PLAYING") return;
    const myRole = session?.user?.id === room.hostId ? "host"
                 : session?.user?.id === room.guestId ? "guest" : "spectator";
    if (myRole !== "spectator") return;
    const fn = () => fetch(`/api/battleship-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    fn();
    const interval = setInterval(fn, 25_000);
    return () => clearInterval(interval);
  }, [roomId, room?.status, session?.user?.id]);

  // ─── Placement complete (called by BattleshipPlacement) ───────────────────
  async function handlePlacementComplete(board: Board, ships: Ship[], rotations: ShipRot[]) {
    setMyBoard(board);
    setMyShips(ships);
    setShipRotations(rotations);
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/battleship-rooms/${roomId}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board, ships }),
      });
      if (res.ok) {
        setPlaced(true);
        await fetchRoom();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Shot ───────────────────────────────────────────────────────────────────
  async function handleShot(r: number, c: number) {
    if (!room || room.status !== "PLAYING" || shooting || replayIndex !== null) return;
    const myRole = session?.user?.id === room.hostId ? "host" : "guest";
    if (room.currentTurn !== myRole) return;

    const opponentBoard: Board = room.opponentBoard ? JSON.parse(room.opponentBoard) : emptyBoard();
    const cell = opponentBoard[r][c];
    if (cell === "hit" || cell === "miss" || cell === "sunk") return;

    setShooting(true);
    try {
      const res = await fetch(`/api/battleship-rooms/${roomId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: r, col: c }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result?.hit) playBattleshipSound("bs_explosion");
        else                  playBattleshipSound("bs_splash");
        if (data.result?.sunk) playBattleshipSound("bs_sunk");
      }
      await fetchRoom();
    } finally {
      setShooting(false);
    }
  }

  // ─── Resign ─────────────────────────────────────────────────────────────────
  async function handleResign() {
    if (!confirm("Resign this game?")) return;
    setResigning(true);
    await fetch(`/api/battleship-rooms/${roomId}/resign`, { method: "POST" }).catch(() => {});
    await fetchRoom();
    setResigning(false);
  }

  // ─── Derived state ───────────────────────────────────────────────────────────
  const userId = session?.user?.id;
  const myRole = userId === room?.hostId ? "host"
               : userId === room?.guestId ? "guest" : "spectator";
  const isMyTurn = room?.currentTurn === myRole;

  const moves: MoveEntry[]    = room?.movesJson ? JSON.parse(room.movesJson) : [];
  const parsedMyShips: Ship[] = room?.myShips   ? JSON.parse(room.myShips)   : myShips;

  const currentMyBoard: Board       = room?.myBoard       ? JSON.parse(room.myBoard)       : myBoard;
  const currentOpponentBoard: Board = room?.opponentBoard ? JSON.parse(room.opponentBoard) : emptyBoard();

  const replayBoards = replayIndex !== null && parsedMyShips.length > 0
    ? getBoardsAtIndex(moves, parsedMyShips, myRole as "host" | "guest", replayIndex)
    : null;

  const displayMyBoard       = replayBoards?.myBoard       ?? currentMyBoard;
  const displayOpponentBoard = replayBoards?.opponentBoard ?? currentOpponentBoard;

  const chatMsgs: ChatMsg[] = room?.chatJson ? JSON.parse(room.chatJson) : [];

  const spectatorCount = room?.spectatorsJson
    ? (JSON.parse(room.spectatorsJson) as { at: number }[]).filter(s => Date.now() - s.at < 60_000).length
    : 0;

  const myDelta = myRole === "host" ? room?.hostEloDelta : room?.guestEloDelta;

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

  if (!room) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <p className="text-[var(--text-muted)]">Room not found.</p>
      <Link href="/games/battleship/online" className="text-orange-400 hover:opacity-80 text-sm">← Back to lobby</Link>
    </div>
  );

  // ─── PLACEMENT ───────────────────────────────────────────────────────────────
  if (room.status === "PLACEMENT" && !placed) {
    return (
      <main className="flex flex-col items-center py-6 px-4 min-h-screen">
        <div className="self-start mb-4">
          <Link href="/games/battleship/online" className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            <ArrowLeft size={14} /> Leave
          </Link>
        </div>

        <BattleshipPlacement
          onComplete={handlePlacementComplete}
          title={t("placement.title")}
          readyLabel={submitting ? "…" : t("placement.ready")}
        />
      </main>
    );
  }

  if (placed && room.status === "PLACEMENT") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        <p className="text-[var(--text-muted)]">{t("placement.waitingOpponent")}</p>
      </div>
    );
  }

  // ─── PLAYING / FINISHED ───────────────────────────────────────────────────────
  const isFinished = room.status === "FINISHED";
  const iWon       = isFinished && room.winner === myRole;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/games/battleship/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Lobby
        </Link>
        {room.rated && (
          <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
            Rated
          </span>
        )}
        <SpectatorBadge count={spectatorCount} />
        <div className="ml-auto">
          <ConnectionBadge status={connStatus} />
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center justify-center gap-4 mb-4 text-sm">
        <span className="font-semibold text-[var(--text-primary)]">
          {room.host?.name ?? "?"}{" "}
          <span className="text-xs text-[var(--text-muted)] font-normal">{room.host?.battleshipElo} ELO</span>
        </span>
        <span className="text-[var(--text-muted)]">vs</span>
        <span className="font-semibold text-[var(--text-primary)]">
          {room.guest?.name ?? "?"}{" "}
          <span className="text-xs text-[var(--text-muted)] font-normal">{room.guest?.battleshipElo} ELO</span>
        </span>
      </div>

      {/* Turn indicator */}
      {room.status === "PLAYING" && (
        <p className={`text-center text-sm font-semibold mb-4 ${isMyTurn ? "text-orange-400" : "text-[var(--text-muted)]"}`}>
          {shooting ? "Firing…" : isMyTurn ? t("battle.yourTurn") : t("battle.opponentTurn")}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        <div className="flex flex-col gap-6 items-center">
          <div className="flex gap-8 flex-wrap justify-center">
            <BattleBoard
              board={displayMyBoard}
              label={t("battle.yourBoard")}
              interactive={false}
              ships={parsedMyShips}
              shipRotations={shipRotations}
            />
            <BattleBoard
              board={displayOpponentBoard}
              label={t("battle.enemyBoard")}
              interactive={isMyTurn && room.status === "PLAYING" && replayIndex === null && !shooting}
              onCellClick={handleShot}
            />
          </div>

          {/* Replay scrubber */}
          {moves.length > 0 && myRole !== "spectator" && parsedMyShips.length > 0 && (
            <div className="flex flex-col gap-1 w-full max-w-sm">
              <div className="flex justify-between text-[0.65rem] text-[var(--text-muted)]">
                <span>{t("replay.title")}</span>
                <span>{replayIndex !== null ? `${t("replay.shot", { n: replayIndex + 1 })} / ${moves.length}` : "Live"}</span>
              </div>
              <input
                type="range"
                min={0}
                max={moves.length - 1}
                value={replayIndex ?? moves.length - 1}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  setReplayIndex(v === moves.length - 1 && !isFinished ? null : v);
                }}
                className="w-full accent-orange-500"
              />
              {replayIndex !== null && (
                <button onClick={() => setReplayIndex(null)} className="text-xs text-orange-400 hover:opacity-70 text-left">
                  ← Back to live
                </button>
              )}
            </div>
          )}

          {/* Resign */}
          {room.status === "PLAYING" && myRole !== "spectator" && (
            <button
              onClick={handleResign}
              disabled={resigning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors text-sm font-display font-semibold"
            >
              {resigning ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
              Resign
            </button>
          )}

          {/* Result */}
          {isFinished && (
            <div className="text-center flex flex-col items-center gap-2">
              <p className={`text-3xl font-display font-extrabold ${iWon ? "text-green-400" : "text-red-400"}`}>
                {iWon ? t("result.victory") : t("result.defeat")}
              </p>
              <p className="text-[var(--text-muted)] text-sm capitalize">{room.winReason?.replace(/_/g, " ")}</p>
              {myDelta !== null && myDelta !== undefined && room.rated && (
                <p className={`text-lg font-bold ${myDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {myDelta >= 0 ? "+" : ""}{myDelta} ELO
                </p>
              )}
              <Link
                href="/games/battleship/online"
                className="mt-2 px-4 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 no-underline"
              >
                New game
              </Link>
            </div>
          )}
        </div>

        {/* Chat */}
        {room.status === "PLAYING" && myRole !== "spectator" && (
          <div className="w-full lg:w-72 shrink-0">
            <GameChat
              msgs={chatMsgs}
              myUserId={userId ?? ""}
              roomId={roomId}
              apiBase="/api/battleship-rooms"
            />
          </div>
        )}
      </div>
    </main>
  );
}
