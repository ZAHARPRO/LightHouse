// ── Constants ──────────────────────────────────────────────────────────────────
export const TABLE_W   = 700;
export const TABLE_H   = 350;
export const BALL_R    = 14;
export const POCKET_R  = 19;
export const CUSHION   = 30; // inset from outer edge

// Playfield bounds (inside cushions)
export const PF_LEFT   = CUSHION;
export const PF_RIGHT  = TABLE_W - CUSHION;
export const PF_TOP    = CUSHION;
export const PF_BOTTOM = TABLE_H - CUSHION;

// 6 pocket centres
export const POCKETS: [number, number][] = [
  [PF_LEFT - 2,  PF_TOP - 2],
  [TABLE_W / 2,  PF_TOP - 6],
  [PF_RIGHT + 2, PF_TOP - 2],
  [PF_LEFT - 2,  PF_BOTTOM + 2],
  [TABLE_W / 2,  PF_BOTTOM + 6],
  [PF_RIGHT + 2, PF_BOTTOM + 2],
];

// Corner pocket influence — diagonal cutout near corners (simplifies wall collision)
const CORNER_CUT = BALL_R + 4;

// Physics constants
const FRICTION   = 0.9880;  // applied each step
const SPIN_DECAY = 0.92;    // not modelled separately — just extra friction on slow balls
const STOP_V     = 0.06;    // px/step threshold → set velocity to 0
const MAX_STEPS  = 12000;   // safety ceiling (~40s at 300Hz)
const DT         = 1 / 300; // simulation step (seconds, not used for integration — step = 1 px-based)

// ── Types ──────────────────────────────────────────────────────────────────────
export type Group = "solids" | "stripes";

export interface Ball {
  id: number;   // 0=cue, 1-7=solids, 8=eight, 9-15=stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
}

export interface BilliardsState {
  balls: Ball[];
  turn: "host" | "guest";
  hostGroup: Group | null;
  guestGroup: Group | null;
  phase: "playing" | "cue_in_hand";
  moveCount: number;
}

export interface BilliardsShot {
  angle: number;   // radians (0 = right)
  power: number;   // 0..1
  cueX?: number;   // when cue ball is in hand
  cueY?: number;
}

export interface ShotEvent {
  type: "pocket" | "scratch" | "foul" | "win" | "loss";
  ballId?: number;
  reason?: string;
}

export interface ShotResult {
  newState: BilliardsState;
  events: ShotEvent[];
  pocketed: number[];
  continuesTurn: boolean;
  winner: "host" | "guest" | null;
  winReason: string | null;
}

// ── Ball ID helpers ────────────────────────────────────────────────────────────
export function ballGroup(id: number): Group | "cue" | "eight" {
  if (id === 0) return "cue";
  if (id === 8) return "eight";
  if (id >= 1 && id <= 7) return "solids";
  return "stripes";
}

export function isSolid(id: number): boolean  { return id >= 1 && id <= 7; }
export function isStripe(id: number): boolean { return id >= 9 && id <= 15; }

// ── Initial rack ───────────────────────────────────────────────────────────────
const RACK_X = 490;
const RACK_Y = TABLE_H / 2;
const RACK_SPACING = BALL_R * 2 + 1;

// Standard 8-ball rack: 5 rows, ball 8 in center, corners one solid one stripe
const RACK_IDS: number[][] = [
  [1],
  [9, 2],
  [3, 8, 10],
  [4, 11, 5, 12],
  [6, 13, 7, 14, 15],
];

export function initialState(): BilliardsState {
  const balls: Ball[] = [];

  // Cue ball
  balls.push({ id: 0, x: TABLE_W * 0.25, y: TABLE_H / 2, vx: 0, vy: 0, pocketed: false });

  // Rack
  for (let row = 0; row < RACK_IDS.length; row++) {
    const ids = RACK_IDS[row];
    const rx = RACK_X + row * RACK_SPACING * Math.cos(Math.PI / 6);
    const rowH = RACK_SPACING;
    const startY = RACK_Y - (ids.length - 1) * rowH / 2;
    for (let col = 0; col < ids.length; col++) {
      balls.push({
        id: ids[col],
        x: rx,
        y: startY + col * rowH,
        vx: 0, vy: 0,
        pocketed: false,
      });
    }
  }

  return {
    balls,
    turn: "host",
    hostGroup: null,
    guestGroup: null,
    phase: "playing",
    moveCount: 0,
  };
}

