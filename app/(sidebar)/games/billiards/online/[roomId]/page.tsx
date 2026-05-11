"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Flag, CheckCircle2, ChevronLeft, ChevronRight, Trophy, Check, Copy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRank } from "@/lib/elo";
import GameChat, { type ChatMsg } from "@/components/GameChat";
import SpectatorBadge from "@/components/SpectatorBadge";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import { preloadSounds, playSound, type SoundKey } from "@/lib/gameSounds";
import {
  initialState, simulateShot, animateShot, deserializeState,
  BilliardsState, BilliardsShot, ShotRecord, Ball, decodeShots,
  TABLE_W, TABLE_H, BALL_R, POCKETS, POCKET_R,
  PF_LEFT, PF_RIGHT, PF_TOP, PF_BOTTOM,
  remainingBalls,
} from "@/lib/billiards";

type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";
type RoomData = {
  id: string; status: RoomStatus; timeControl: string;
  myRole: "host" | "guest" | "spectator";
  hostId: string; hostName: string | null; hostImage: string | null;
  guestId: string | null; guestName: string | null; guestImage: string | null;
  hostReady: boolean; guestReady: boolean;
  currentTurn: "host" | "guest";
  hostGroup: "solids" | "stripes" | null; guestGroup: "solids" | "stripes" | null;
  phase: "playing" | "cue_in_hand";
  ballsJson: string | null; shotsJson: string | null;
  hostTimeMs: number | null; guestTimeMs: number | null;
  hostDraftPower: number | null; guestDraftPower: number | null;
  winner: string | null; winReason: string | null;
  startedAt: string | null; endedAt: string | null;
  rated: boolean; hostElo: number | null; guestElo: number | null;
  hostEloDelta: number | null; guestEloDelta: number | null;
  chat: ChatMsg[]; spectatorCount: number;
};

const BALL_COLORS: Record<number, string> = {
  1: "#f7d000", 2: "#1a5cdb", 3: "#e03030", 4: "#6a1a8a", 5: "#e07020",
  6: "#157a3a", 7: "#8b1a1a", 8: "#222222",
  9: "#f7d000", 10: "#1a5cdb", 11: "#e03030", 12: "#6a1a8a", 13: "#e07020",
  14: "#157a3a", 15: "#8b1a1a",
};

const TC_LABELS: Record<string, string> = {
  none: "∞", pm30: "30s/move", pm60: "1min/move", pm180: "3min/move", pm300: "5min/move",
  "60": "1 min", "300": "5 min", "600": "10 min", "1500": "25 min", "3600": "1hr",
};

// Increased for smoother/slower pullback feel
const MAX_DRAG_PX = 160;
const CANVAS_PAD  = 80;
const OVER        = 220;

