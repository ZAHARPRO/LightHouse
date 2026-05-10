"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Flag, CheckCircle2, Eye, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRank } from "@/lib/elo";
import GameChat, { type ChatMsg } from "@/components/GameChat";
import SpectatorBadge from "@/components/SpectatorBadge";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import { preloadSounds, playSound } from "@/lib/gameSounds";
import {
  initialState, simulateShot, deserializeState,
  BilliardsState, BilliardsShot, ShotRecord, decodeShots,
  TABLE_W, TABLE_H, BALL_R, POCKETS, POCKET_R,
  PF_LEFT, PF_RIGHT, PF_TOP, PF_BOTTOM,
  remainingBalls,
} from "@/lib/billiards";

// ── Types ────────────────────────────────────────────────────────────────────
type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

type RoomData = {
  id: string;
  status: RoomStatus;
  timeControl: string;
  myRole: "host" | "guest" | "spectator";
  hostId: string; hostName: string | null; hostImage: string | null;
  guestId: string | null; guestName: string | null; guestImage: string | null;
  hostReady: boolean; guestReady: boolean;
  currentTurn: "host" | "guest";
  hostGroup: "solids" | "stripes" | null;
  guestGroup: "solids" | "stripes" | null;
  phase: "playing" | "cue_in_hand";
  ballsJson: string | null;
  shotsJson: string | null;
  hostTimeMs: number | null;
  guestTimeMs: number | null;
  winner: string | null; winReason: string | null;
  startedAt: string | null; endedAt: string | null;
  rated: boolean;
  hostElo: number | null; guestElo: number | null;
  hostEloDelta: number | null; guestEloDelta: number | null;
  chat: ChatMsg[];
  spectatorCount: number;
};

// ── Canvas helpers ───────────────────────────────────────────────────────────
const BALL_COLORS: Record<number, string> = {
  1: "#f7d000", 2: "#1a5cdb", 3: "#e03030", 4: "#6a1a8a", 5: "#e07020",
  6: "#157a3a", 7: "#8b1a1a", 8: "#222222",
  9: "#f7d000", 10: "#1a5cdb", 11: "#e03030", 12: "#6a1a8a", 13: "#e07020",
  14: "#157a3a", 15: "#8b1a1a",
};