// ── Serialisation ──────────────────────────────────────────────────────────────
export function serializeState(state: BilliardsState): string {
  return JSON.stringify({
    balls: state.balls.map(b => ({
      id: b.id, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100, pocketed: b.pocketed,
    })),
    turn: state.turn,
    hostGroup: state.hostGroup,
    guestGroup: state.guestGroup,
    phase: state.phase,
    moveCount: state.moveCount,
  });
}

export function deserializeState(json: string): BilliardsState {
  try {
    const d = JSON.parse(json);
    if (!d || typeof d !== "object" || !Array.isArray(d.balls)) return initialState();
    return {
      ...d,
      balls: d.balls.map((b: Ball) => ({ ...b, vx: 0, vy: 0 })),
    };
  } catch {
    return initialState();
  }
}

// ── Physics helpers ────────────────────────────────────────────────────────────
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function inPocket(b: Ball): boolean {
  for (const [px, py] of POCKETS) {
    if (dist2(b.x, b.y, px, py) < POCKET_R * POCKET_R) return true;
  }
  return false;
}

function cloneBalls(balls: Ball[]): Ball[] {
  return balls.map(b => ({ ...b }));
}

// Near-corner cushion check: corners are bevelled so balls don't get stuck
function nearCorner(x: number, y: number): boolean {
  return (
    (x < PF_LEFT + CORNER_CUT && y < PF_TOP + CORNER_CUT) ||
    (x > PF_RIGHT - CORNER_CUT && y < PF_TOP + CORNER_CUT) ||
    (x < PF_LEFT + CORNER_CUT && y > PF_BOTTOM - CORNER_CUT) ||
    (x > PF_RIGHT - CORNER_CUT && y > PF_BOTTOM - CORNER_CUT)
  );
}

// One physics step — mutates balls array in place
function stepPhysics(balls: Ball[]): void {
  // Move
  for (const b of balls) {
    if (b.pocketed) continue;
    b.x += b.vx;
    b.y += b.vy;
  }

  // Pocket check
  for (const b of balls) {
    if (b.pocketed) continue;
    if (inPocket(b)) {
      b.pocketed = true;
      b.vx = 0;
      b.vy = 0;
    }
  }

  // Wall collisions (skip near pocket corners)
  for (const b of balls) {
    if (b.pocketed) continue;
    if (nearCorner(b.x, b.y)) continue;

    if (b.x - BALL_R < PF_LEFT)  { b.x = PF_LEFT  + BALL_R; b.vx = Math.abs(b.vx) * 0.75; }
    if (b.x + BALL_R > PF_RIGHT) { b.x = PF_RIGHT  - BALL_R; b.vx = -Math.abs(b.vx) * 0.75; }
    if (b.y - BALL_R < PF_TOP)   { b.y = PF_TOP   + BALL_R; b.vy = Math.abs(b.vy) * 0.75; }
    if (b.y + BALL_R > PF_BOTTOM){ b.y = PF_BOTTOM - BALL_R; b.vy = -Math.abs(b.vy) * 0.75; }
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.pocketed) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b.pocketed) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const minD = BALL_R * 2;

      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;

        // Separate overlapping balls
        const overlap = (minD - d) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // Elastic collision (equal mass)
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          const imp = dot * 0.96; // slight energy loss
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          b.vx += imp * nx;
          b.vy += imp * ny;
        }
      }
    }
  }

  // Friction
  for (const b of balls) {
    if (b.pocketed) continue;
    const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (spd < STOP_V) {
      b.vx = 0;
      b.vy = 0;
    } else {
      const f = spd < 1 ? FRICTION * SPIN_DECAY : FRICTION;
      b.vx *= f;
      b.vy *= f;
    }
  }
}

function allStopped(balls: Ball[]): boolean {
  return balls.every(b => b.pocketed || (b.vx === 0 && b.vy === 0));
}

// ── Main simulation ────────────────────────────────────────────────────────────
const MAX_SHOT_POWER = 22; // px/step at power=1

