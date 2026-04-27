/**
 * playerEngine.ts — Pure, framework-agnostic player state machine.
 *
 * No React, no YouTube, no side effects. Every function takes the current
 * state + an action and returns { state, command } where:
 *   state   = next immutable PlayerState
 *   command = what the YouTube player (or network) should do next (nullable)
 *
 * This makes the entire queue/history/repeat/shuffle logic trivially testable.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type RepeatMode = "none" | "one" | "all";

export interface YTTrack {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export interface PlayerState {
  currentTrack: YTTrack | null;
  /** Upcoming tracks — index 0 plays next */
  queue: YTTrack[];
  /** Played tracks — last element is the most recent */
  history: YTTrack[];
  activePlId: string | null;
  activePlName: string | null;
  /** True when the queue has been Fisher-Yates shuffled */
  isShuffled: boolean;
  /** Snapshot of queue before shuffle so we can restore original order */
  originalQueue: YTTrack[];
  repeatMode: RepeatMode;
  /** When true and queue empties, context auto-fetches a similar track */
  smartShuffle: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type PlayerAction =
  /** Play immediately; push current track to history, keep existing queue */
  | { type: "PLAY_NOW"; track: YTTrack; posMs?: number }
  /** Insert track at the front of the queue (plays after current) */
  | { type: "PLAY_NEXT"; track: YTTrack }
  /** Append track to the end of the queue */
  | { type: "ADD_TO_QUEUE"; track: YTTrack }
  /** Replace queue with playlist tracks; push current track to history */
  | { type: "PLAY_PLAYLIST"; id: string; name: string; tracks: YTTrack[] }
  /** Advance to next track; handles repeat / smart-shuffle when queue empty */
  | { type: "NEXT" }
  /**
   * Go back:
   *   positionMs > 10 000  →  restart current track
   *   positionMs ≤ 10 000  →  go to previous track from history (or restart)
   */
  | { type: "PREV"; positionMs: number }
  /** Toggle Fisher-Yates shuffle on the remaining queue */
  | { type: "TOGGLE_SHUFFLE" }
  | { type: "SET_REPEAT"; mode: RepeatMode }
  | { type: "SET_SMART_SHUFFLE"; enabled: boolean }
  /** Reset everything (e.g. leaving a lobby, clearing the player) */
  | { type: "CLEAR" };

// ─── Side-effect commands ─────────────────────────────────────────────────────

/** Tells the context what the YouTube player (or network) should do. */
export type PlayCommand =
  | { type: "play"; track: YTTrack; posMs: number }
  /** Seek within the current track (usually restart from 0) */
  | { type: "seek"; posMs: number }
  /** Ask the context to fetch & play a smart-shuffle track based on this track */
  | { type: "smart_next"; baseTrack: YTTrack }
  /** Nothing left to play — stop the player */
  | { type: "stop" };

export interface ReducerResult {
  state: PlayerState;
  /** Null = no YouTube side-effect required */
  command: PlayCommand | null;
}

// ─── Initial state ────────────────────────────────────────────────────────────