function drawTable(ctx: CanvasRenderingContext2D, scale: number) {
  const W = TABLE_W * scale, H = TABLE_H * scale;
  ctx.fillStyle = "#1a7a3c"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0f5628";
  ctx.fillRect(0, 0, W, PF_TOP * scale);
  ctx.fillRect(0, (TABLE_H - PF_TOP) * scale, W, PF_TOP * scale);
  ctx.fillRect(0, 0, PF_LEFT * scale, H);
  ctx.fillRect((TABLE_W - PF_LEFT) * scale, 0, PF_LEFT * scale, H);
  ctx.setLineDash([3 * scale, 5 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.7 * scale;
  ctx.beginPath(); ctx.moveTo(TABLE_W * 0.25 * scale, PF_TOP * scale); ctx.lineTo(TABLE_W * 0.25 * scale, PF_BOTTOM * scale); ctx.stroke();
  ctx.setLineDash([]);
}

function drawPockets(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.fillStyle = "#0a0a0a";
  for (const [px, py] of POCKETS) {
    ctx.beginPath(); ctx.arc(px * scale, py * scale, POCKET_R * scale, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, scale: number) {
  const r = BALL_R * scale;
  const cx = x * scale, cy = y * scale;
  const isStripe = id >= 9 && id <= 15;
  const color = id === 0 ? "#f0f0f0" : BALL_COLORS[id] ?? "#888";

  if (isStripe) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f0f0f0"; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = color; ctx.fillRect(cx - r, cy - r * 0.45, r * 2, r * 0.9);
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }
  if (id !== 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.fillStyle = "#111"; ctx.font = `bold ${Math.round(r * 0.46)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(id), cx, cy + 0.5);
  }
  const grad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.3, r * 0.04, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.38)"); grad.addColorStop(0.45, "rgba(255,255,255,0)"); grad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8 * scale; ctx.stroke();
}

function drawAimLine(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number) {
  ctx.save(); ctx.setLineDash([4 * scale, 4 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 0.8 * scale;
  ctx.beginPath(); ctx.moveTo(cx * scale, cy * scale);
  ctx.lineTo(cx * scale + Math.cos(angle) * 200 * scale, cy * scale + Math.sin(angle) * 200 * scale);
  ctx.stroke(); ctx.restore();
}

function drawCueStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number) {
  const r = BALL_R * scale, startDist = r + 8 * scale, len = 160 * scale;
  const sx = cx * scale - Math.cos(angle) * startDist;
  const sy = cy * scale - Math.sin(angle) * startDist;
  const ex = cx * scale - Math.cos(angle) * (startDist + len);
  const ey = cy * scale - Math.sin(angle) * (startDist + len);
  const grad = ctx.createLinearGradient(sx, sy, ex, ey);
  grad.addColorStop(0, "#c8a96e"); grad.addColorStop(0.2, "#a0784a"); grad.addColorStop(1, "#5c3d20");
  ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = Math.max(3 * scale, 2);
  ctx.strokeStyle = grad; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore();
}

function useScale() {
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    function compute() {
      const maxW = Math.min(window.innerWidth - 32, 700);
      const maxH = Math.min(window.innerHeight - 320, 350);
      setScale(Math.max(0.4, Math.min(maxW / TABLE_W, maxH / TABLE_H, 1)));
    }
    compute(); window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

function fmtMs(ms: number | null) {
  if (ms === null) return "∞";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Replay shot panel ────────────────────────────────────────────────────────
function ReplayShotPanel({ shots, replayIdx, onReplay }: {
  shots: ShotRecord[]; replayIdx: number | null; onReplay: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replayIdx === null && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [shots.length, replayIdx]);

  return (
    <div className="flex flex-col min-h-0 gap-1">
      <div ref={ref} className="overflow-y-auto max-h-36 flex flex-col gap-px">
        {shots.length === 0 && <p className="text-[var(--text-muted)] text-xs italic py-2 px-1">No shots yet</p>}
        {shots.map((s, i) => (
          <button key={i} onClick={() => onReplay(i)}
            className={["flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors",
              replayIdx === i ? "bg-pink-500/20 text-[var(--accent-orange)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            ].join(" ")}>
            <span className="font-mono text-[var(--text-muted)] w-5 shrink-0">{i + 1}.</span>
            <span className="font-semibold capitalize">{s.by}</span>
            {s.pocketed.filter(id => id !== 0).length > 0 && <span className="text-green-400">+{s.pocketed.filter(id => id !== 0).length}</span>}
            {s.foul && <span className="text-red-400 text-[0.65rem]">FOUL</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5 pt-1 border-t border-[var(--border-subtle)]">
        <button onClick={() => onReplay(0)} disabled={!shots.length || replayIdx === 0}
          className="px-2 py-0.5 text-base leading-none text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 font-mono">«</button>
        <button onClick={() => onReplay(replayIdx !== null ? Math.max(0, replayIdx - 1) : shots.length - 1)}
          disabled={!shots.length || replayIdx === 0}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <ChevronLeft size={14} />
        </button>
        <span className="flex-1 text-center text-[0.65rem] font-mono text-[var(--text-muted)]">
          {replayIdx !== null ? `${replayIdx + 1}/${shots.length}` : `${shots.length}/${shots.length}`}
        </span>
        <button onClick={() => onReplay(replayIdx !== null ? Math.min(shots.length - 1, replayIdx + 1) : null)}
          disabled={!shots.length || replayIdx === shots.length - 1}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onReplay(null)} disabled={replayIdx === null}
          className="px-2 py-0.5 text-base leading-none text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 font-mono">»</button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function BilliardsOnlineRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const scale = useScale();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("ok");
  const [aimAngle, setAimAngle] = useState(Math.PI);
  const [power, setPower] = useState(0.5);
  const [cueHandPos, setCueHandPos] = useState<{ x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/billiards-rooms/${roomId}`);
      if (!res.ok) { setConnStatus("lost"); return; }
      const data: RoomData = await res.json();
      setRoom(prev => {
        if (prev && prev.status !== data.status && data.status === "PLAYING") playSound("match_start");
        if (prev?.currentTurn !== data.currentTurn) setReplayIdx(null);
        return data;
      });
      setConnStatus("ok");
    } catch {
      setConnStatus("lost");
    }
  }, [roomId]);

  useEffect(() => { preloadSounds(); fetchRoom(); }, [fetchRoom]);
  useEffect(() => {
    const t = setInterval(fetchRoom, 400);
    return () => clearInterval(t);
  }, [fetchRoom]);

  // Ping to track connection
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`/api/billiards-rooms/${roomId}/ping`, { method: "POST" }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [roomId]);

  // Spectate heartbeat
  useEffect(() => {
    if (room?.myRole !== "spectator") return;
    fetch(`/api/billiards-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    const t = setInterval(() => {
      fetch(`/api/billiards-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [roomId, room?.myRole]);

  // Compute display state
  const shots: ShotRecord[] = room?.shotsJson ? decodeShots(room.shotsJson) : [];

  const displayState: BilliardsState = (() => {
    if (replayIdx === null && room?.ballsJson) {
      return deserializeState(room.ballsJson);
    }
    if (replayIdx !== null && shots.length > 0) {
      let s = initialState();
      for (let i = 0; i <= replayIdx && i < shots.length; i++) {
        const res = simulateShot(s, shots[i].shot);
        s = res.newState;
      }
      return s;
    }
    return initialState();
  })();

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = TABLE_W * scale; canvas.height = TABLE_H * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTable(ctx, scale); drawPockets(ctx, scale);

    const isMyTurn = room?.myRole !== "spectator" && room?.currentTurn === room?.myRole && room?.status === "PLAYING" && replayIdx === null;
    const cueBall = displayState.balls.find(b => b.id === 0 && !b.pocketed);

    if (isMyTurn && cueBall) {
      const pos = displayState.phase === "cue_in_hand" ? (cueHandPos ?? cueBall) : cueBall;
      drawAimLine(ctx, pos.x, pos.y, aimAngle, scale);
      if (displayState.phase !== "cue_in_hand" || cueHandPos) drawCueStick(ctx, pos.x, pos.y, aimAngle, scale);
    }

    for (const b of displayState.balls) {
      if (b.pocketed) continue;
      drawBall(ctx, b.id, b.x, b.y, scale);
    }

    // Ghost cue ball in hand
    if (isMyTurn && displayState.phase === "cue_in_hand" && cueHandPos) {
      ctx.globalAlpha = 0.5; drawBall(ctx, 0, cueHandPos.x, cueHandPos.y, scale); ctx.globalAlpha = 1;
    }
  }, [displayState, scale, aimAngle, room, replayIdx, cueHandPos]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!room || room.myRole === "spectator" || room.status !== "PLAYING" || room.currentTurn !== room.myRole || replayIdx !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    if (displayState.phase === "cue_in_hand") {
      const cx = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, mx));
      const cy = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, my));
      setCueHandPos({ x: cx, y: cy });
      return;
    }
    const cue = displayState.balls.find(b => b.id === 0 && !b.pocketed);
    if (!cue) return;
    setAimAngle(Math.atan2(my - cue.y, mx - cue.x) + Math.PI);
  }

  function handleCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!room || room.myRole === "spectator" || room.currentTurn !== room.myRole || displayState.phase === "cue_in_hand" || replayIdx !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const cue = displayState.balls.find(b => b.id === 0 && !b.pocketed);
    if (!cue) return;
    setAimAngle(Math.atan2(my - cue.y, mx - cue.x) + Math.PI);
  }

  async function handleShoot() {
    if (!room || submitting) return;
    setSubmitting(true);
    try {
      const shot: BilliardsShot = {
        angle: aimAngle, power,
        ...(displayState.phase === "cue_in_hand" ? {
          cueX: cueHandPos?.x ?? TABLE_W * 0.25,
          cueY: cueHandPos?.y ?? TABLE_H / 2,
        } : {}),
      };
      const res = await fetch(`/api/billiards-rooms/${roomId}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shot),
      });
      if (res.ok) {
        playSound("bl_cue_strike");
        setCueHandPos(null);
        await fetchRoom();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReady() {
    await fetch(`/api/billiards-rooms/${roomId}/ready`, { method: "POST" });
    fetchRoom();
  }

  async function handleStart() {
    await fetch(`/api/billiards-rooms/${roomId}/start`, { method: "POST" });
    fetchRoom();
  }

  async function handleResign() {
    if (!confirm("Resign this game?")) return;
    await fetch(`/api/billiards-rooms/${roomId}/resign`, { method: "POST" });
    fetchRoom();
  }

  if (!room) {
    return (
      <main className="flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
        <Loader2 size={32} className="animate-spin text-[var(--text-muted)]" />
      </main>
    );
  }

  const isHost  = room.myRole === "host";
  const isGuest = room.myRole === "guest";
  const isPlayer = isHost || isGuest;
  const isMyTurn = isPlayer && room.currentTurn === room.myRole && room.status === "PLAYING" && replayIdx === null;
  const myName   = isHost ? room.hostName : isGuest ? room.guestName : null;
  const oppName  = isHost ? room.guestName : isGuest ? room.hostName : null;
  const myElo    = isHost ? room.hostElo : room.guestElo;
  const oppElo   = isHost ? room.guestElo : room.hostElo;
  const myEloDelta  = isHost ? room.hostEloDelta : room.guestEloDelta;
  const myGroup  = isHost ? room.hostGroup : room.guestGroup;
  const oppGroup = isHost ? room.guestGroup : room.hostGroup;
  const myTimeMs  = isHost ? room.hostTimeMs : room.guestTimeMs;
  const oppTimeMs = isHost ? room.guestTimeMs : room.hostTimeMs;
  const myRank   = myElo ? getRank(myElo) : null;
  const oppRank  = oppElo ? getRank(oppElo) : null;
  const myRemaining  = myGroup ? remainingBalls(displayState, myGroup) : [];
  const oppRemaining = oppGroup ? remainingBalls(displayState, oppGroup) : [];

  // ── WAITING lobby ────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <Link href="/games/billiards/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm mb-6 block">← Back</Link>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <h1 className="text-xl font-display font-extrabold text-[var(--text-primary)] mb-4">🎱 Billiards Room</h1>

          <div className="flex flex-col gap-3 mb-6">
            {/* Host */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
              {room.hostImage
                ? <Image src={room.hostImage} alt="" width={36} height={36} className="rounded-full" />
                : <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold">{room.hostName?.[0] ?? "?"}</div>
              }
              <div className="flex-1">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Host"}</p>
                <p className="text-xs text-[var(--text-muted)]">Host {room.hostElo ? `· ELO ${room.hostElo}` : ""}</p>
              </div>
              <CheckCircle2 size={18} className="text-green-400" />
            </div>

            {/* Guest slot */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
              {room.guestId ? (
                <>
                  {room.guestImage
                    ? <Image src={room.guestImage} alt="" width={36} height={36} className="rounded-full" />
                    : <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">{room.guestName?.[0] ?? "?"}</div>
                  }
                  <div className="flex-1">
                    <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Guest"}</p>
                    <p className="text-xs text-[var(--text-muted)]">Guest {room.guestElo ? `· ELO ${room.guestElo}` : ""}</p>
                  </div>
                  {room.guestReady
                    ? <CheckCircle2 size={18} className="text-green-400" />
                    : <span className="text-xs text-[var(--text-muted)]">Not ready</span>
                  }
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center">
                    <span className="text-[var(--text-muted)] text-lg">?</span>
                  </div>
                  <p className="text-[var(--text-muted)] text-sm">Waiting for opponent…</p>
                  <Loader2 size={16} className="animate-spin text-[var(--text-muted)] ml-auto" />
                </>
              )}
            </div>
          </div>

          {/* Guest: ready toggle */}
          {isGuest && (
            <button onClick={handleReady}
              className={["flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all",
                room.guestReady
                  ? "bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/10"
                  : "bg-[var(--accent-orange)] text-white hover:opacity-90"
              ].join(" ")}>
              <CheckCircle2 size={15} />
              {room.guestReady ? "Cancel Ready" : "Ready!"}
            </button>
          )}

          {/* Host: start */}
          {isHost && (
            <button onClick={handleStart} disabled={!room.guestId || !room.guestReady}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity">
              Start Game
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── FINISHED ─────────────────────────────────────────────────────────────
  if (room.status === "FINISHED") {
    const iWon = (isHost && room.winner === "host") || (isGuest && room.winner === "guest");
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <Link href="/games/billiards/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm mb-6 block">← Back</Link>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">{iWon ? "🏆" : room.myRole === "spectator" ? "🎱" : "😔"}</div>
          <h1 className={["text-2xl font-display font-extrabold mb-1", iWon ? "text-yellow-400" : "text-[var(--text-primary)]"].join(" ")}>
            {room.myRole === "spectator"
              ? `${room.winner === "host" ? room.hostName : room.guestName} wins!`
              : iWon ? "You Win!" : "Defeat"}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-4 capitalize">{room.winReason?.replace(/_/g, " ")}</p>
          {isPlayer && myEloDelta !== null && (
            <div className={["inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold mb-4",
              myEloDelta >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"].join(" ")}>
              <Trophy size={14} />
              {myEloDelta >= 0 ? "+" : ""}{myEloDelta} ELO
            </div>
          )}
          <div className="flex gap-3 justify-center mt-2">
            <Link href="/games/billiards/online"
              className="px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 no-underline">
              Back to Lobby
            </Link>
            <button onClick={() => setReplayIdx(0)}
              className="px-5 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-semibold text-sm hover:text-[var(--text-primary)] transition-colors">
              Replay
            </button>
          </div>
        </div>

        {/* Replay view */}
        {replayIdx !== null && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <canvas ref={canvasRef} style={{ width: TABLE_W * scale, height: TABLE_H * scale }} />
            <ReplayShotPanel shots={shots} replayIdx={replayIdx} onReplay={setReplayIdx} />
          </div>
        )}
      </main>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  return (
    <main className="overflow-y-auto xl:overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-col xl:flex-row gap-3 p-3 xl:h-full items-center justify-center">

        {/* Table column */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {/* Opponent row */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              {(isHost ? room.guestImage : room.hostImage)
                ? <Image src={(isHost ? room.guestImage : room.hostImage)!} alt="" width={28} height={28} className="rounded-full" />
                : <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">{oppName?.[0] ?? "?"}</div>
              }
              <span className="text-sm font-display font-semibold text-[var(--text-secondary)]">{oppName ?? "Opponent"}</span>
              {oppRank && <span className="text-[0.6rem] font-bold px-1 rounded-full" style={{ background: `${oppRank.color}22`, color: oppRank.color }}>{oppRank.label}</span>}
              {oppGroup && <span className="text-xs text-[var(--text-muted)]">{oppGroup} ({oppRemaining.length})</span>}
            </div>
            <div className="flex items-center gap-2">
              {room.timeControl !== "none" && (
                <span className={["font-mono text-sm font-bold", room.currentTurn !== room.myRole ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"].join(" ")}>
                  {fmtMs(oppTimeMs)}
                </span>
              )}
              {room.currentTurn !== room.myRole && <span className="text-xs text-[var(--accent-orange)] font-bold animate-pulse">●</span>}
            </div>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            style={{ width: TABLE_W * scale, height: TABLE_H * scale, cursor: isMyTurn ? "crosshair" : "default" }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
          />

          {/* My row */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-display font-semibold text-[var(--text-primary)]">{myName ?? "You"}</span>
              {myRank && <span className="text-[0.6rem] font-bold px-1 rounded-full" style={{ background: `${myRank.color}22`, color: myRank.color }}>{myRank.label}</span>}
              {myGroup && <span className="text-xs text-[var(--text-muted)]">{myGroup} ({myRemaining.length})</span>}
              {isMyTurn && displayState.phase === "cue_in_hand" && (
                <span className="text-xs text-yellow-400 font-bold">Click to place cue ball</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {room.timeControl !== "none" && (
                <span className={["font-mono text-sm font-bold", isMyTurn ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"].join(" ")}>
                  {fmtMs(myTimeMs)}
                </span>
              )}
              {isMyTurn && <span className="text-xs text-green-400 font-bold">● Your turn</span>}
            </div>
          </div>

          {/* Shoot controls */}
          {isMyTurn && replayIdx === null && (
            <div className="flex items-center gap-3 w-full mt-1">
              <span className="text-xs text-[var(--text-muted)] shrink-0">Power</span>
              <input type="range" min={0.05} max={1} step={0.01} value={power}
                onChange={e => setPower(parseFloat(e.target.value))}
                className="flex-1 accent-orange-500" />
              <button onClick={handleShoot} disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : "Shoot"}
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full max-w-xs xl:w-64 xl:self-stretch py-1">
          <div className="flex items-center gap-2">
            <ConnectionBadge status={connStatus} />
            {room.spectatorCount > 0 && <SpectatorBadge count={room.spectatorCount} />}
            <Link href="/games/billiards/online" className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xs">← Lobby</Link>
          </div>

          {/* Resign */}
          {isPlayer && (
            <button onClick={handleResign}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
              <Flag size={12} /> Resign
            </button>
          )}

          {/* Shot history + replay */}
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Shot History</span>
              {replayIdx !== null && (
                <button onClick={() => setReplayIdx(null)}
                  className="text-[0.65rem] text-[var(--accent-orange)] font-display font-semibold hover:opacity-70">
                  Live »
                </button>
              )}
            </div>
            <ReplayShotPanel shots={shots} replayIdx={replayIdx} onReplay={setReplayIdx} />
          </div>

          {/* Chat */}
          {isPlayer && (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl overflow-hidden" style={{ maxHeight: 180 }}>
              <GameChat msgs={room.chat} myUserId={isHost ? room.hostId : room.guestId ?? ""} roomId={roomId} apiBase="/api/billiards-rooms" />
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
