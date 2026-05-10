"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { RotateCcw, Flag, ChevronLeft, ChevronRight } from "lucide-react";
import {
  initialState, simulateShot, remainingBalls, activeBalls,
  BilliardsState, BilliardsShot, ShotRecord,
  TABLE_W, TABLE_H, BALL_R, POCKETS, POCKET_R,
  PF_LEFT, PF_RIGHT, PF_TOP, PF_BOTTOM,
  decodeShots, encodeShots,
} from "@/lib/billiards";
import { getBotShot } from "@/lib/billiards-bot";
import { playSound, preloadSounds } from "@/lib/gameSounds";
import { awardGameBadge } from "@/actions/badges";

type Difficulty = "easy" | "medium" | "hard";
type Status = "idle" | "playing" | "over";

// Ball colours
const BALL_COLORS: Record<number, string> = {
  1: "#f7d000", 2: "#1a5cdb", 3: "#e03030", 4: "#6a1a8a", 5: "#e07020",
  6: "#157a3a", 7: "#8b1a1a", 8: "#222222",
  9: "#f7d000", 10: "#1a5cdb", 11: "#e03030", 12: "#6a1a8a", 13: "#e07020",
  14: "#157a3a", 15: "#8b1a1a",
};

function drawTable(ctx: CanvasRenderingContext2D, scale: number) {
  const W = TABLE_W * scale, H = TABLE_H * scale;
  // Table felt
  ctx.fillStyle = "#1a7a3c";
  ctx.fillRect(0, 0, W, H);
  // Cushion rail
  ctx.fillStyle = "#0f5628";
  ctx.fillRect(0, 0, W, PF_TOP * scale);
  ctx.fillRect(0, (TABLE_H - PF_TOP) * scale, W, PF_TOP * scale);
  ctx.fillRect(0, 0, PF_LEFT * scale, H);
  ctx.fillRect((TABLE_W - PF_LEFT) * scale, 0, PF_LEFT * scale, H);
  // Playfield border
  ctx.strokeStyle = "#0f5628";
  ctx.lineWidth = 1 * scale;
  ctx.strokeRect(PF_LEFT * scale, PF_TOP * scale, (PF_RIGHT - PF_LEFT) * scale, (PF_BOTTOM - PF_TOP) * scale);
  // Head string (quarter mark)
  ctx.setLineDash([3 * scale, 5 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.7 * scale;
  ctx.beginPath(); ctx.moveTo(TABLE_W * 0.25 * scale, PF_TOP * scale); ctx.lineTo(TABLE_W * 0.25 * scale, PF_BOTTOM * scale); ctx.stroke();
  ctx.setLineDash([]);
}

function drawPockets(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.fillStyle = "#0a0a0a";
  for (const [px, py] of POCKETS) {
    ctx.beginPath();
    ctx.arc(px * scale, py * scale, POCKET_R * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, scale: number) {
  const r = BALL_R * scale;
  const cx = x * scale, cy = y * scale;
  const isStripe = id >= 9 && id <= 15;
  const color = id === 0 ? "#f0f0f0" : BALL_COLORS[id] ?? "#888";

  if (isStripe) {
    // White base
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f0f0f0"; ctx.fill();
    // Stripe band
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(cx - r, cy - r * 0.45, r * 2, r * 0.9);
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  // Number dot (not for cue ball)
  if (id !== 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.fillStyle = "#111"; ctx.font = `bold ${Math.round(r * 0.46)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(id), cx, cy + 0.5);
  }

  // Shine
  const grad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.3, r * 0.04, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.38)");
  grad.addColorStop(0.45, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();

  // Border
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8 * scale; ctx.stroke();
}

function drawCueStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number) {
  const r = BALL_R * scale;
  const startDist = r + 8 * scale;
  const len = 160 * scale;
  const sx = cx * scale - Math.cos(angle) * startDist;
  const sy = cy * scale - Math.sin(angle) * startDist;
  const ex = cx * scale - Math.cos(angle) * (startDist + len);
  const ey = cy * scale - Math.sin(angle) * (startDist + len);

  const grad = ctx.createLinearGradient(sx, sy, ex, ey);
  grad.addColorStop(0, "#c8a96e");
  grad.addColorStop(0.2, "#a0784a");
  grad.addColorStop(1, "#5c3d20");

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3 * scale, 2);
  ctx.strokeStyle = grad;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.restore();
}

function drawAimLine(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, scale: number) {
  ctx.save();
  ctx.setLineDash([4 * scale, 4 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 0.8 * scale;
  ctx.beginPath();
  ctx.moveTo(cx * scale, cy * scale);
  ctx.lineTo(cx * scale + Math.cos(angle) * 200 * scale, cy * scale + Math.sin(angle) * 200 * scale);
  ctx.stroke();
  ctx.restore();
}

function useScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function compute() {
      const maxW = Math.min(window.innerWidth - 32, 700);
      const maxH = Math.min(window.innerHeight - 280, 350);
      const s = Math.min(maxW / TABLE_W, maxH / TABLE_H, 1);
      setScale(Math.max(0.45, s));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

// ── Replay panel ────────────────────────────────────────────────────────────────
function ReplayShotPanel({ shots, replayIdx, onReplay }: {
  shots: ShotRecord[];
  replayIdx: number | null;
  onReplay: (idx: number | null) => void;
}) {
  const t = useTranslations("billiards");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replayIdx === null && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [shots.length, replayIdx]);

  return (
    <div className="flex flex-col min-h-0 gap-1">
      <div ref={ref} className="overflow-y-auto max-h-36 lg:max-h-48 flex flex-col gap-px">
        {shots.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs italic py-2 px-1">{t("noShots")}</p>
        )}
        {shots.map((s, i) => (
          <button key={i} onClick={() => onReplay(i)}
            className={["flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors",
              replayIdx === i
                ? "bg-pink-500/20 text-[var(--accent-orange)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            ].join(" ")}>
            <span className="font-mono text-[var(--text-muted)] w-5 shrink-0">{i + 1}.</span>
            <span className="font-semibold">{s.by === "host" ? "You" : "Bot"}</span>
            {s.pocketed.length > 0 && (
              <span className="text-[var(--text-muted)]">+{s.pocketed.filter(id => id !== 0).length}</span>
            )}
            {s.foul && <span className="text-red-400 text-[0.65rem]">FOUL</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5 pt-1 border-t border-[var(--border-subtle)]">
        <button onClick={() => onReplay(0)} disabled={shots.length === 0 || replayIdx === 0}
          className="px-2 py-0.5 text-base leading-none text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 font-mono">«</button>
        <button onClick={() => onReplay(replayIdx !== null ? Math.max(0, replayIdx - 1) : shots.length - 1)}
          disabled={shots.length === 0 || replayIdx === 0}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <ChevronLeft size={14} />
        </button>
        <span className="flex-1 text-center text-[0.65rem] font-mono text-[var(--text-muted)]">
          {replayIdx !== null ? `${replayIdx + 1}/${shots.length}` : `${shots.length}/${shots.length}`}
        </span>
        <button onClick={() => onReplay(replayIdx !== null ? Math.min(shots.length - 1, replayIdx + 1) : null)}
          disabled={shots.length === 0 || replayIdx === shots.length - 1}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
          <ChevronRight size={14} />
        </button>
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
  const [power, setPower] = useState(0.5);
  const [aimAngle, setAimAngle] = useState(Math.PI); // pointing left initially
  const [shots, setShots] = useState<ShotRecord[]>([]);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [result, setResult] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [placingCue, setPlacingCue] = useState(false);
  const [cueHandPos, setCueHandPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { preloadSounds(); }, []);

  // Compute display state for replay
  const displayState = (() => {
    if (replayIdx === null) return gameState;
    // Replay: apply shots up to replayIdx
    let s = initialState();
    for (let i = 0; i <= replayIdx && i < shots.length; i++) {
      const rec = shots[i];
      const shot: BilliardsShot = rec.shot;
      const res = simulateShot(s, shot);
      s = res.newState;
    }
    return s;
  })();

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = TABLE_W * scale, H = TABLE_H * scale;
    canvas.width = W; canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    drawTable(ctx, scale);
    drawPockets(ctx, scale);

    const state = displayState;
    const isMyTurn = status === "playing" && state.turn === "host" && !botThinking && replayIdx === null;
    const cueBall = state.balls.find(b => b.id === 0 && !b.pocketed);

    // Aim line and cue stick
    if (isMyTurn && cueBall && !placingCue) {
      drawAimLine(ctx, cueBall.x, cueBall.y, aimAngle, scale);
      drawCueStick(ctx, cueBall.x, cueBall.y, aimAngle, scale);
    }
    if (isMyTurn && placingCue && cueHandPos) {
      drawAimLine(ctx, cueHandPos.x, cueHandPos.y, aimAngle, scale);
    }

    // Balls
    for (const b of state.balls) {
      if (b.pocketed) continue;
      drawBall(ctx, b.id, b.x, b.y, scale);
    }

    // Ghost cue ball in hand
    if (isMyTurn && (placingCue || state.phase === "cue_in_hand") && !state.balls.find(b => b.id === 0 && !b.pocketed)) {
      const pos = cueHandPos ?? { x: TABLE_W * 0.25, y: TABLE_H / 2 };
      ctx.globalAlpha = 0.5;
      drawBall(ctx, 0, pos.x, pos.y, scale);
      ctx.globalAlpha = 1;
    }
  }, [displayState, scale, aimAngle, status, botThinking, replayIdx, placingCue, cueHandPos]);

  function startGame() {
    const state = initialState();
    setGameState(state);
    setShots([]); setReplayIdx(null); setResult("");
    setBotThinking(false); setPlacingCue(false); setCueHandPos(null);
    setAimAngle(Math.PI); setPower(0.5);
    setStatus("playing");
    playSound("match_start");
  }

  const applyShot = useCallback((state: BilliardsState, shot: BilliardsShot, by: "host" | "guest"): { nextState: BilliardsState; won: boolean } => {
    const result = simulateShot(state, shot);
    const hasFoul = result.events.some(e => e.type === "foul");
    const rec: ShotRecord = {
      by, shot,
      pocketed: result.pocketed,
      continuesTurn: result.continuesTurn,
      foul: hasFoul,
      winner: result.winner ?? undefined,
    };
    setShots(prev => [...prev, rec]);

    if (result.pocketed.filter(id => id !== 0).length > 0) playSound("bl_pocket");
    else if (hasFoul) playSound("bl_scratch");
    else playSound("bl_cue_strike");

    if (result.winner) {
      const playerWon = result.winner === "host";
      setResult(playerWon ? t("win") : t("lose"));
      setStatus("over");
      playSound(playerWon ? "bl_win" : "bl_defeat");
      if (playerWon) awardGameBadge("BILLIARDS_WIN").catch(() => {});
    }

    setGameState(result.newState);
    return { nextState: result.newState, won: !!result.winner };
  }, [t]);

  const triggerBot = useCallback((state: BilliardsState) => {
    if (state.turn !== "guest") return;
    setBotThinking(true);
    setTimeout(() => {
      const shot = getBotShot(state, difficulty);
      const { nextState, won } = applyShot(state, shot, "guest");
      setBotThinking(false);
      if (!won && nextState.turn === "guest") {
        setTimeout(() => triggerBot(nextState), 400);
      }
    }, 600);
  }, [difficulty, applyShot]);

  function handleShoot() {
    if (status !== "playing" || gameState.turn !== "host" || botThinking || replayIdx !== null) return;
    const shot: BilliardsShot = {
      angle: aimAngle,
      power,
      ...(gameState.phase === "cue_in_hand" ? {
        cueX: cueHandPos?.x ?? TABLE_W * 0.25,
        cueY: cueHandPos?.y ?? TABLE_H / 2,
      } : {}),
    };
    const { nextState, won } = applyShot(gameState, shot, "host");
    if (!won && nextState.turn === "guest") {
      setTimeout(() => triggerBot(nextState), 400);
    }
    setPlacingCue(false); setCueHandPos(null);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (status !== "playing" || botThinking || replayIdx !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    if (gameState.phase === "cue_in_hand" && gameState.turn === "host") {
      // Place cue ball
      const cx = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, mx));
      const cy = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, my));
      setCueHandPos({ x: cx, y: cy });
      setPlacingCue(false);
      return;
    }

    const cueBall = gameState.balls.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall || gameState.turn !== "host") return;
    const angle = Math.atan2(my - cueBall.y, mx - cueBall.x) + Math.PI;
    setAimAngle(angle);
  }

  function handleCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (status !== "playing" || gameState.turn !== "host" || botThinking || replayIdx !== null) return;
    if (gameState.phase === "cue_in_hand") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const cueBall = gameState.balls.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;
    setAimAngle(Math.atan2(my - cueBall.y, mx - cueBall.x) + Math.PI);
  }

  const isMyTurn = status === "playing" && gameState.turn === "host" && !botThinking && replayIdx === null;
  const myGroup  = gameState.hostGroup;
  const oppGroup = gameState.guestGroup;
  const remaining = myGroup ? remainingBalls(gameState, myGroup) : [];
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
            <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Games</Link>
            {/* Group indicators */}
            <div className="flex gap-3 text-xs font-mono">
              <span className={oppGroup ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}>
                Bot: {oppGroup ? `${oppGroup} (${oppRemaining.length})` : "—"}
              </span>
              <span className={myGroup ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                You: {myGroup ? `${myGroup} (${remaining.length})` : "—"}
              </span>
            </div>
          </div>

          {/* Status bar */}
          <div className="text-xs text-center font-display font-semibold min-h-[1.25rem]">
            {replayIdx !== null ? (
              <span className="text-[var(--accent-orange)]">{t("spectating")} ({replayIdx + 1}/{shots.length})</span>
            ) : botThinking ? (
              <span className="text-[var(--text-muted)] animate-pulse">{t("opponentTurn")}</span>
            ) : isMyTurn ? (
              gameState.phase === "cue_in_hand"
                ? <span className="text-yellow-400">{t("cueBallInHand")}</span>
                : <span className="text-green-400">{t("aimAndShoot")}</span>
            ) : null}
          </div>

          <canvas
            ref={canvasRef}
            style={{ width: TABLE_W * scale, height: TABLE_H * scale, cursor: isMyTurn ? "crosshair" : "default" }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
          />

          {/* Controls */}
          {isMyTurn && replayIdx === null && (
            <div className="flex items-center gap-3 w-full mt-1">
              <span className="text-xs text-[var(--text-muted)] shrink-0">{t("power")}</span>
              <input type="range" min={0.05} max={1} step={0.01} value={power}
                onChange={e => setPower(parseFloat(e.target.value))}
                className="flex-1 accent-orange-500" />
              <button onClick={handleShoot}
                disabled={gameState.phase === "cue_in_hand" && !cueHandPos && !gameState.balls.find(b => b.id === 0 && !b.pocketed)}
                className="px-5 py-2 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40">
                {t("shoot")}
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-full max-w-xs lg:w-60 lg:self-stretch py-1">
          {/* Controls */}
          <div className="flex gap-2">
            <button onClick={startGame}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
              <RotateCcw size={12} /> {t("newGame")}
            </button>
            {status === "playing" && (
              <button onClick={() => { setResult(t("lose")); setStatus("over"); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
                <Flag size={12} /> {t("surrender")}
              </button>
            )}
          </div>

          {/* Result */}
          {status === "over" && result && (
            <div className="px-3 py-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-[var(--accent-orange)] font-display font-bold text-sm text-center">
              {result}
            </div>
          )}

          {/* Difficulty */}
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

          {/* Shot history */}
          <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">{t("shotHistory")}</span>
              {replayIdx !== null && (
                <button onClick={() => setReplayIdx(null)}
                  className="text-[0.65rem] text-[var(--accent-orange)] font-display font-semibold hover:opacity-70">
                  {t("backToLive")} »
                </button>
              )}
            </div>
            <ReplayShotPanel shots={shots} replayIdx={replayIdx} onReplay={setReplayIdx} />
          </div>
        </div>

      </div>
    </main>
  );
}
