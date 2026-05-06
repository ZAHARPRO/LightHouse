"use client";

export type SoundKey =
  | "opponent_found"
  | "player_ready"
  | "piece_move"
  | "opponent_move"
  | "check"
  | "checkmate"
  | "mine_explode"
  | "mine_win"
  | "match_start"
  | "time_warning";

export const SOUND_META: Record<SoundKey, string> = {
  opponent_found: "Opponent Found (matchmaking)",
  player_ready:   "Player Ready (lobby)",
  piece_move:     "Piece Move (chess)",
  opponent_move:  "Opponent Move (chess)",
  check:          "Check (chess)",
  checkmate:      "Checkmate (chess)",
  mine_explode:   "Mine Explosion (minesweeper)",
  mine_win:       "Win (minesweeper)",
  match_start:    "Match Start (all games)",
  time_warning:   "1 Minute Warning (timed games)",
};

export type BattleshipSoundKey = "bs_splash" | "bs_explosion" | "bs_sunk" | "bs_place" | "bs_victory" | "bs_defeat";

export const BATTLESHIP_SOUNDS: Record<BattleshipSoundKey, string> = {
  bs_splash:    "/sounds/battleship/splash.mp3",
  bs_explosion: "/sounds/battleship/boom.mp3",
  bs_sunk:      "/sounds/battleship/sunk.mp3",
  bs_place:     "/sounds/battleship/place.mp3",
  bs_victory:   "/sounds/battleship/victory.mp3",
  bs_defeat:    "/sounds/battleship/defeat.mp3",
};

export function playBattleshipSound(key: BattleshipSoundKey): void {
  if (typeof window === "undefined") return;
  const url = BATTLESHIP_SOUNDS[key];
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

export const ALL_SOUND_KEYS = Object.keys(SOUND_META) as SoundKey[];

// ── Module-level singleton cache ──────────────────────────────────────────────
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

export function playSound(key: SoundKey): void {
  if (typeof window === "undefined") return;
  ensureLoaded().then(() => {
    const url = cache[key];
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}
  });
}
