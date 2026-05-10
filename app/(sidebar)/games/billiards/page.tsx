"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { RotateCcw, Flag, ChevronLeft, ChevronRight } from "lucide-react";
import {
  initialState, simulateShot, animateShot, remainingBalls,
  BilliardsState, BilliardsShot, ShotRecord, Ball,
  TABLE_W, TABLE_H, BALL_R, POCKETS, POCKET_R,
  PF_LEFT, PF_RIGHT, PF_TOP, PF_BOTTOM,
  decodeShots, encodeShots,
} from "@/lib/billiards";
import { getBotShot } from "@/lib/billiards-bot";
import { playSound, preloadSounds } from "@/lib/gameSounds";
import { awardGameBadge } from "@/actions/badges";

type Difficulty = "easy" | "medium" | "hard";
type Status = "idle" | "playing" | "over";

const BALL_COLORS: Record<number, string> = {
  1: "#f7d000", 2: "#1a5cdb", 3: "#e03030", 4: "#6a1a8a", 5: "#e07020",
  6: "#157a3a", 7: "#8b1a1a", 8: "#222222",
  9: "#f7d000", 10: "#1a5cdb", 11: "#e03030", 12: "#6a1a8a", 13: "#e07020",
  14: "#157a3a", 15: "#8b1a1a",
};

const MAX_DRAG_PX = 80;
const CANVAS_PAD  = 80;
const OVER        = 220; // overlay extends beyond CANVAS_PAD so the cue stick renders over UI

function drawTable(ctx: CanvasRenderingContext2D, scale: number) {
  const W = TABLE_W * scale, H = TABLE_H * scale;
  ctx.fillStyle = "#1a7a3c"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0f5628";
  ctx.fillRect(0, 0, W, PF_TOP * scale);
  ctx.fillRect(0, (TABLE_H - PF_TOP) * scale, W, PF_TOP * scale);
  ctx.fillRect(0, 0, PF_LEFT * scale, H);
  ctx.fillRect((TABLE_W - PF_LEFT) * scale, 0, PF_LEFT * scale, H);
  ctx.setLineDash([3 * scale, 5 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 0.7 * scale;
  ctx.beginPath(); ctx.moveTo(TABLE_W * 0.25 * scale, PF_TOP * scale);
  ctx.lineTo(TABLE_W * 0.25 * scale, PF_BOTTOM * scale); ctx.stroke();
  ctx.setLineDash([]);
}

function drawPockets(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.fillStyle = "#0a0a0a";
  for (const [px, py] of POCKETS) {
    ctx.beginPath(); ctx.arc(px * scale, py * scale, POCKET_R * scale, 0, Math.PI * 2); ctx.fill();
  }
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
    ctx.fillText(String(id), cx, cy + 0.5);
    ctx.shadowBlur = 0;
  }
  const grad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.3, r * 0.04, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.38)"); grad.addColorStop(0.45, "rgba(255,255,255,0)"); grad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8 * scale; ctx.stroke();
}

function drawCueStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number, pullback = 0, power = 0) {
  const r = BALL_R * scale;
  const startDist = r + 8 * scale + pullback;
  const len = 200 * scale;
  const sx = cx * scale - Math.cos(angle) * startDist;
  const sy = cy * scale - Math.sin(angle) * startDist;
  const ex = cx * scale - Math.cos(angle) * (startDist + len);
  const ey = cy * scale - Math.sin(angle) * (startDist + len);
  const grad = ctx.createLinearGradient(sx, sy, ex, ey);
  grad.addColorStop(0, "#c8a96e"); grad.addColorStop(0.2, "#a0784a"); grad.addColorStop(1, "#5c3d20");
  ctx.save(); ctx.lineCap = "round";
  if (power > 0.05) {
    const g = Math.round(180 * (1 - power));
    const glowColor = `rgb(255,${g},0)`;
    // wide soft outer glow
    ctx.globalAlpha = 0.25 + 0.35 * power;
    ctx.shadowColor = glowColor; ctx.shadowBlur = (28 + 36 * power) * scale;
    ctx.strokeStyle = glowColor; ctx.lineWidth = Math.max(9 * scale, 6);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    // tight bright inner glow
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

function GroupBadge({ group, remaining, scale }: { group: "solids" | "stripes"; remaining: number; scale: number }) {
  const ids = group === "solids" ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
  const sz = Math.max(8, Math.round(11 * scale));
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="flex gap-px">
        {ids.map(id => {
          const color = BALL_COLORS[id] ?? "#888";
          const isStripe = id >= 9;
          return (
            <div key={id} style={{ width: sz, height: sz, borderRadius: "50%", background: isStripe ? "#f0f0f0" : color, position: "relative", overflow: "hidden", border: "1px solid rgba(0,0,0,0.4)", flexShrink: 0 }}>
              {isStripe && <div style={{ position: "absolute", top: "27%", left: 0, right: 0, height: "46%", background: color }} />}
            </div>
          );
        })}
      </div>
      <span className="text-[0.6rem] font-bold uppercase tracking-wide leading-none" style={{ color: "rgba(255,255,255,0.75)" }}>
        {group === "solids" ? "Solids" : "Stripes"}
      </span>
      <span className={["text-xs font-bold tabular-nums leading-none", remaining === 0 ? "text-green-400" : "text-white"].join(" ")}>{remaining}</span>
    </div>
  );
}

function drawAimLine(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number) {
  ctx.save(); ctx.setLineDash([4 * scale, 4 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 0.8 * scale;
  ctx.beginPath(); ctx.moveTo(cx * scale, cy * scale);
  ctx.lineTo(cx * scale + Math.cos(angle) * 200 * scale, cy * scale + Math.sin(angle) * 200 * scale);
  ctx.stroke(); ctx.restore();
}

function useScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function compute() {
      const padW = TABLE_W + 2 * CANVAS_PAD, padH = TABLE_H + 2 * CANVAS_PAD;
      const maxW = Math.min(window.innerWidth - 32, padW);
      const maxH = Math.min(window.innerHeight - 280, padH);
      setScale(Math.max(0.45, Math.min(maxW / padW, maxH / padH, 1)));
    }
    compute(); window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

// ── Replay panel ────────────────────────────────────────────────────────────────
function ReplayShotPanel({ shots, replayIdx, onReplay }: {
  shots: ShotRecord[]; replayIdx: number | null; onReplay: (idx: number | null) => void;
}) {
  const t = useTranslations("billiards");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replayIdx === null && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [shots.length, replayIdx]);
  return (
    <div className="flex flex-col min-h-0 gap-1">
      <div ref={ref} className="overflow-y-auto max-h-36 lg:max-h-48 flex flex-col gap-px">
        {shots.length === 0 && <p className="text-[var(--text-muted)] text-xs italic py-2 px-1">{t("noShots")}</p>}
        {shots.map((s, i) => (
          <button key={i} onClick={() => onReplay(i)}
            className={["flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors",
              replayIdx === i ? "bg-pink-500/20 text-[var(--accent-orange)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            ].join(" ")}>
            <span className="font-mono text-[var(--text-muted)] w-5 shrink-0">{i + 1}.</span>
            <span className="font-semibold">{s.by === "host" ? "You" : "Bot"}</span>
            {s.pocketed.filter(id => id !== 0).length > 0 && <span className="text-[var(--text-muted)]">+{s.pocketed.filter(id => id !== 0).length}</span>}
            {s.foul && <span className="text-red-400 text-[0.65rem]">FOUL</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5 pt-1 border-t border-[var(--border-subtle)]">
        <button onClick={() => onReplay(0)} disabled={shots.length === 0 || replayIdx === 0}
          className="px-2 py-0.5 text-base leading-none text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 font-mono">«</button>
        <button onClick={() => onReplay(replayIdx !== null ? Math.max(0, replayIdx - 1) : shots.length - 1)}
          disabled={shots.length === 0 || replayIdx === 0}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"><ChevronLeft size={14} /></button>
        <span className="flex-1 text-center text-[0.65rem] font-mono text-[var(--text-muted)]">
          {replayIdx !== null ? `${replayIdx + 1}/${shots.length}` : `${shots.length}/${shots.length}`}
        </span>
        <button onClick={() => onReplay(replayIdx !== null ? Math.min(shots.length - 1, replayIdx + 1) : null)}
          disabled={shots.length === 0 || replayIdx === shots.length - 1}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"><ChevronRight size={14} /></button>
        <button onClick={() => onReplay(null)} disabled={replayIdx === null}
          className="px-2 py-0.5 text-base leading-none text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 font-mono"
          title={t("backToLive")}>»</button>
      </div>
    </div>
  );
}

// ── Main game ────────────────────────────────────────────────────────────────────
export default function BilliardsBotPage() {
  const t = useTranslations("billiards");
  const scale = useScale();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [status, setStatus] = useState<Status>("idle");
  const [gameState, setGameState] = useState<BilliardsState>(initialState());
  const [aimAngle, setAimAngle] = useState(Math.PI);
  const [power, setPower] = useState(0);
  const [pullback, setPullback] = useState(0);
  const [shots, setShots] = useState<ShotRecord[]>([]);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [result, setResult] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [cueHandPos, setCueHandPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverCuePos, setHoverCuePos] = useState<{ x: number; y: number } | null>(null);
  const [animBalls, setAnimBalls] = useState<Ball[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cueCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const triggerBotRef = useRef<(state: BilliardsState) => void>(() => {});
  const animShotRef = useRef<{ angle: number; cx: number; cy: number; power: number } | null>(null);
  const animFrameIdxRef = useRef(0);

  useEffect(() => { preloadSounds(); }, []);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  // Compute display state (for replay)
  const replayState: BilliardsState | null = (() => {
    if (replayIdx === null) return null;
    let s = initialState();
    for (let i = 0; i <= replayIdx && i < shots.length; i++) {
      s = simulateShot(s, shots[i].shot).newState;
    }
    return s;
  })();
  const displayState = replayState ?? gameState;
  // Ball positions to render: animBalls during animation, else displayState
  const ballsToDraw = animBalls ?? displayState.balls;

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const CW = (TABLE_W + 2 * CANVAS_PAD) * scale, CH = (TABLE_H + 2 * CANVAS_PAD) * scale;
    canvas.width = CW; canvas.height = CH;
    ctx.clearRect(0, 0, CW, CH);

    // Translate so game coords map to the padded canvas centre
    ctx.save();
    ctx.translate(CANVAS_PAD * scale, CANVAS_PAD * scale);
    drawTable(ctx, scale); drawPockets(ctx, scale);

    const isInteractive = status === "playing" && gameState.turn === "host"
      && !botThinking && replayIdx === null && animBalls === null;
    const cueBall = ballsToDraw.find(b => b.id === 0 && !b.pocketed);

    // Cue-in-hand: placement zone + ghost ball before placement
    if (isInteractive && gameState.phase === "cue_in_hand") {
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,0,0.3)";
      ctx.setLineDash([5 * scale, 4 * scale]);
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(PF_LEFT * scale, PF_TOP * scale, (PF_RIGHT - PF_LEFT) * scale, (PF_BOTTOM - PF_TOP) * scale);
      ctx.setLineDash([]);
      ctx.restore();
      if (!cueHandPos && hoverCuePos) {
        ctx.globalAlpha = 0.45; drawBall(ctx, 0, hoverCuePos.x, hoverCuePos.y, scale); ctx.globalAlpha = 1;
      }
    }

    if (isInteractive && cueBall && gameState.phase !== "cue_in_hand") {
      drawAimLine(ctx, cueBall.x, cueBall.y, aimAngle, scale);
    }
    if (isInteractive && gameState.phase === "cue_in_hand" && cueHandPos) {
      drawAimLine(ctx, cueHandPos.x, cueHandPos.y, aimAngle, scale);
    }

    for (const b of ballsToDraw) {
      if (b.pocketed) continue;
      drawBall(ctx, b.id, b.x, b.y, scale);
    }

    // Placed cue ball + pulsing ring
    if (isInteractive && gameState.phase === "cue_in_hand" && cueHandPos && !ballsToDraw.find(b => b.id === 0 && !b.pocketed)) {
      drawBall(ctx, 0, cueHandPos.x, cueHandPos.y, scale);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cueHandPos.x * scale, cueHandPos.y * scale, (BALL_R + 5) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,220,0,0.7)";
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([3 * scale, 3 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.restore();
  }, [ballsToDraw, scale, aimAngle, pullback, status, botThinking, replayIdx, cueHandPos, hoverCuePos, animBalls, gameState.phase, gameState.turn]);

  // Draw cue stick on overlay canvas so it renders above all HTML elements
  useEffect(() => {
    const canvas = cueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const OW = (TABLE_W + 2 * (CANVAS_PAD + OVER)) * scale;
    const OH = (TABLE_H + 2 * (CANVAS_PAD + OVER)) * scale;
    canvas.width = OW; canvas.height = OH;
    ctx.clearRect(0, 0, OW, OH);
    ctx.save();
    ctx.translate((CANVAS_PAD + OVER) * scale, (CANVAS_PAD + OVER) * scale);
    // Player's own aim stick (idle, not animating)
    const isInteractive = status === "playing" && gameState.turn === "host"
      && !botThinking && replayIdx === null && animBalls === null;
    if (isInteractive) {
      const cueBall = gameState.balls.find(b => b.id === 0 && !b.pocketed);
      if (cueBall && gameState.phase !== "cue_in_hand") {
        drawCueStick(ctx, cueBall.x, cueBall.y, aimAngle, scale, pullback * scale, power);
      }
      if (gameState.phase === "cue_in_hand" && cueHandPos) {
        drawCueStick(ctx, cueHandPos.x, cueHandPos.y, aimAngle, scale, pullback * scale, power);
      }
    }
    // Animated strike stick (player or opponent) — visible for first 30 frames
    if (animBalls !== null && animShotRef.current && animFrameIdxRef.current < 30) {
      const stick = animShotRef.current;
      const progress = animFrameIdxRef.current / 30;
      const pb = Math.max(0, (1 - progress * 2.5)) * 20 * scale;
      ctx.globalAlpha = Math.max(0, 1 - progress * 1.5);
      drawCueStick(ctx, stick.cx, stick.cy, stick.angle, scale, pb, Math.min(1, stick.power * 1.5));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }, [scale, aimAngle, pullback, power, status, botThinking, replayIdx, cueHandPos, animBalls, gameState.phase, gameState.turn, gameState.balls]);

  // Trigger replay animation when replayIdx changes
  useEffect(() => {
    if (replayIdx === null) return;
    const rec = shots[replayIdx];
    if (!rec) return;
    let stateBeforeShot = initialState();
    for (let i = 0; i < replayIdx; i++) stateBeforeShot = simulateShot(stateBeforeShot, shots[i].shot).newState;
    const frames = animateShot(stateBeforeShot, rec.shot);
    const cueBallPos = rec.shot.cueX !== undefined
      ? { x: rec.shot.cueX, y: rec.shot.cueY ?? TABLE_H / 2 }
      : stateBeforeShot.balls.find(b => b.id === 0 && !b.pocketed);
    animShotRef.current = { angle: rec.shot.angle, power: rec.shot.power, cx: cueBallPos?.x ?? TABLE_W * 0.25, cy: cueBallPos?.y ?? TABLE_H / 2 };
    animFrameIdxRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    let i = 0;
    function tick() {
      animFrameIdxRef.current++;
      if (i >= frames.length) { setAnimBalls(null); animShotRef.current = null; return; }
      setAnimBalls(frames[i++]);
      rafRef.current = requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [replayIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    setGameState(initialState()); setShots([]); setReplayIdx(null); setResult("");
    setBotThinking(false); setCueHandPos(null); setHoverCuePos(null); setAimAngle(Math.PI);
    setPower(0); setPullback(0); setAnimBalls(null); setStatus("playing");
    playSound("match_start");
  }

  const applyShot = useCallback((state: BilliardsState, shot: BilliardsShot, by: "host" | "guest") => {
    const res = simulateShot(state, shot);
    const hasFoul = res.events.some(e => e.type === "foul");
    const rec: ShotRecord = {
      by, shot, pocketed: res.pocketed, continuesTurn: res.continuesTurn,
      foul: hasFoul, winner: res.winner ?? undefined,
    };
    setShots(prev => [...prev, rec]);

    const frames = animateShot(state, shot);
    const cueBallPos = shot.cueX !== undefined
      ? { x: shot.cueX, y: shot.cueY ?? TABLE_H / 2 }
      : state.balls.find(b => b.id === 0 && !b.pocketed);
    animShotRef.current = { angle: shot.angle, power: shot.power, cx: cueBallPos?.x ?? TABLE_W * 0.25, cy: cueBallPos?.y ?? TABLE_H / 2 };
    animFrameIdxRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    let i = 0;
    function tick() {
      animFrameIdxRef.current++;
      if (i >= frames.length) {
        setAnimBalls(null);
        animShotRef.current = null;
        setGameState(res.newState);
        if (res.pocketed.filter(id => id !== 0).length > 0) playSound("bl_pocket");
        else if (hasFoul) playSound("bl_scratch");
        else playSound("bl_ball_hit");
        if (res.winner) {
          const playerWon = res.winner === "host";
          setResult(playerWon ? t("win") : t("lose"));
          setStatus("over");
          playSound(playerWon ? "bl_win" : "bl_defeat");
          if (playerWon) awardGameBadge("BILLIARDS_WIN").catch(() => {});
        } else if (res.newState.turn === "guest") {
          setTimeout(() => triggerBotRef.current(res.newState), 300);
        }
        return;
      }
      setAnimBalls(frames[i++]);
      rafRef.current = requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [t]);

  const triggerBot = useCallback((state: BilliardsState) => {
    setBotThinking(true);
    setTimeout(() => {
      setBotThinking(false);
      const shot = getBotShot(state, difficulty);
      applyShot(state, shot, "guest");
    }, 500);
  }, [difficulty, applyShot]);

  useEffect(() => { triggerBotRef.current = triggerBot; }, [triggerBot]);

  function getCanvasXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) / scale - CANVAS_PAD,
      my: (e.clientY - rect.top)  / scale - CANVAS_PAD,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (status !== "playing" || gameState.turn !== "host" || botThinking || replayIdx !== null || animBalls !== null) return;
    const { mx, my } = getCanvasXY(e);

    if (gameState.phase === "cue_in_hand") {
      const cx = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, mx));
      const cy = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, my));
      setCueHandPos({ x: cx, y: cy });
      setHoverCuePos(null);
      // Capture so the player can immediately drag to aim in one gesture
      canvasRef.current?.setPointerCapture(e.pointerId);
      dragOriginRef.current = { x: mx, y: my };
      setAimAngle(Math.PI);
      return;
    }

    const cue = gameState.balls.find(b => b.id === 0 && !b.pocketed);
    if (!cue) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    dragOriginRef.current = { x: mx, y: my };
    setAimAngle(Math.atan2(my - cue.y, mx - cue.x) + Math.PI);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (status !== "playing" || gameState.turn !== "host" || botThinking || replayIdx !== null || animBalls !== null) return;
    const { mx, my } = getCanvasXY(e);

    if (!dragOriginRef.current) {
      if (gameState.phase === "cue_in_hand") {
        if (!cueHandPos) {
          const cx = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, mx));
          const cy = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, my));
          setHoverCuePos({ x: cx, y: cy });
        }
        return;
      }
      const cue = gameState.balls.find(b => b.id === 0 && !b.pocketed);
      if (!cue) return;
      setAimAngle(Math.atan2(my - cue.y, mx - cue.x) + Math.PI);
      return;
    }

    const dx = mx - dragOriginRef.current.x;
    const dy = my - dragOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      // Drag direction = pull cue back → shot direction is opposite
      setAimAngle(Math.atan2(-dy, -dx));
      const clamped = Math.min(dist, MAX_DRAG_PX);
      setPullback(clamped * scale);
      setPower(clamped / MAX_DRAG_PX);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragOriginRef.current) return;
    const { mx, my } = getCanvasXY(e);
    const dx = mx - dragOriginRef.current.x;
    const dy = my - dragOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    dragOriginRef.current = null;
    setPullback(0);

    if (dist < 5 || power < 0.04) return;
    fireShot();
  }

  function fireShot() {
    if (status !== "playing" || gameState.turn !== "host" || botThinking || animBalls !== null) return;
    const shotPower = Math.max(0.05, power);
    const shot: BilliardsShot = {
      angle: aimAngle, power: shotPower,
      ...(gameState.phase === "cue_in_hand" ? {
        cueX: cueHandPos?.x ?? TABLE_W * 0.25,
        cueY: cueHandPos?.y ?? TABLE_H / 2,
      } : {}),
    };
    setPower(0); setPullback(0); setCueHandPos(null);
    applyShot(gameState, shot, "host");
  }

  const isMyTurn = status === "playing" && gameState.turn === "host" && !botThinking && replayIdx === null && animBalls === null;
  const myGroup  = gameState.hostGroup;
  const oppGroup = gameState.guestGroup;
  const remaining    = myGroup  ? remainingBalls(gameState, myGroup)  : [];
  const oppRemaining = oppGroup ? remainingBalls(gameState, oppGroup) : [];

  // ── IDLE ─────────────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <main className="flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex flex-col items-center gap-8 py-16 px-12 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="text-7xl leading-none">🎱</div>
          <div>
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] text-center mb-1">{t("title")}</h1>
            <p className="text-[var(--text-muted)] text-sm text-center">{t("subtitle")}</p>
          </div>
          <div className="flex gap-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={["px-5 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  difficulty === d
                    ? "bg-pink-500/15 border-pink-500/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                ].join(" ")}>
                {d === "easy" ? t("easy") : d === "medium" ? t("medium") : t("hard")}
              </button>
            ))}
          </div>
          <button onClick={startGame}
            className="px-10 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-base hover:opacity-90 transition-opacity">
            {t("start")}
          </button>
        </div>
      </main>
    );
  }

  // ── PLAYING / OVER ────────────────────────────────────────────────────────────
  return (
    <main className="overflow-y-auto lg:overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:h-full items-center justify-center">

        {/* Board column */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="flex items-center justify-between w-full px-1">
            <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← Games</Link>
            <div className="flex gap-3 text-xs font-mono">
              <span className={oppGroup ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}>
                Bot: {oppGroup ? `${oppGroup} (${oppRemaining.length})` : "—"}
              </span>
              <span className={myGroup ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                You: {myGroup ? `${myGroup} (${remaining.length})` : "—"}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="text-xs text-center font-display font-semibold min-h-[1.25rem]">
            {replayIdx !== null ? (
              <span className="text-[var(--accent-orange)]">{t("spectating")} ({replayIdx + 1}/{shots.length})</span>
            ) : animBalls !== null ? (
              <span className="text-blue-400 animate-pulse">
                {botThinking || gameState.turn === "guest" ? t("opponentTurn") : "●"}
              </span>
            ) : botThinking ? (
              <span className="text-[var(--text-muted)] animate-pulse">{t("opponentTurn")}</span>
            ) : isMyTurn ? (
              gameState.phase === "cue_in_hand"
                ? <span className="text-yellow-400">{t("cueBallInHand")}</span>
                : power > 0
                  ? <span className={power >= 0.85 ? "text-red-400" : power >= 0.6 ? "text-orange-400" : power >= 0.3 ? "text-yellow-400" : "text-green-400"}>
                      Power: {Math.round(power * 100)}% — release to shoot
                    </span>
                  : <span className="text-green-400">{t("aimAndShoot")} — drag to pull cue</span>
            ) : null}
          </div>

          <div style={{ position: "relative", width: (TABLE_W + 2 * CANVAS_PAD) * scale, height: (TABLE_H + 2 * CANVAS_PAD) * scale }}>
            <canvas
              ref={canvasRef}
              style={{ width: (TABLE_W + 2 * CANVAS_PAD) * scale, height: (TABLE_H + 2 * CANVAS_PAD) * scale, cursor: isMyTurn ? "crosshair" : "default", touchAction: "none", display: "block" }}
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
                <GroupBadge group={myGroup} remaining={remaining.length} scale={scale} />
              </div>
            )}
          </div>

          {(() => {
            let hint: string | null = null;
            if (status === "playing") {
              if (replayIdx !== null) hint = "Watching replay — use arrows to step through shots";
              else if (isMyTurn && gameState.phase === "cue_in_hand" && !cueHandPos) hint = "Click anywhere on the table to place the cue ball";
              else if (isMyTurn && gameState.phase === "cue_in_hand" && cueHandPos) hint = "Drag the cue back to aim and build power — release to shoot";
              else if (isMyTurn && !myGroup) hint = "Pocket any ball to claim your group — solids or stripes";
              else if (isMyTurn) hint = "Drag the cue back to build power — release to shoot";
            }
            return <HintBar hint={hint} />;
          })()}
          {isMyTurn && gameState.phase === "cue_in_hand" && cueHandPos && (
            <div className="flex justify-end w-full -mt-1">
              <button onClick={() => { setCueHandPos(null); setHoverCuePos(null); }}
                className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs hover:text-red-400">
                Reset ball
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full max-w-xs lg:w-60 lg:self-stretch py-1">
          <div className="flex gap-2">
            <button onClick={startGame}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
              <RotateCcw size={12} /> {t("newGame")}
            </button>
            {status === "playing" && (
              <button onClick={() => { cancelAnimationFrame(rafRef.current); setAnimBalls(null); setResult(t("lose")); setStatus("over"); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
                <Flag size={12} /> {t("surrender")}
              </button>
            )}
          </div>

          {status === "over" && result && (
            <div className="px-3 py-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-[var(--accent-orange)] font-display font-bold text-sm text-center">
              {result}
            </div>
          )}

          {status === "over" && (
            <div className="flex gap-1.5">
              {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={["flex-1 py-1.5 rounded-lg text-[0.7rem] font-display font-semibold border transition-all",
                    difficulty === d
                      ? "bg-pink-500/15 border-pink-500/40 text-[var(--accent-orange)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  ].join(" ")}>
                  {d === "easy" ? t("easy") : d === "medium" ? t("medium") : t("hard")}
                </button>
              ))}
            </div>
          )}

          <BallTypeIndicator myGroup={myGroup} />

          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">{t("shotHistory")}</span>
              {replayIdx !== null && (
                <button onClick={() => { setReplayIdx(null); setAnimBalls(null); cancelAnimationFrame(rafRef.current); }}
                  className="text-[0.65rem] text-[var(--accent-orange)] font-display font-semibold hover:opacity-70">
                  {t("backToLive")} »
                </button>
              )}
            </div>
            <ReplayShotPanel shots={shots} replayIdx={replayIdx} onReplay={(idx) => {
              cancelAnimationFrame(rafRef.current); setAnimBalls(null); setReplayIdx(idx);
            }} />
          </div>
        </div>

      </div>
    </main>
  );
}
