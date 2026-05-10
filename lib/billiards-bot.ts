import {
  BilliardsState, BilliardsShot, Ball,
  simulateShot, remainingBalls, activeBalls,
  Group, PF_LEFT, PF_RIGHT, PF_TOP, PF_BOTTOM, BALL_R, POCKETS,
  TABLE_W, TABLE_H,
} from "./billiards";

type Difficulty = "easy" | "medium" | "hard";

// ── Geometry helpers ────────────────────────────────────────────────────────────
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function angleToward(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.atan2(toY - fromY, toX - fromX);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Candidate shots ────────────────────────────────────────────────────────────
interface Candidate {
  angle: number;
  power: number;
  score: number;
}

// Try to find angle to pocket a specific ball through cue ball
function shotToPocketBall(cue: Ball, target: Ball, pocket: [number, number]): number | null {
  // Ghost ball method: find position behind target where cue must hit
  const d = dist(target.x, target.y, pocket[0], pocket[1]);
  if (d < 1) return null;
  const dx = (target.x - pocket[0]) / d;
  const dy = (target.y - pocket[1]) / d;
  const ghostX = target.x + dx * BALL_R * 2;
  const ghostY = target.y + dy * BALL_R * 2;

  // Check ghost ball is reachable (not blocked — simplified, just check basic line)
  if (ghostX < PF_LEFT + BALL_R || ghostX > PF_RIGHT - BALL_R) return null;
  if (ghostY < PF_TOP + BALL_R || ghostY > PF_BOTTOM - BALL_R) return null;

  return angleToward(cue.x, cue.y, ghostX, ghostY);
}

function scoreShot(state: BilliardsState, shot: BilliardsShot, myGroup: Group | null, role: "host" | "guest"): number {
  try {
    const result = simulateShot(state, shot);
    let score = 0;

    if (result.winner === role) return 10000;
    if (result.winner && result.winner !== role) return -10000;

    const myGroupPocketed = myGroup
      ? result.pocketed.filter(id => myGroup === "solids" ? (id >= 1 && id <= 7) : (id >= 9 && id <= 15)).length
      : result.pocketed.filter(id => id !== 0 && id !== 8).length;

    score += myGroupPocketed * 100;
    if (result.continuesTurn) score += 50;
    if (result.pocketed.includes(0)) score -= 200; // scratch penalty
    if (result.pocketed.includes(8) && !result.winner) score -= 500; // illegal 8-ball

    return score;
  } catch {
    return -9999;
  }
}

// ── Bot logic ──────────────────────────────────────────────────────────────────
export function getBotShot(state: BilliardsState, difficulty: Difficulty): BilliardsShot {
  const cue = state.balls.find(b => b.id === 0 && !b.pocketed);
  const role = state.turn;

  // Handle cue ball in hand
  const cueX = state.phase === "cue_in_hand" ? TABLE_W * 0.25 : (cue?.x ?? TABLE_W * 0.25);
  const cueY = state.phase === "cue_in_hand" ? TABLE_H / 2 : (cue?.y ?? TABLE_H / 2);
  const effectiveCue: Ball = { id: 0, x: cueX, y: cueY, vx: 0, vy: 0, pocketed: false };

  if (difficulty === "easy") {
    return easyShot(state, effectiveCue);
  }
  if (difficulty === "medium") {
    return mediumShot(state, effectiveCue, role);
  }
  return hardShot(state, effectiveCue, role);
}

function easyShot(state: BilliardsState, cue: Ball): BilliardsShot {
  const targets = activeBalls(state).filter(b => b.id !== 0);
  if (targets.length === 0) return randomShot(state, cue);

  // Pick random target, aim roughly toward it with random offset
  const t = targets[Math.floor(Math.random() * targets.length)];
  const baseAngle = angleToward(cue.x, cue.y, t.x, t.y);
  const angle = baseAngle + (Math.random() - 0.5) * 1.2; // big random error
  const power = 0.25 + Math.random() * 0.55;

  return buildShot(state, angle, power, cue);
}

function mediumShot(state: BilliardsState, cue: Ball, role: "host" | "guest"): BilliardsShot {
  const myGroup: Group | null = state[role === "host" ? "hostGroup" : "guestGroup"];
  const targets = myGroup ? activeBalls(state).filter(b =>
    myGroup === "solids" ? (b.id >= 1 && b.id <= 7) : (b.id >= 9 && b.id <= 15)
  ) : activeBalls(state).filter(b => b.id !== 0 && b.id !== 8);

  if (targets.length === 0) {
    // Try to pocket 8-ball
    const eight = state.balls.find(b => b.id === 8 && !b.pocketed);
    if (eight) {
      const angle = angleToward(cue.x, cue.y, eight.x, eight.y) + (Math.random() - 0.5) * 0.3;
      return buildShot(state, angle, 0.55 + Math.random() * 0.2, cue);
    }
    return randomShot(state, cue);
  }

  // Find best shot among targets × pockets
  let best: Candidate | null = null;
  for (const t of targets) {
    for (const p of POCKETS) {
      const angle = shotToPocketBall(cue, t, p);
      if (angle === null) continue;
      const power = clamp(0.4 + Math.random() * 0.3, 0.3, 0.8);
      // Add small noise for medium
      const noisyAngle = angle + (Math.random() - 0.5) * 0.35;
      const score = dist(cue.x, cue.y, t.x, t.y) * -0.1 + dist(t.x, t.y, p[0], p[1]) * -0.15;
      if (!best || score > best.score) best = { angle: noisyAngle, power, score };
    }
  }

  if (best) return buildShot(state, best.angle, best.power, cue);
  return easyShot(state, cue);
}

function hardShot(state: BilliardsState, cue: Ball, role: "host" | "guest"): BilliardsShot {
  const myGroup: Group | null = state[role === "host" ? "hostGroup" : "guestGroup"];
  const targets = myGroup ? activeBalls(state).filter(b =>
    myGroup === "solids" ? (b.id >= 1 && b.id <= 7) : (b.id >= 9 && b.id <= 15)
  ) : activeBalls(state).filter(b => b.id !== 0 && b.id !== 8);

  const candidates: Candidate[] = [];

  if (targets.length === 0) {
    const eight = state.balls.find(b => b.id === 8 && !b.pocketed);
    if (eight) {
      for (const p of POCKETS) {
        const angle = shotToPocketBall(cue, eight, p);
        if (angle === null) continue;
        for (const power of [0.45, 0.6, 0.75]) {
          candidates.push({ angle, power, score: scoreShot(state, buildShot(state, angle, power, cue), myGroup, role) });
        }
      }
    }
  } else {
    for (const t of targets) {
      for (const p of POCKETS) {
        const angle = shotToPocketBall(cue, t, p);
        if (angle === null) continue;
        for (const power of [0.4, 0.55, 0.7]) {
          candidates.push({ angle, power, score: scoreShot(state, buildShot(state, angle, power, cue), myGroup, role) });
        }
      }
    }
  }

  if (candidates.length === 0) return mediumShot(state, cue, role);
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  // Add tiny noise so hard bot isn't pixel-perfect
  return buildShot(state, top.angle + (Math.random() - 0.5) * 0.08, top.power, cue);
}

function randomShot(state: BilliardsState, cue: Ball): BilliardsShot {
  return buildShot(state, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.4, cue);
}

function buildShot(state: BilliardsState, angle: number, power: number, cue: Ball): BilliardsShot {
  const shot: BilliardsShot = { angle, power };
  if (state.phase === "cue_in_hand") {
    shot.cueX = cue.x;
    shot.cueY = cue.y;
  }
  return shot;
}