export function simulateShot(state: BilliardsState, shot: BilliardsShot): ShotResult {
  const balls = cloneBalls(state.balls);

  // Place cue ball if in-hand
  let cueBall = balls.find(b => b.id === 0);
  if (!cueBall) {
    // Cue ball was pocketed — restore it
    cueBall = { id: 0, x: shot.cueX ?? TABLE_W * 0.25, y: shot.cueY ?? TABLE_H / 2, vx: 0, vy: 0, pocketed: false };
    balls.push(cueBall);
  } else if (state.phase === "cue_in_hand" && shot.cueX !== undefined) {
    cueBall.x = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, shot.cueX));
    cueBall.y = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, shot.cueY ?? cueBall.y));
    cueBall.pocketed = false;
  }

  // Apply velocity to cue ball
  const speed = shot.power * MAX_SHOT_POWER;
  cueBall.vx = Math.cos(shot.angle) * speed;
  cueBall.vy = Math.sin(shot.angle) * speed;

  // Track pre-shot state
  const prePocketed = new Set(balls.filter(b => b.pocketed).map(b => b.id));
  let cueBallHitSomething = false;
  let firstHitId: number | null = null;

  // Run simulation
  for (let step = 0; step < MAX_STEPS; step++) {
    // Detect first cue-ball hit
    if (!cueBallHitSomething && cueBall && !cueBall.pocketed) {
      for (const b of balls) {
        if (b.id === 0 || b.pocketed) continue;
        if (dist2(cueBall.x, cueBall.y, b.x, b.y) < (BALL_R * 2 + 1) ** 2) {
          cueBallHitSomething = true;
          firstHitId = b.id;
          break;
        }
      }
    }

    stepPhysics(balls);
    if (allStopped(balls)) break;
  }

  // What got pocketed this turn
  const nowPocketed = balls.filter(b => b.pocketed && !prePocketed.has(b.id)).map(b => b.id);
  const scratched    = nowPocketed.includes(0);
  const eightPocketed = nowPocketed.includes(8);
  const solidsPocketed  = nowPocketed.filter(isSolid);
  const stripesPocketed = nowPocketed.filter(isStripe);

  // New state
  const newState: BilliardsState = {
    balls,
    turn: state.turn === "host" ? "guest" : "host",
    hostGroup: state.hostGroup,
    guestGroup: state.guestGroup,
    phase: "playing",
    moveCount: state.moveCount + 1,
  };

  const events: ShotEvent[] = [];
  let winner: "host" | "guest" | null = null;
  let winReason: string | null = null;
  let continuesTurn = false;

  const me = state.turn;
  const opp: "host" | "guest" = me === "host" ? "guest" : "host";

  // Assign groups on first pocket (if not yet assigned)
  if (!state.hostGroup && !state.guestGroup) {
    if (solidsPocketed.length > 0 && stripesPocketed.length === 0 && !eightPocketed) {
      newState.hostGroup = me === "host" ? "solids" : "stripes";
      newState.guestGroup = me === "host" ? "stripes" : "solids";
    } else if (stripesPocketed.length > 0 && solidsPocketed.length === 0 && !eightPocketed) {
      newState.hostGroup = me === "host" ? "stripes" : "solids";
      newState.guestGroup = me === "host" ? "solids" : "stripes";
    }
    // If mixed or only 8, groups stay unassigned, no continuation
  } else {
    newState.hostGroup = state.hostGroup;
    newState.guestGroup = state.guestGroup;
  }

  const myGroup: Group | null = newState[me === "host" ? "hostGroup" : "guestGroup"];
  const oppGroup: Group | null = newState[opp === "host" ? "hostGroup" : "guestGroup"];

  // Check foul: no cushion/ball hit, or hit opponent's ball first
  const myGroupIds = myGroup === "solids" ? [1,2,3,4,5,6,7] : myGroup === "stripes" ? [9,10,11,12,13,14,15] : [];
  const isBreak = state.moveCount === 0;
  const foul = !isBreak && !cueBallHitSomething;
  const hitOpponentFirst = firstHitId !== null && myGroup !== null && !myGroupIds.includes(firstHitId) && firstHitId !== 8;
  const hasFoul = foul || (hitOpponentFirst && !isBreak);

  if (hasFoul) events.push({ type: "foul" });

  // Scratch
  if (scratched) {
    events.push({ type: "scratch" });
    newState.phase = "cue_in_hand";
    // Restore cue ball (removed from active balls by pocketing) — leave as pocketed, client handles it
  }

  // Eight ball pocketed
  if (eightPocketed) {
    const myGroupBalls = myGroup === "solids" ? [1,2,3,4,5,6,7] : myGroup === "stripes" ? [9,10,11,12,13,14,15] : [];
    const allMyGroupCleared = myGroupBalls.every(id => nowPocketed.includes(id) || prePocketed.has(id));

    if (scratched || hasFoul || !allMyGroupCleared) {
      // Loss: pocketed 8 before clearing group, or scratched while pocketing 8
      winner = opp;
      winReason = scratched ? "scratch_on_eight" : "eight_ball_early";
      events.push({ type: "loss", reason: winReason });
    } else {
      winner = me;
      winReason = "pocketed_eight";
      events.push({ type: "win", reason: winReason });
    }
  }

  // Determine turn continuation (only if no foul, no scratch, no game over)
  if (!winner && !scratched && !hasFoul) {
    const myGroupPocketed = myGroup === "solids"
      ? solidsPocketed.length > 0
      : myGroup === "stripes"
      ? stripesPocketed.length > 0
      : (solidsPocketed.length > 0 || stripesPocketed.length > 0) && !eightPocketed;

    if (myGroupPocketed) {
      continuesTurn = true;
      newState.turn = me; // stay on same player
    }
  }

  // On foul/scratch: opponent gets cue in hand
  if (hasFoul || scratched) {
    newState.turn = opp;
    if (scratched) newState.phase = "cue_in_hand";
  }

  return {
    newState,
    events,
    pocketed: nowPocketed,
    continuesTurn,
    winner,
    winReason,
  };
}

