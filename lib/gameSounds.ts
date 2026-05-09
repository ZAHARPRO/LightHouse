"use client";

export type SoundKey =
  // matchmaking / lobby
  | "opponent_found"
  | "player_ready"
  | "match_start"
  | "time_warning"
  // chess
  | "piece_move"
  | "opponent_move"
  | "capture"
  | "castle"
  | "promote"
  | "check"
  | "checkmate"
  // minesweeper
  | "cell_reveal"
  | "flag_place"
  | "flag_remove"
  | "mine_explode"
  | "mine_win"
  // battleship
  | "bs_place"
  | "bs_splash"
  | "bs_explosion"
  | "bs_sunk"
  | "bs_victory"
  | "bs_defeat";

export const SOUND_META: Record<SoundKey, string> = {
  // matchmaking / lobby
  opponent_found: "Opponent Found (matchmaking)",
  player_ready:   "Player Ready (lobby)",
  match_start:    "Match Start (all games)",
  time_warning:   "1 Minute Warning (timed games)",
  // chess
  piece_move:     "Piece Move (chess)",
  opponent_move:  "Opponent Move (chess)",
  capture:        "Capture (chess)",
  castle:         "Castling (chess)",
  promote:        "Promotion (chess)",
  check:          "Check (chess)",
  checkmate:      "Checkmate (chess)",
  // minesweeper
  cell_reveal:    "Cell Reveal (minesweeper)",
  flag_place:     "Flag Placed (minesweeper)",
  flag_remove:    "Flag Removed (minesweeper)",
  mine_explode:   "Mine Explosion (minesweeper)",
  mine_win:       "Win (minesweeper)",
  // battleship
  bs_place:       "Ship Placement (battleship)",
  bs_splash:      "Miss / Splash (battleship)",
  bs_explosion:   "Hit / Explosion (battleship)",
  bs_sunk:        "Ship Sunk (battleship)",
  bs_victory:     "Victory (battleship)",
  bs_defeat:      "Defeat (battleship)",
};

export const ALL_SOUND_KEYS = Object.keys(SOUND_META) as SoundKey[];

// ── Kept for backward compat — battleship online still calls this ──────────────
export type BattleshipSoundKey = "bs_splash" | "bs_explosion" | "bs_sunk" | "bs_place" | "bs_victory" | "bs_defeat";
export function playBattleshipSound(key: BattleshipSoundKey): void {
  playSound(key);
}

// ── Module-level singleton cache (DB-managed sounds from admin panel) ─────────
const cache: Partial<Record<SoundKey, string>> = {};
let loaded = false;
let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = fetch("/api/game-sounds")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Partial<Record<SoundKey, string>>) => {
        Object.assign(cache, data);
        loaded = true;
      })
      .catch(() => { loaded = true; });
  }
  return loadPromise;
}

export function preloadSounds(): void {
  if (typeof window === "undefined") return;
  ensureLoaded();
}

// ── Web Audio synthesizer — fallback when no admin sound is configured ─────────
function synthesize(key: SoundKey): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);

    const noise = (dur: number, lpFreq: number, vol: number) => {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lpFreq;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(now); src.stop(now + dur);
    };

    const tone = (freq: number, type: OscillatorType, startT: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol, startT); g.gain.exponentialRampToValueAtTime(0.001, startT + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(startT); osc.stop(startT + dur);
    };

    switch (key) {
      case "piece_move":
      case "opponent_move":
      case "cell_reveal":
        noise(0.06, 1800, 0.4); break;

      case "capture": noise(0.09, 500, 0.7); break;

      case "castle":
      case "bs_place":
        tone(523, "triangle", now, 0.09, 0.25);
        tone(659, "triangle", now + 0.09, 0.09, 0.25); break;

      case "promote":
        [523, 659, 784].forEach((f, i) => tone(f, "triangle", now + i * 0.09, 0.12, 0.25)); break;

      case "check":
        tone(220, "sine", now, 0.3, 0.4); break;

      case "checkmate":
      case "bs_defeat":
        [523, 392, 330, 262].forEach((f, i) => tone(f, "sawtooth", now + i * 0.13, 0.18, 0.22)); break;

      case "mine_win":
      case "bs_victory":
        [330, 392, 523, 659, 784].forEach((f, i) => tone(f, "triangle", now + i * 0.1, 0.18, 0.28)); break;

      case "mine_explode":
      case "bs_explosion":
        noise(0.45, 900, 1.0); break;

      case "bs_splash": {
        const len = Math.ceil(ctx.sampleRate * 0.25);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3500;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        src.connect(hp); hp.connect(g); g.connect(ctx.destination);
        src.start(now); src.stop(now + 0.25); break;
      }

      case "bs_sunk": {
        const osc = ctx.createOscillator(); osc.type = "sine";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.6);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.6); break;
      }

      case "flag_place": {
        const osc = ctx.createOscillator(); osc.type = "sine";
        osc.frequency.setValueAtTime(500, now); osc.frequency.linearRampToValueAtTime(900, now + 0.08);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.1); break;
      }

      case "flag_remove": {
        const osc = ctx.createOscillator(); osc.type = "sine";
        osc.frequency.setValueAtTime(900, now); osc.frequency.linearRampToValueAtTime(400, now + 0.08);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.1); break;
      }

      case "match_start":
      case "opponent_found":
        [392, 523, 659].forEach((f, i) => tone(f, "triangle", now + i * 0.11, 0.14, 0.28)); break;

      case "player_ready":
        tone(880, "sine", now, 0.15, 0.2); break;

      case "time_warning":
        [0, 0.22, 0.44].forEach(dt => tone(880, "square", now + dt, 0.1, 0.15)); break;
    }

    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────
export function playSound(key: SoundKey): void {
  if (typeof window === "undefined") return;
  ensureLoaded().then(() => {
    const url = cache[key];
    if (url) {
      try {
        const audio = new Audio(url);
        audio.volume = 0.7;
        audio.play().catch(() => {});
      } catch {}
    } else {
      synthesize(key);
    }
  });
}
