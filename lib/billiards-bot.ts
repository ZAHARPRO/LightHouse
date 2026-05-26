import {
  BilliardsState, BilliardsShot, Ball,
  simulateShot, activeBalls,
  Group, PF_LEFT, PF_RIGHT, PF_TOP, PF_BOTTOM, BALL_R, POCKETS,
  TABLE_W, TABLE_H,
} from "./billiards";

type Difficulty = "easy" | "medium" | "hard";

// ── Geometry helpers ─────────────────────────────────────────────────────────
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
function angleToward(fx: number, fy: number, tx: number, ty: number): number {
  return Math.atan2(ty - fy, tx - fx);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface Candidate { angle: number; power: number; score: number }

// Ghost-ball method: find cue angle to send target ball into pocket
function shotToPocketBall(cue: Ball, target: Ball, pocket: [number, number]): number | null {
  const d = dist(target.x, target.y, pocket[0], pocket[1]);
  if (d < 1) return null;
  const dx = (target.x - pocket[0]) / d;
  const dy = (target.y - pocket[1]) / d;
  const ghostX = target.x + dx * BALL_R * 2;
  const ghostY = target.y + dy * BALL_R * 2;
  if (ghostX < PF_LEFT + BALL_R || ghostX > PF_RIGHT - BALL_R) return null;
  if (ghostY < PF_TOP + BALL_R || ghostY > PF_BOTTOM - BALL_R) return null;
  return angleToward(cue.x, cue.y, ghostX, ghostY);
}

function scoreShot(
  state: BilliardsState,
  shot: BilliardsShot,
  myGroup: Group | null,
  role: "host" | "guest",
): number {
  try {
    const result = simulateShot(state, shot);
    if (result.winner === role) return 10000;
    if (result.winner && result.winner !== role) return -10000;

    const myGroupPocketed = myGroup
      ? result.pocketed.filter(id =>
          myGroup === "solids" ? (id >= 1 && id <= 7) : (id >= 9 && id <= 15)
        ).length
      : result.pocketed.filter(id => id !== 0 && id !== 8).length;

    let score = myGroupPocketed * 100;
    if (result.continuesTurn) score += 50;
    if (result.pocketed.includes(0)) score -= 200;
    if (result.pocketed.includes(8) && !result.winner) score -= 500;
    return score;
  } catch {
    return -9999;
  }
}

// Pick a cue-in-hand position that maximises the best shot score
function bestCuePosition(
  state: BilliardsState,
  myGroup: Group | null,
  role: "host" | "guest",
  targetIds: number[],
): Ball {
  const defaultX = TABLE_W * 0.25;
  const defaultY = TABLE_H * 0.5;
  if (targetIds.length === 0) return { id: 0, x: defaultX, y: defaultY, vx: 0, vy: 0, pocketed: false };

  const candidatePositions: [number, number][] = [
    [TABLE_W * 0.15, TABLE_H * 0.25],
    [TABLE_W * 0.15, TABLE_H * 0.5],
    [TABLE_W * 0.15, TABLE_H * 0.75],
    [TABLE_W * 0.25, TABLE_H * 0.33],
    [TABLE_W * 0.25, TABLE_H * 0.5],
    [TABLE_W * 0.25, TABLE_H * 0.67],
  ];

  let bestScore = -Infinity;
  let bestPos: [number, number] = [defaultX, defaultY];

  for (const [cx, cy] of candidatePositions) {
    const testCue: Ball = { id: 0, x: cx, y: cy, vx: 0, vy: 0, pocketed: false };
    let posScore = 0;
    for (const t of activeBalls(state).filter(b => targetIds.includes(b.id))) {
      for (const p of POCKETS) {
        const angle = shotToPocketBall(testCue, t, p);
        if (angle === null) continue;
        const shot: BilliardsShot = { angle, power: 0.6, cueX: cx, cueY: cy };
        posScore = Math.max(posScore, scoreShot(state, shot, myGroup, role));
      }
    }
    if (posScore > bestScore) { bestScore = posScore; bestPos = [cx, cy]; }
  }

  return { id: 0, x: bestPos[0], y: bestPos[1], vx: 0, vy: 0, pocketed: false };
}

// Weighted pick from sorted candidates
function weightedPick(candidates: Candidate[], weights: number[]): Candidate {
  const n = Math.min(candidates.length, weights.length);
  const total = weights.slice(0, n).reduce((a, b) => a + b, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += weights[i];
    if (r <= acc) return candidates[i];
  }
  return candidates[0];
}

// ── Bot entry point ───────────────────────────────────────────────────────────
export function getBotShot(state: BilliardsState, difficulty: Difficulty): BilliardsShot {
  const cueOnBoard = state.balls.find(b => b.id === 0 && !b.pocketed);
  const role = state.turn;
  const myGroup: Group | null = state[role === "host" ? "hostGroup" : "guestGroup"];

  const targetIds = myGroup
    ? (myGroup === "solids" ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15])
    : activeBalls(state).filter(b => b.id !== 0 && b.id !== 8).map(b => b.id);

  if (difficulty === "easy") {
    const effectiveCue: Ball = {
      id: 0,
      x: state.phase === "cue_in_hand" ? TABLE_W * 0.25 : (cueOnBoard?.x ?? TABLE_W * 0.25),
      y: state.phase === "cue_in_hand" ? TABLE_H / 2 : (cueOnBoard?.y ?? TABLE_H / 2),
      vx: 0, vy: 0, pocketed: false,
    };
    return easyShot(state, effectiveCue);
  }

  // For medium/hard: choose optimal cue-in-hand position
  let effectiveCue: Ball;
  if (state.phase === "cue_in_hand") {
    effectiveCue = difficulty === "hard"
      ? bestCuePosition(state, myGroup, role, targetIds)
      : { id: 0, x: TABLE_W * 0.25, y: TABLE_H * 0.5, vx: 0, vy: 0, pocketed: false };
  } else {
    effectiveCue = cueOnBoard
      ? { ...cueOnBoard }
      : { id: 0, x: TABLE_W * 0.25, y: TABLE_H * 0.5, vx: 0, vy: 0, pocketed: false };
  }

  if (difficulty === "medium") return mediumShot(state, effectiveCue, role, myGroup);
  return hardShot(state, effectiveCue, role, myGroup);
}