export const initialPlayerState: PlayerState = {
  currentTrack: null,
  queue: [],
  history: [],
  activePlId: null,
  activePlName: null,
  isShuffled: false,
  originalQueue: [],
  repeatMode: "none",
  smartShuffle: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Pure reducer ─────────────────────────────────────────────────────────────

/**
 * Core state machine. Deterministic + side-effect-free — safe to call in tests
 * or server-side. All YouTube/network side effects are expressed as `command`.
 */
export function playerReducer(s: PlayerState, action: PlayerAction): ReducerResult {
  switch (action.type) {

    // ── PLAY_NOW ────────────────────────────────────────────────────────────
    case "PLAY_NOW": {
      // Save current track to history before replacing it; keep the queue intact
      // so a playlist continues after a one-off track inserted via PLAY_NOW.
      const history = s.currentTrack ? [...s.history, s.currentTrack] : s.history;
      return {
        state: { ...s, currentTrack: action.track, history },
        command: { type: "play", track: action.track, posMs: action.posMs ?? 0 },
      };
    }

    // ── PLAY_NEXT ───────────────────────────────────────────────────────────
    case "PLAY_NEXT":
      return { state: { ...s, queue: [action.track, ...s.queue] }, command: null };

    // ── ADD_TO_QUEUE ────────────────────────────────────────────────────────
    case "ADD_TO_QUEUE":
      return { state: { ...s, queue: [...s.queue, action.track] }, command: null };

    // ── PLAY_PLAYLIST ───────────────────────────────────────────────────────
    case "PLAY_PLAYLIST": {
      if (!action.tracks.length) return { state: s, command: null };
      const [first, ...rest] = action.tracks;
      const history = s.currentTrack ? [...s.history, s.currentTrack] : s.history;
      return {
        state: {
          ...s,
          currentTrack: first,
          queue: rest,
          history,
          activePlId: action.id,
          activePlName: action.name,
          isShuffled: false,
          originalQueue: [],
        },
        command: { type: "play", track: first, posMs: 0 },
      };
    }

    // ── NEXT ────────────────────────────────────────────────────────────────
    case "NEXT": {
      const history = s.currentTrack ? [...s.history, s.currentTrack] : s.history;

      // Repeat one: restart the current track
      if (s.repeatMode === "one" && s.currentTrack) {
        return { state: s, command: { type: "seek", posMs: 0 } };
      }

      // Normal advance: pop from queue
      if (s.queue.length > 0) {
        const [next, ...remaining] = s.queue;
        return {
          state: { ...s, currentTrack: next, queue: remaining, history },
          command: { type: "play", track: next, posMs: 0 },
        };
      }

      // Queue empty: repeat-all reloads the full history as the next queue
      if (s.repeatMode === "all" && history.length > 0) {
        const [first, ...rest] = history;
        return {
          state: { ...s, currentTrack: first, queue: rest, history: [] },
          command: { type: "play", track: first, posMs: 0 },
        };
      }

      // Queue empty + smart shuffle: signal context to fetch next
      if (s.smartShuffle && s.currentTrack) {
        // Keep currentTrack in state (non-null) so the UI shows what's "loading next".
        // Pass the track explicitly in the command — by the time fetchSmartNext runs,
        // engStateRef might have been updated by another action.
        return {
          state: { ...s, currentTrack: null, history, activePlId: null, activePlName: null },
          command: { type: "smart_next", baseTrack: s.currentTrack },
        };
      }

      // Nothing left
      return {
        state: { ...s, currentTrack: null, history, activePlId: null, activePlName: null },
        command: { type: "stop" },
      };
    }

    // ── PREV ────────────────────────────────────────────────────────────────
    case "PREV": {
      // More than 10 s in, or no history → restart current track from 0
      if (action.positionMs > 10_000 || s.history.length === 0) {
        return { state: s, command: { type: "seek", posMs: 0 } };
      }
      // Push current track back to the front of the queue, restore previous
      const prevTrack = s.history[s.history.length - 1];
      const newHistory = s.history.slice(0, -1);
      const queue = s.currentTrack ? [s.currentTrack, ...s.queue] : s.queue;
      return {
        state: { ...s, currentTrack: prevTrack, queue, history: newHistory },
        command: { type: "play", track: prevTrack, posMs: 0 },
      };
    }

    // ── TOGGLE_SHUFFLE ──────────────────────────────────────────────────────
    case "TOGGLE_SHUFFLE": {
      if (!s.isShuffled) {
        // Shuffle remaining queue; keep current track playing
        return {
          state: { ...s, queue: fisherYates(s.queue), originalQueue: s.queue, isShuffled: true },
          command: null,
        };
      }
      // Restore: find current track in original order, continue from there
      const idx = s.originalQueue.findIndex(t => t.videoId === s.currentTrack?.videoId);
      const restored = idx >= 0 ? s.originalQueue.slice(idx + 1) : s.originalQueue;
      return {
        state: { ...s, queue: restored, originalQueue: [], isShuffled: false },
        command: null,
      };
    }

    case "SET_REPEAT":
      return { state: { ...s, repeatMode: action.mode }, command: null };

    case "SET_SMART_SHUFFLE":
      return { state: { ...s, smartShuffle: action.enabled }, command: null };

    case "CLEAR":
      return { state: initialPlayerState, command: null };

    default:
      return { state: s, command: null };
  }
}