function drawTable(ctx: CanvasRenderingContext2D, scale: number) {
  const W = TABLE_W * scale, H = TABLE_H * scale;
  ctx.fillStyle = "#1a7a3c"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0f5628";
  ctx.fillRect(0, 0, W, PF_TOP * scale); ctx.fillRect(0, (TABLE_H - PF_TOP) * scale, W, PF_TOP * scale);
  ctx.fillRect(0, 0, PF_LEFT * scale, H); ctx.fillRect((TABLE_W - PF_LEFT) * scale, 0, PF_LEFT * scale, H);
  ctx.setLineDash([3 * scale, 5 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 0.7 * scale;
  ctx.beginPath(); ctx.moveTo(TABLE_W * 0.25 * scale, PF_TOP * scale); ctx.lineTo(TABLE_W * 0.25 * scale, PF_BOTTOM * scale); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#f97316"; ctx.lineWidth = 2.5 * scale;
  ctx.strokeRect(PF_LEFT * scale, PF_TOP * scale, (PF_RIGHT - PF_LEFT) * scale, (PF_BOTTOM - PF_TOP) * scale);
}
function drawPockets(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.fillStyle = "#0a0a0a";
  for (const [px, py] of POCKETS) { ctx.beginPath(); ctx.arc(px * scale, py * scale, POCKET_R * scale, 0, Math.PI * 2); ctx.fill(); }
}
function drawBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, scale: number) {
  const r = BALL_R * scale, cx = x * scale, cy = y * scale;
  const isStripe = id >= 9 && id <= 15;
  const color = id === 0 ? "#f0f0f0" : BALL_COLORS[id] ?? "#888";
  if (isStripe) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = "#f0f0f0"; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = color; ctx.fillRect(cx - r, cy - r * 0.45, r * 2, r * 0.9); ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  if (id !== 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.fillStyle = "#111"; ctx.font = `bold ${Math.round(r * 0.6)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 1.5;
    ctx.fillText(String(id), cx, cy + 0.5); ctx.shadowBlur = 0;
  }
  const grad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.3, r * 0.04, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.38)"); grad.addColorStop(0.45, "rgba(255,255,255,0)"); grad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8 * scale; ctx.stroke();
}

// Aim line — thicker on small screens for visibility
function drawAimLine(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number) {
  const lw = Math.max(2, 1.4 * scale);
  const dash = Math.max(6, 4 * scale);
  ctx.save(); ctx.setLineDash([dash, dash]);
  ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(cx * scale, cy * scale);
  ctx.lineTo(cx * scale + Math.cos(angle) * 200 * scale, cy * scale + Math.sin(angle) * 200 * scale);
  ctx.stroke(); ctx.restore();
}

function drawCueStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number, pullback = 0, power = 0) {
  const r = BALL_R * scale, startDist = r + 8 * scale + pullback, len = 200 * scale;
  const sx = cx * scale - Math.cos(angle) * startDist, sy = cy * scale - Math.sin(angle) * startDist;
  const ex = cx * scale - Math.cos(angle) * (startDist + len), ey = cy * scale - Math.sin(angle) * (startDist + len);
  const grad = ctx.createLinearGradient(sx, sy, ex, ey);
  grad.addColorStop(0, "#c8a96e"); grad.addColorStop(0.2, "#a0784a"); grad.addColorStop(1, "#5c3d20");
  ctx.save(); ctx.lineCap = "round";
  if (power > 0.05) {
    const g = Math.round(180 * (1 - power));
    const glowColor = `rgb(255,${g},0)`;
    ctx.globalAlpha = 0.25 + 0.35 * power;
    ctx.shadowColor = glowColor; ctx.shadowBlur = (28 + 36 * power) * scale;
    ctx.strokeStyle = glowColor; ctx.lineWidth = Math.max(9 * scale, 6);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 0.75 + 0.25 * power;
    ctx.shadowBlur = (6 + 10 * power) * scale; ctx.lineWidth = Math.max(5 * scale, 3);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  ctx.lineWidth = Math.max(5 * scale, 3);
  ctx.strokeStyle = grad; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.restore();
}

function HintBar({ hint }: { hint: string | null }) {
  if (!hint) return <div className="min-h-[1.75rem]" />;
  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] w-full">
      <span className="text-[var(--accent-orange)] text-sm leading-none">💡</span>
      <span className="text-[0.7rem] text-[var(--text-muted)] text-center">{hint}</span>
    </div>
  );
}

function BallTypeIndicator({ myGroup }: { myGroup: "solids" | "stripes" | null }) {
  return (
    <div className="flex gap-2 w-full">
      {(["solids", "stripes"] as const).map(type => {
        const isActive = myGroup === type;
        const isSolid = type === "solids";
        const ballColor = isSolid ? "#e07020" : "#1a5cdb";
        return (
          <div key={type} className={["flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all",
            isActive ? "bg-pink-500/10 border-pink-500/35" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)]",
            myGroup !== null && !isActive ? "opacity-35" : ""
          ].join(" ")}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: isSolid ? ballColor : "#f0f0f0", position: "relative", overflow: "hidden", border: "2px solid rgba(0,0,0,0.25)", boxShadow: isActive ? `0 0 10px ${ballColor}55` : "none" }}>
              {!isSolid && <div style={{ position: "absolute", top: "27%", left: 0, right: 0, height: "46%", background: ballColor }} />}
              <div style={{ position: "absolute", top: "12%", left: "20%", width: "34%", height: "28%", borderRadius: "50%", background: "rgba(255,255,255,0.38)" }} />
            </div>
            <span className={["text-[0.65rem] font-bold uppercase tracking-wide leading-none", isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"].join(" ")}>
              {isSolid ? "Solid" : "Stripe"}
            </span>
            {isActive && <span className="text-[0.6rem] text-[var(--accent-orange)] font-bold leading-none">← Yours</span>}
          </div>
        );
      })}
    </div>
  );
}

function GroupBadge({ group, remainingIds, scale }: { group: "solids" | "stripes"; remainingIds: number[]; scale: number }) {
  const ids = group === "solids" ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
  const sz = Math.max(8, Math.round(11 * scale));
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="flex gap-px">
        {ids.map(id => {
          const color = BALL_COLORS[id] ?? "#888";
          const isStripe = id >= 9;
          const pocketed = !remainingIds.includes(id);
          return (
            <div key={id} style={{ width: sz, height: sz, borderRadius: "50%", background: isStripe ? (pocketed ? "#333" : "#f0f0f0") : (pocketed ? "#333" : color), position: "relative", overflow: "hidden", border: "1px solid rgba(0,0,0,0.4)", flexShrink: 0, opacity: pocketed ? 0.25 : 1, transition: "opacity 0.3s, background 0.3s" }}>
              {isStripe && !pocketed && <div style={{ position: "absolute", top: "27%", left: 0, right: 0, height: "46%", background: color }} />}
            </div>
          );
        })}
      </div>
      <span className="text-[0.6rem] font-bold uppercase tracking-wide leading-none" style={{ color: "rgba(255,255,255,0.75)" }}>
        {group === "solids" ? "Solids" : "Stripes"}
      </span>
      <span className={["text-xs font-bold tabular-nums leading-none", remainingIds.length === 0 ? "text-green-400" : "text-white"].join(" ")}>{remainingIds.length}</span>
    </div>
  );
}

function useScale() {
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    function compute() {
      const padW = TABLE_W + 2 * CANVAS_PAD, padH = TABLE_H + 2 * CANVAS_PAD;
      const maxW = Math.min(window.innerWidth - 32, padW);
      const maxH = Math.min(window.innerHeight - 320, padH);
      setScale(Math.max(0.4, Math.min(maxW / padW, maxH / padH, 1)));
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
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"><ChevronLeft size={14} /></button>
        <span className="flex-1 text-center text-[0.65rem] font-mono text-[var(--text-muted)]">
          {replayIdx !== null ? `${replayIdx + 1}/${shots.length}` : `${shots.length}/${shots.length}`}
        </span>
        <button onClick={() => onReplay(replayIdx !== null ? Math.min(shots.length - 1, replayIdx + 1) : null)}
          disabled={!shots.length || replayIdx === shots.length - 1}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"><ChevronRight size={14} /></button>
        <button onClick={() => onReplay(null)} disabled={replayIdx === null}
          className="px-2 py-0.5 text-base leading-none text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 font-mono">»</button>
      </div>
    </div>
  );
}

export default function BilliardsOnlineRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const scale = useScale();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("ok");
  const [aimAngle, setAimAngle] = useState(Math.PI);
  const [power, setPower] = useState(0);
  const [pullback, setPullback] = useState(0);
  const [cueHandPos, setCueHandPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverCuePos, setHoverCuePos] = useState<{ x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [animBalls, setAnimBalls] = useState<Ball[] | null>(null);
  const [copied, setCopied] = useState(false);
  // Live countdown state — synced from server, ticks between polls
  const [liveHostMs, setLiveHostMs] = useState<number | null>(null);
  const [liveGuestMs, setLiveGuestMs] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cueCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const didPullBackRef = useRef(false);
  const tensionThrottleRef = useRef(0);
  const lastAnimatedCountRef = useRef(0);
  // Prevents replaying existing shots when first joining a room
  const initializedAnimRef = useRef(false);
  const shotQueueRef = useRef<Array<{ frames: Ball[][]; sound: SoundKey; angle: number; power: number }>>([]);
  const animatingRef = useRef(false);
  const animShotRef = useRef<{ angle: number; cx: number; cy: number; power: number } | null>(null);
  const animFrameIdxRef = useRef(0);

  const processQueue = useCallback(() => {
    if (animatingRef.current || shotQueueRef.current.length === 0) return;
    const item = shotQueueRef.current.shift()!;
    animatingRef.current = true;
    playSound(item.sound as SoundKey);
    const cueBallFrame0 = item.frames[0]?.find(b => b.id === 0 && !b.pocketed);
    animShotRef.current = { angle: item.angle, power: item.power, cx: cueBallFrame0?.x ?? TABLE_W * 0.25, cy: cueBallFrame0?.y ?? TABLE_H / 2 };
    animFrameIdxRef.current = 0;
    let i = 0; let skip = false;
    function tick() {
      if (skip) { skip = false; rafRef.current = requestAnimationFrame(tick); return; }
      skip = true;
      animFrameIdxRef.current++;
      if (i >= item.frames.length) {
        setAnimBalls(null); animShotRef.current = null; animatingRef.current = false;
        processQueue(); return;
      }
      setAnimBalls(item.frames[i++]);
      rafRef.current = requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enqueueAnimation = useCallback((frames: Ball[][], sound: SoundKey, angle: number, power: number) => {
    shotQueueRef.current.push({ frames, sound, angle, power });
    processQueue();
  }, [processQueue]);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/billiards-rooms/${roomId}`);
      if (!res.ok) { setConnStatus("lost"); return; }
      const data: RoomData = await res.json();
      setRoom(prev => {
        if (prev && prev.status !== data.status && data.status === "PLAYING") playSound("match_start");
        return data;
      });
      setConnStatus("ok");
    } catch {
      setConnStatus("lost");
    }
  }, [roomId]);

  useEffect(() => { preloadSounds(); fetchRoom(); }, [fetchRoom]);
  useEffect(() => { const t = setInterval(fetchRoom, 400); return () => clearInterval(t); }, [fetchRoom]);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    const t = setInterval(() => {
      fetch(`/api/billiards-rooms/${roomId}/ping`, { method: "POST" }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [roomId]);

  useEffect(() => {
    if (room?.myRole !== "spectator") return;
    fetch(`/api/billiards-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    const t = setInterval(() => {
      fetch(`/api/billiards-rooms/${roomId}/spectate`, { method: "POST" }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [roomId, room?.myRole]);

  // Sync countdown from server
  useEffect(() => {
    if (!room) return;
    setLiveHostMs(room.hostTimeMs);
    setLiveGuestMs(room.guestTimeMs);
  }, [room?.hostTimeMs, room?.guestTimeMs]);

  // Tick the active player's clock at 100ms between server polls
  useEffect(() => {
    if (!room || room.status !== "PLAYING" || room.timeControl === "none") return;
    const t = setInterval(() => {
      if (animatingRef.current) return; // wait for opponent animation to finish
      if (room.currentTurn === "host") setLiveHostMs(p => p !== null ? Math.max(0, p - 100) : null);
      else setLiveGuestMs(p => p !== null ? Math.max(0, p - 100) : null);
    }, 100);
    return () => clearInterval(t);
  }, [room?.status, room?.currentTurn, room?.timeControl]);

  const shots = useMemo<ShotRecord[]>(
    () => (room?.shotsJson ? decodeShots(room.shotsJson) : []),
    [room?.shotsJson],
  );

  // Animate shots that arrived from the server (opponent moves)
  useEffect(() => {
    if (!room || room.status !== "PLAYING" || replayIdx !== null) return;
    // On first load skip existing shots — only animate new ones going forward
    if (!initializedAnimRef.current) {
      initializedAnimRef.current = true;
      lastAnimatedCountRef.current = shots.length;
      return;
    }
    if (shots.length <= lastAnimatedCountRef.current) return;

    let state = initialState();
    for (let i = 0; i < lastAnimatedCountRef.current; i++) state = simulateShot(state, shots[i].shot).newState;
    for (let idx = lastAnimatedCountRef.current; idx < shots.length; idx++) {
      const rec = shots[idx];
      const frames = animateShot(state, rec.shot, 3);
      const sound: SoundKey = rec.pocketed.filter(id => id !== 0).length > 0 ? "bl_pocket"
        : rec.foul ? "bl_scratch" : "bl_ball_hit";
      enqueueAnimation(frames, sound, rec.shot.angle, rec.shot.power);
      state = simulateShot(state, rec.shot).newState;
    }
    lastAnimatedCountRef.current = shots.length;
  }, [room?.shotsJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a ref to shots so replay effect always sees the latest value without re-running
  const shotsRef = useRef(shots);
  useEffect(() => { shotsRef.current = shots; }, [shots]);

  // Replay animation
  useEffect(() => {
    if (replayIdx === null) return;
    const currentShots = shotsRef.current;
    const rec = currentShots[replayIdx];
    if (!rec) return;
    let stateBeforeShot = initialState();
    for (let i = 0; i < replayIdx; i++) stateBeforeShot = simulateShot(stateBeforeShot, currentShots[i].shot).newState;
    const frames = animateShot(stateBeforeShot, rec.shot, 3);
    const cueBallPos = rec.shot.cueX !== undefined
      ? { x: rec.shot.cueX, y: rec.shot.cueY ?? TABLE_H / 2 }
      : stateBeforeShot.balls.find(b => b.id === 0 && !b.pocketed);
    animShotRef.current = { angle: rec.shot.angle, power: rec.shot.power, cx: cueBallPos?.x ?? TABLE_W * 0.25, cy: cueBallPos?.y ?? TABLE_H / 2 };
    animFrameIdxRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    animatingRef.current = true;
    let i = 0; let skip = false;
    function tick() {
      if (skip) { skip = false; rafRef.current = requestAnimationFrame(tick); return; }
      skip = true;
      animFrameIdxRef.current++;
      if (i >= frames.length) { setAnimBalls(null); animShotRef.current = null; animatingRef.current = false; return; }
      setAnimBalls(frames[i++]);
      rafRef.current = requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [replayIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayState = useMemo<BilliardsState>(() => {
    if (replayIdx !== null && shots.length > 0) {
      let s = initialState();
      for (let i = 0; i <= replayIdx && i < shots.length; i++) s = simulateShot(s, shots[i].shot).newState;
      return s;
    }
    if (room?.ballsJson) return deserializeState(room.ballsJson);
    return initialState();
  }, [replayIdx, room?.ballsJson, shots]);
  const ballsToDraw = animBalls ?? displayState.balls;

  // Main table canvas — DPR-scaled for sharp rendering
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const CW = (TABLE_W + 2 * CANVAS_PAD) * scale, CH = (TABLE_H + 2 * CANVAS_PAD) * scale;
    canvas.width = CW * dpr; canvas.height = CH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CW, CH);
    ctx.save();
    ctx.translate(CANVAS_PAD * scale, CANVAS_PAD * scale);
    drawTable(ctx, scale); drawPockets(ctx, scale);

    const isMyTurn = room?.myRole !== "spectator" && room?.currentTurn === room?.myRole
      && room?.status === "PLAYING" && replayIdx === null && !animBalls;
    const cueBall = ballsToDraw.find((b: Ball) => b.id === 0 && !b.pocketed);

    if (isMyTurn && displayState.phase === "cue_in_hand") {
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,0,0.3)"; ctx.setLineDash([5 * scale, 4 * scale]);
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(PF_LEFT * scale, PF_TOP * scale, (PF_RIGHT - PF_LEFT) * scale, (PF_BOTTOM - PF_TOP) * scale);
      ctx.setLineDash([]); ctx.restore();
      if (!cueHandPos && hoverCuePos) { ctx.globalAlpha = 0.45; drawBall(ctx, 0, hoverCuePos.x, hoverCuePos.y, scale); ctx.globalAlpha = 1; }
    }
    if (isMyTurn && cueBall && displayState.phase !== "cue_in_hand") drawAimLine(ctx, cueBall.x, cueBall.y, aimAngle, scale);
    if (isMyTurn && displayState.phase === "cue_in_hand" && cueHandPos) drawAimLine(ctx, cueHandPos.x, cueHandPos.y, aimAngle, scale);

    for (const b of ballsToDraw) { if (!b.pocketed) drawBall(ctx, b.id, b.x, b.y, scale); }

    if (isMyTurn && displayState.phase === "cue_in_hand" && cueHandPos && !ballsToDraw.find((b: Ball) => b.id === 0 && !b.pocketed)) {
      drawBall(ctx, 0, cueHandPos.x, cueHandPos.y, scale);
      ctx.save();
      ctx.beginPath(); ctx.arc(cueHandPos.x * scale, cueHandPos.y * scale, (BALL_R + 5) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,220,0,0.7)"; ctx.lineWidth = 1.5 * scale; ctx.setLineDash([3 * scale, 3 * scale]);
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    ctx.restore();
  }, [ballsToDraw, scale, aimAngle, pullback, room, replayIdx, cueHandPos, hoverCuePos, animBalls, displayState.phase]);

  // Cue stick overlay canvas — DPR-scaled
  useEffect(() => {
    const canvas = cueCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const OW = (TABLE_W + 2 * (CANVAS_PAD + OVER)) * scale;
    const OH = (TABLE_H + 2 * (CANVAS_PAD + OVER)) * scale;
    canvas.width = OW * dpr; canvas.height = OH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, OW, OH);
    ctx.save();
    ctx.translate((CANVAS_PAD + OVER) * scale, (CANVAS_PAD + OVER) * scale);
    const isMyTurn = room?.myRole !== "spectator" && room?.currentTurn === room?.myRole
      && room?.status === "PLAYING" && replayIdx === null && !animBalls;
    if (isMyTurn) {
      const cueBall = displayState.balls.find((b: Ball) => b.id === 0 && !b.pocketed);
      if (cueBall && displayState.phase !== "cue_in_hand") drawCueStick(ctx, cueBall.x, cueBall.y, aimAngle, scale, pullback * scale, power);
      if (displayState.phase === "cue_in_hand" && cueHandPos) drawCueStick(ctx, cueHandPos.x, cueHandPos.y, aimAngle, scale, pullback * scale, power);
    }
    if (animBalls !== null && animShotRef.current && animFrameIdxRef.current < 30) {
      const stick = animShotRef.current;
      const progress = animFrameIdxRef.current / 30;
      const pb = Math.max(0, (1 - progress * 2.5)) * 20 * scale;
      ctx.globalAlpha = Math.max(0, 1 - progress * 1.5);
      drawCueStick(ctx, stick.cx, stick.cy, stick.angle, scale, pb, Math.min(1, stick.power * 1.5));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }, [scale, aimAngle, pullback, power, room, replayIdx, cueHandPos, animBalls, displayState.phase, displayState.balls]);

  function getCanvasXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { mx: (e.clientX - rect.left) / scale - CANVAS_PAD, my: (e.clientY - rect.top) / scale - CANVAS_PAD };
  }

  const isMyTurnNow = room?.myRole !== "spectator" && room?.currentTurn === room?.myRole
    && room?.status === "PLAYING" && replayIdx === null && !animBalls && !submitting;

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isMyTurnNow) return;
    const { mx, my } = getCanvasXY(e);
    if (displayState.phase === "cue_in_hand") {
      const cx = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, mx));
      const cy = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, my));
      setCueHandPos({ x: cx, y: cy }); setHoverCuePos(null);
      canvasRef.current?.setPointerCapture(e.pointerId);
      didPullBackRef.current = false;
      dragOriginRef.current = { x: mx, y: my }; setAimAngle(Math.PI); return;
    }
    const cue = displayState.balls.find((b: Ball) => b.id === 0 && !b.pocketed);
    if (!cue) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    didPullBackRef.current = false;
    dragOriginRef.current = { x: mx, y: my };
    setAimAngle(Math.atan2(my - cue.y, mx - cue.x) + Math.PI);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isMyTurnNow) return;
    const { mx, my } = getCanvasXY(e);
    if (!dragOriginRef.current) {
      if (displayState.phase === "cue_in_hand") {
        if (!cueHandPos) {
          const cx = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, mx));
          const cy = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, my));
          setHoverCuePos({ x: cx, y: cy });
        }
        return;
      }
      const cue = displayState.balls.find((b: Ball) => b.id === 0 && !b.pocketed);
      if (!cue) return;
      setAimAngle(Math.atan2(my - cue.y, mx - cue.x) + Math.PI);
      return;
    }
    const dx = mx - dragOriginRef.current.x, dy = my - dragOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= 20) didPullBackRef.current = true;
    if (dist < 5 && didPullBackRef.current) {
      dragOriginRef.current = null;
      didPullBackRef.current = false;
      canvasRef.current?.releasePointerCapture(e.pointerId);
      setPullback(0); setPower(0); return;
    }
    if (dist > 1) {
      setAimAngle(Math.atan2(-dy, -dx));
      const clamped = Math.min(dist, MAX_DRAG_PX);
      const p = clamped / MAX_DRAG_PX;
      setPullback(clamped * scale); setPower(p);
      const now = Date.now();
      if (now - tensionThrottleRef.current > 150) {
        tensionThrottleRef.current = now;
        fetch(`/api/billiards-rooms/${roomId}/tension`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ power: p }),
        }).catch(() => {});
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragOriginRef.current) return;
    const { mx, my } = getCanvasXY(e);
    const dx = mx - dragOriginRef.current.x, dy = my - dragOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    dragOriginRef.current = null; setPullback(0);
    if (dist >= 5 && power >= 0.04) handleShoot();
    else setPower(0);
  }

  async function handleShoot() {
    if (!room || submitting || !isMyTurnNow) return;
    const shotPower = Math.max(0.05, power);
    const shot: BilliardsShot = {
      angle: aimAngle, power: shotPower,
      ...(displayState.phase === "cue_in_hand" ? { cueX: cueHandPos?.x ?? TABLE_W * 0.25, cueY: cueHandPos?.y ?? TABLE_H / 2 } : {}),
    };
    setPower(0); setPullback(0); setCueHandPos(null);
    const frames = animateShot(displayState, shot, 3);
    lastAnimatedCountRef.current++;
    enqueueAnimation(frames, "bl_cue_strike", shot.angle, shot.power);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/billiards-rooms/${roomId}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(shot),
      });
      if (res.ok) await fetchRoom();
    } finally { setSubmitting(false); }
  }

  async function handleReady() { await fetch(`/api/billiards-rooms/${roomId}/ready`, { method: "POST" }); fetchRoom(); }
  async function handleStart() { await fetch(`/api/billiards-rooms/${roomId}/start`, { method: "POST" }); fetchRoom(); }
  async function handleResign() {
    if (!confirm("Resign this game?")) return;
    await fetch(`/api/billiards-rooms/${roomId}/resign`, { method: "POST" }); fetchRoom();
  }

  if (!room) {
    return (
      <main className="flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
        <Loader2 size={32} className="animate-spin text-[var(--text-muted)]" />
      </main>
    );
  }

  const isHost = room.myRole === "host", isGuest = room.myRole === "guest";
  const isPlayer = isHost || isGuest;
  const isMyTurn = isPlayer && room.currentTurn === room.myRole && room.status === "PLAYING" && replayIdx === null;
  const myName  = isHost ? room.hostName  : isGuest ? room.guestName  : null;
  const oppName = isHost ? room.guestName : isGuest ? room.hostName   : null;
  const myElo   = isHost ? room.hostElo   : room.guestElo;
  const oppElo  = isHost ? room.guestElo  : room.hostElo;
  const myEloDelta = isHost ? room.hostEloDelta : room.guestEloDelta;
  const myGroup    = isHost ? room.hostGroup    : room.guestGroup;
  const oppGroup   = isHost ? room.guestGroup   : room.hostGroup;
  const myTimeMs      = isHost ? liveHostMs  : liveGuestMs;
  const oppTimeMs     = isHost ? liveGuestMs : liveHostMs;
  const oppDraftPower = isHost ? room.guestDraftPower : room.hostDraftPower;
  const myRank  = myElo  ? getRank(myElo)  : null;
  const oppRank = oppElo ? getRank(oppElo) : null;
  const myRemaining  = myGroup  ? remainingBalls(displayState, myGroup)  : [];
  const oppRemaining = oppGroup ? remainingBalls(displayState, oppGroup) : [];
  const isPerMove = room.timeControl.startsWith("pm");

  const roomUrl = typeof window !== "undefined" ? window.location.href : "";
  async function handleCopy() {
    try { await navigator.clipboard.writeText(roomUrl); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  async function handleCancelRoom() {
    await fetch(`/api/billiards-rooms/${roomId}`, { method: "DELETE" }).catch(() => {});
    router.push("/games/billiards/online");
  }

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (room.status === "WAITING") {
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          {room.myRole === "host"
            ? <button onClick={handleCancelRoom} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← Leave</button>
            : <button onClick={() => router.push("/games/billiards/online")} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← Leave Room</button>}
        </div>
        <div className="bg-[var(--bg-elevated)] border mb-6 border-[var(--border-subtle)] rounded-2xl p-6">
          <h1 className="text-xl font-display font-extrabold text-[var(--text-primary)] mb-1">🎱 Billiards Room</h1>
          {room.timeControl !== "none" && (
            <p className="text-xs text-[var(--text-muted)] mb-4">{TC_LABELS[room.timeControl] ?? room.timeControl}</p>
          )}
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
              {room.hostImage ? <Image src={room.hostImage} alt="" width={36} height={36} className="rounded-full" />
                : <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold">{room.hostName?.[0] ?? "?"}</div>}
              <div className="flex-1">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.hostName ?? "Host"}</p>
                <p className="text-xs text-[var(--text-muted)]">Host {room.hostElo ? `· ELO ${room.hostElo}` : ""}</p>
              </div>
              <CheckCircle2 size={18} className="text-green-400" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
              {room.guestId ? (<>
                {room.guestImage ? <Image src={room.guestImage} alt="" width={36} height={36} className="rounded-full" />
                  : <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">{room.guestName?.[0] ?? "?"}</div>}
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.guestName ?? "Guest"}</p>
                  <p className="text-xs text-[var(--text-muted)]">Guest {room.guestElo ? `· ELO ${room.guestElo}` : ""}</p>
                </div>
                {room.guestReady ? <CheckCircle2 size={18} className="text-green-400" /> : <span className="text-xs text-[var(--text-muted)]">Not ready</span>}
              </>) : (<>
                <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center">
                  <span className="text-[var(--text-muted)] text-lg">?</span>
                </div>
                <p className="text-[var(--text-muted)] text-sm">Waiting for opponent…</p>
                <Loader2 size={16} className="animate-spin text-[var(--text-muted)] ml-auto" />
              </>)}
            </div>
          </div>
          {isGuest && (
            <button onClick={handleReady}
              className={["flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all",
                room.guestReady ? "bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/10"
                  : "bg-[var(--accent-orange)] text-white hover:opacity-90"].join(" ")}>
              <CheckCircle2 size={15} />{room.guestReady ? "Cancel Ready" : "Ready!"}
            </button>
          )}
          {isHost && (
            <button onClick={handleStart} disabled={!room.guestId || !room.guestReady}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40">
              Start Game
            </button>
          )}
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 mb-6">
          <p className="text-[0.7rem] text-[var(--text-muted)] font-display font-semibold uppercase tracking-wider mb-2">Invite link</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs font-mono text-[var(--text-secondary)] truncate">{roomUrl}</p>
            <button onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[0.7rem] font-display font-semibold transition-colors hover:text-[var(--text-primary)] shrink-0">
              {copied ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── FINISHED ────────────────────────────────────────────────────────────────
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
              <Trophy size={14} />{myEloDelta >= 0 ? "+" : ""}{myEloDelta} ELO
            </div>
          )}
          <div className="flex gap-3 justify-center mt-2">
            <Link href="/games/billiards/online"
              className="px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 no-underline">
              Back to Lobby
            </Link>
            <button onClick={() => { setAnimBalls(null); cancelAnimationFrame(rafRef.current); setReplayIdx(0); }}
              className="px-5 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-semibold text-sm hover:text-[var(--text-primary)]">
              Replay
            </button>
          </div>
        </div>
        {replayIdx !== null && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <canvas ref={canvasRef} style={{ width: (TABLE_W + 2 * CANVAS_PAD) * scale, height: (TABLE_H + 2 * CANVAS_PAD) * scale }} />
            <ReplayShotPanel shots={shots} replayIdx={replayIdx} onReplay={(i) => {
              cancelAnimationFrame(rafRef.current); setAnimBalls(null); setReplayIdx(i);
            }} />
          </div>
        )}
      </main>
    );
  }

  // ── PLAYING ──────────────────────────────────────────────────────────────────
  const opponentAnimating = animBalls !== null && !isMyTurn;
  return (
    <main className="overflow-y-auto xl:overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-col xl:flex-row gap-3 p-3 xl:h-full items-center justify-center">

        {/* Table column */}
        <div className="flex flex-col items-center gap-2 shrink-0 w-full xl:w-auto">
          {/* Opponent row */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2 min-w-0">
              {(isHost ? room.guestImage : room.hostImage)
                ? <Image src={(isHost ? room.guestImage : room.hostImage)!} alt="" width={28} height={28} className="rounded-full shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs shrink-0">{oppName?.[0] ?? "?"}</div>}
              <span className="text-sm font-display font-semibold text-[var(--text-secondary)] truncate">{oppName ?? "Opponent"}</span>
              {oppRank && <span className="text-[0.6rem] font-bold px-1 rounded-full shrink-0" style={{ background: `${oppRank.color}22`, color: oppRank.color }}>{oppRank.label}</span>}
              {oppGroup && <span className="text-xs text-[var(--text-muted)] shrink-0">{oppGroup} ({oppRemaining.length})</span>}
              {opponentAnimating && <span className="text-xs text-blue-400 animate-pulse font-bold shrink-0">● shooting…</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {room.timeControl !== "none" && (
                <span className={["font-mono text-sm font-bold tabular-nums",
                  room.currentTurn !== room.myRole ? (isPerMove && (oppTimeMs ?? 99999) < 10000 ? "text-red-400" : "text-[var(--accent-orange)]") : "text-[var(--text-muted)]"
                ].join(" ")}>{fmtMs(oppTimeMs)}</span>
              )}
              {room.currentTurn !== room.myRole && !opponentAnimating && <span className="text-xs text-[var(--accent-orange)] font-bold animate-pulse">●</span>}
            </div>
          </div>
          {/* Opponent tension bar */}
          {oppDraftPower !== null && oppDraftPower > 0 && room.currentTurn !== room.myRole && !opponentAnimating && (
            <div className="flex items-center gap-2 w-full px-1">
              <span className="text-[0.65rem] text-[var(--text-muted)] shrink-0">tension</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-100"
                  style={{ width: `${oppDraftPower * 100}%`, background: oppDraftPower >= 0.85 ? "#f87171" : oppDraftPower >= 0.6 ? "#fb923c" : oppDraftPower >= 0.3 ? "#facc15" : "#4ade80" }} />
              </div>
              <span className="text-[0.65rem] font-mono font-bold w-7 text-right shrink-0"
                style={{ color: oppDraftPower >= 0.85 ? "#f87171" : oppDraftPower >= 0.6 ? "#fb923c" : oppDraftPower >= 0.3 ? "#facc15" : "#4ade80" }}>
                {Math.round(oppDraftPower * 100)}%
              </span>
            </div>
          )}

          {/* Canvas */}
          <div style={{ position: "relative", width: (TABLE_W + 2 * CANVAS_PAD) * scale, height: (TABLE_H + 2 * CANVAS_PAD) * scale, maxWidth: "100%" }}>
            <canvas
              ref={canvasRef}
              style={{ width: (TABLE_W + 2 * CANVAS_PAD) * scale, height: (TABLE_H + 2 * CANVAS_PAD) * scale, cursor: isMyTurnNow ? "crosshair" : "default", touchAction: "none", display: "block" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { dragOriginRef.current = null; setPullback(0); setPower(0); setHoverCuePos(null); }}
              onPointerLeave={() => setHoverCuePos(null)}
            />
            <canvas
              ref={cueCanvasRef}
              style={{ position: "absolute", left: -OVER * scale, top: -OVER * scale, width: (TABLE_W + 2 * (CANVAS_PAD + OVER)) * scale, height: (TABLE_H + 2 * (CANVAS_PAD + OVER)) * scale, pointerEvents: "none", zIndex: 50 }}
            />
            {myGroup && (
              <div style={{ position: "absolute", top: 6, right: 6, zIndex: 45, pointerEvents: "none" }}>
                <GroupBadge group={myGroup} remainingIds={myRemaining} scale={scale} />
              </div>
            )}
          </div>

          {/* My row */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{myName ?? "You"}</span>
              {myRank && <span className="text-[0.6rem] font-bold px-1 rounded-full shrink-0" style={{ background: `${myRank.color}22`, color: myRank.color }}>{myRank.label}</span>}
              {myGroup && <span className="text-xs text-[var(--text-muted)] shrink-0">{myGroup} ({myRemaining.length})</span>}
              {isMyTurnNow && displayState.phase === "cue_in_hand" && !cueHandPos && (
                <span className="text-xs text-yellow-400 font-bold shrink-0">Place cue ball</span>
              )}
              {isMyTurnNow && displayState.phase !== "cue_in_hand" && power > 0 && (
                <span className={["text-xs font-bold shrink-0", power >= 0.85 ? "text-red-400" : power >= 0.6 ? "text-orange-400" : power >= 0.3 ? "text-yellow-400" : "text-green-400"].join(" ")}>
                  {Math.round(power * 100)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {room.timeControl !== "none" && (
                <span className={["font-mono text-sm font-bold tabular-nums",
                  isMyTurn ? (isPerMove && (myTimeMs ?? 99999) < 10000 ? "text-red-400" : "text-[var(--accent-orange)]") : "text-[var(--text-muted)]"
                ].join(" ")}>{fmtMs(myTimeMs)}</span>
              )}
              {isMyTurnNow && power === 0 && <span className="text-xs text-green-400 font-bold">● Your turn</span>}
              {submitting && <Loader2 size={12} className="animate-spin text-[var(--text-muted)]" />}
            </div>
          </div>

          {(() => {
            let hint: string | null = null;
            if (room.status === "PLAYING") {
              if (replayIdx !== null) hint = "Watching replay — use arrows to step through shots";
              else if (isMyTurnNow && displayState.phase === "cue_in_hand" && !cueHandPos) hint = "Click anywhere on the table to place the cue ball";
              else if (isMyTurnNow && displayState.phase === "cue_in_hand" && cueHandPos) hint = "Drag the cue back to aim and build power — release to shoot";
              else if (isMyTurnNow && !myGroup) hint = "Pocket any ball to claim your group — solids or stripes";
              else if (isMyTurnNow) hint = "Drag the cue back to build power — release to shoot";
            }
            return <HintBar hint={hint} />;
          })()}
          {isMyTurnNow && displayState.phase === "cue_in_hand" && cueHandPos && (
            <div className="flex justify-end w-full -mt-1">
              <button onClick={() => { setCueHandPos(null); setHoverCuePos(null); }} className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs hover:text-red-400">Reset ball</button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full max-w-xs xl:w-64 xl:self-stretch py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ConnectionBadge status={connStatus} />
            {room.spectatorCount > 0 && <SpectatorBadge count={room.spectatorCount} />}
            {room.timeControl !== "none" && (
              <span className="text-[0.65rem] text-[var(--text-muted)] font-mono">{TC_LABELS[room.timeControl] ?? room.timeControl}</span>
            )}
            <Link href="/games/billiards/online" className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xs">← Lobby</Link>
          </div>

          {isPlayer && (
            <button onClick={handleResign}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400">
              <Flag size={12} /> Resign
            </button>
          )}

          {isPlayer && <BallTypeIndicator myGroup={myGroup} />}

          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Shot History</span>
              {replayIdx !== null && (
                <button onClick={() => { cancelAnimationFrame(rafRef.current); setAnimBalls(null); setReplayIdx(null); }}
                  className="text-[0.65rem] text-[var(--accent-orange)] font-display font-semibold hover:opacity-70">Live »</button>
              )}
            </div>
            <ReplayShotPanel shots={shots} replayIdx={replayIdx} onReplay={(i) => {
              cancelAnimationFrame(rafRef.current); setAnimBalls(null); setReplayIdx(i);
            }} />
          </div>

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