function easyShot(state: BilliardsState, cue: Ball): BilliardsShot {
  const targets = activeBalls(state).filter(b => b.id !== 0);
  if (targets.length === 0) return randomShot(state, cue);
  const t = targets[Math.floor(Math.random() * targets.length)];
  const angle = angleToward(cue.x, cue.y, t.x, t.y) + (Math.random() - 0.5) * 1.2;
  return buildShot(state, angle, 0.25 + Math.random() * 0.55, cue);
}

function mediumShot(
  state: BilliardsState,
  cue: Ball,
  role: "host" | "guest",
  myGroup: Group | null,
): BilliardsShot {
  const targets = getTargets(state, myGroup);

  if (targets.length === 0) {
    const eight = state.balls.find(b => b.id === 8 && !b.pocketed);
    if (eight) {
      return buildEightBallShot(state, cue, eight, role, 0.2, myGroup);
    }
    return easyShot(state, cue);
  }

  const candidates: Candidate[] = [];
  for (const t of targets) {
    for (const p of POCKETS) {
      const angle = shotToPocketBall(cue, t, p);
      if (angle === null) continue;
      // Medium: simulate 3 power levels with moderate noise
      for (const power of [0.4, 0.55, 0.7]) {
        const noisyAngle = angle + (Math.random() - 0.5) * 0.25;
        const shot = buildShot(state, noisyAngle, power, cue);
        candidates.push({ angle: noisyAngle, power, score: scoreShot(state, shot, myGroup, role) });
      }
    }
  }

  if (candidates.length === 0) return easyShot(state, cue);
  candidates.sort((a, b) => b.score - a.score);

  // Pick from top-3 with weighted probability (50/30/20) for variety
  const best = weightedPick(candidates, [0.5, 0.3, 0.2]);
  return buildShot(state, best.angle + (Math.random() - 0.5) * 0.12, best.power, cue);
}