// ── Remaining balls helpers ────────────────────────────────────────────────────
export function remainingBalls(state: BilliardsState, group: Group): number[] {
  const ids = group === "solids" ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
  return ids.filter(id => !state.balls.find(b => b.id === id)?.pocketed);
}

export function activeBalls(state: BilliardsState): Ball[] {
  return state.balls.filter(b => !b.pocketed);
}

// ── Shot recording for replay ─────────────────────────────────────────────────
export interface ShotRecord {
  by: "host" | "guest";
  shot: BilliardsShot;
  pocketed: number[];
  continuesTurn: boolean;
  foul?: boolean;
  winner?: "host" | "guest";
}

export function encodeShots(shots: ShotRecord[]): string {
  return JSON.stringify(shots);
}

export function decodeShots(json: string): ShotRecord[] {
  try { return JSON.parse(json); } catch { return []; }
}

// ── Frame-by-frame animation ───────────────────────────────────────────────────
// Returns Ball snapshots sampled every stepsPerFrame physics steps.
// Client plays these back at ~60fps to animate a shot smoothly.
export function animateShot(
  state: BilliardsState,
  shot: BilliardsShot,
  stepsPerFrame = 1,
): Ball[][] {
  const balls = cloneBalls(state.balls);

  let cueBall = balls.find(b => b.id === 0);
  if (!cueBall) {
    cueBall = { id: 0, x: shot.cueX ?? TABLE_W * 0.25, y: shot.cueY ?? TABLE_H / 2, vx: 0, vy: 0, pocketed: false };
    balls.push(cueBall);
  } else if (state.phase === "cue_in_hand" && shot.cueX !== undefined) {
    cueBall.x = Math.max(PF_LEFT + BALL_R, Math.min(PF_RIGHT - BALL_R, shot.cueX));
    cueBall.y = Math.max(PF_TOP + BALL_R, Math.min(PF_BOTTOM - BALL_R, shot.cueY ?? cueBall.y));
    cueBall.pocketed = false;
  }
  cueBall.vx = Math.cos(shot.angle) * shot.power * MAX_SHOT_POWER;
  cueBall.vy = Math.sin(shot.angle) * shot.power * MAX_SHOT_POWER;

  const frames: Ball[][] = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    stepPhysics(balls);
    if (step % stepsPerFrame === 0) frames.push(cloneBalls(balls));
    if (allStopped(balls)) break;
  }
  frames.push(cloneBalls(balls));
  return frames;
}