function hardShot(
  state: BilliardsState,
  cue: Ball,
  role: "host" | "guest",
  myGroup: Group | null,
): BilliardsShot {
  const targets = getTargets(state, myGroup);
  const candidates: Candidate[] = [];

  if (targets.length === 0) {
    const eight = state.balls.find(b => b.id === 8 && !b.pocketed);
    if (eight) {
      return buildEightBallShot(state, cue, eight, role, 0.05, myGroup);
    }
    return randomShot(state, cue);
  }

  // Hard: 6 power levels, no noise yet (noise added at selection)
  for (const t of targets) {
    for (const p of POCKETS) {
      const angle = shotToPocketBall(cue, t, p);
      if (angle === null) continue;
      for (const power of [0.35, 0.45, 0.55, 0.65, 0.75, 0.85]) {
        const shot = buildShot(state, angle, power, cue);
        const score = scoreShot(state, shot, myGroup, role);
        candidates.push({ angle, power, score });
      }
    }
  }

  // Also consider safety play: if best shot score is very low, play a defensive shot
  const topOffensive = candidates.reduce((a, b) => b.score > a.score ? b : a, candidates[0]);
  if (topOffensive.score < 0) {
    const safetyCandidate = buildSafetyShot(state, cue, role, myGroup);
    if (safetyCandidate) return safetyCandidate;
  }

  if (candidates.length === 0) return mediumShot(state, cue, role, myGroup);
  candidates.sort((a, b) => b.score - a.score);

  // Pick from top-2 (80/20) — hard bot is consistent but not robotic
  const best = weightedPick(candidates, [0.8, 0.2]);
  return buildShot(state, best.angle + (Math.random() - 0.5) * 0.05, best.power, cue);
}

function buildEightBallShot(
  state: BilliardsState,
  cue: Ball,
  eight: Ball,
  role: "host" | "guest",
  noise: number,
  myGroup: Group | null = null,
): BilliardsShot {
  const candidates: Candidate[] = [];
  for (const p of POCKETS) {
    const angle = shotToPocketBall(cue, eight, p);
    if (angle === null) continue;
    for (const power of [0.45, 0.6, 0.75]) {
      const shot = buildShot(state, angle, power, cue);
      candidates.push({ angle, power, score: scoreShot(state, shot, myGroup, role) });
    }
  }
  if (candidates.length === 0) return randomShot(state, cue);
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return buildShot(state, best.angle + (Math.random() - 0.5) * noise, best.power, cue);
}

// Safety play: hit own ball weakly to hide the cue ball on the opposite cushion
function buildSafetyShot(
  state: BilliardsState,
  cue: Ball,
  role: "host" | "guest",
  myGroup: Group | null,
): BilliardsShot | null {
  const targets = getTargets(state, myGroup);
  if (targets.length === 0) return null;

  // Pick the target closest to the far cushion from cue and hit it softly
  const sorted = targets.slice().sort((a, b) =>
    dist(a.x, a.y, cue.x, cue.y) - dist(b.x, b.y, cue.x, cue.y)
  );
  const t = sorted[0];
  const angle = angleToward(cue.x, cue.y, t.x, t.y);
  // Low power safety roll
  return buildShot(state, angle + (Math.random() - 0.5) * 0.1, 0.2 + Math.random() * 0.1, cue);
}

function getTargets(state: BilliardsState, myGroup: Group | null): Ball[] {
  if (myGroup) {
    return activeBalls(state).filter(b =>
      myGroup === "solids" ? (b.id >= 1 && b.id <= 7) : (b.id >= 9 && b.id <= 15)
    );
  }
  return activeBalls(state).filter(b => b.id !== 0 && b.id !== 8);
}

function randomShot(state: BilliardsState, cue: Ball): BilliardsShot {
  return buildShot(state, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.4, cue);
}

function buildShot(state: BilliardsState, angle: number, power: number, cue: Ball): BilliardsShot {
  const shot: BilliardsShot = { angle, power: clamp(power, 0.05, 1) };
  if (state.phase === "cue_in_hand") {
    shot.cueX = cue.x;
    shot.cueY = cue.y;
  }
  return shot;
}
