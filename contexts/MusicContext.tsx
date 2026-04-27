"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import {
  playerReducer, initialPlayerState,
  type PlayerState, type PlayerAction, type PlayCommand,
  type YTTrack, type RepeatMode,
} from "@/lib/playerEngine";

// ─── YouTube IFrame API types ─────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (el: string | HTMLElement, opts: YTOpts) => YTPlayer;
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}
interface YTOpts {
  width?: number | string;
  height?: number | string;
  videoId?: string;
  playerVars?: { autoplay?: 0|1; controls?: 0|1; rel?: 0|1; modestbranding?: 0|1; iv_load_policy?: 1|3 };
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
  };
}
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeek: boolean): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(v: number): void;
  getVolume(): number;
  destroy(): void;
}

// Re-export so consumers don't need to import from playerEngine directly
export type { YTTrack, RepeatMode };

// ─── Context shape ────────────────────────────────────────────────────────────
type MusicCtx = {
  activeLobbyId: string | null;
  setActiveLobbyId: (id: string | null) => void;

  // ── YouTube playback state ──────────────────────────────────────────────
  track: YTTrack | null;
  isPlaying: boolean;
  playerState: number;
  positionMs: number;
  playerReady: boolean;
  playerRef: React.MutableRefObject<YTPlayer | null>;

  // ── Queue / playlist state ──────────────────────────────────────────────
  queue: YTTrack[];
  history: YTTrack[];
  activePlId: string | null;
  activePlName: string | null;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  smartShuffle: boolean;
  smartLoading: boolean;

  // ── Playback actions ────────────────────────────────────────────────────
  /**
   * Raw video load — does NOT touch history.
   * Use for lobby sync (non-host receives the host's current track).
   */
  play: (track: YTTrack, posMs?: number) => void;
  /** Play immediately; push current track to history, keep existing queue */
  playNow: (track: YTTrack) => void;
  /** Insert track at the front of the queue */
  playNext: (track: YTTrack) => void;
  /** Append track to the end of the queue */
  addToQueue: (track: YTTrack) => void;
  /** Replace queue with playlist; push current track to history */
  playPlaylist: (pl: { id: string; name: string; tracks: YTTrack[] }) => void;
  /** Advance to next track; handles repeat / smart-shuffle when queue empty */
  next: () => void;
  /** Go back: restart if >10 s in, else restore previous from history */
  prev: () => void;

  // ── Player controls ─────────────────────────────────────────────────────
  pause: () => void;
  resume: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;

  // ── Queue controls ──────────────────────────────────────────────────────
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setSmartShuffle: (enabled: boolean) => void;
  clearQueue: () => void;
};

const MusicContext = createContext<MusicCtx | null>(null);

export function useMusicContext() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusicContext must be inside MusicProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [positionMs, setPositionMs]   = useState(0);
  const [activeLobbyId, setActiveLobbyId] = useState<string | null>(null);
  const [smartLoading, setSmartLoading]   = useState(false);

  // Engine state — the authoritative source for queue / history / playlist
  const [engState, setEngState] = useState<PlayerState>(initialPlayerState);

  // Refs for stale-closure-safe access inside effects / async functions
  const engStateRef     = useRef(engState);
  const playerReadyRef  = useRef(playerReady);
  const smartLoadingRef = useRef(false);

  // Keep refs in sync on every render (no useEffect delay needed for refs)
  engStateRef.current    = engState;
  playerReadyRef.current = playerReady;

  // ── YouTube container (outside React tree to avoid reconciliation issues) ─
  useEffect(() => {
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "fixed", width: "1px", height: "1px",
      bottom: "0", right: "0", opacity: "0", pointerEvents: "none",
    });
    document.body.appendChild(container);

    const initPlayer = () => {
      const p = new window.YT.Player(container, {
        width: "1", height: "1",
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3 },
        events: {
          onReady:       () => setPlayerReady(true),
          onStateChange: (e) => { setPlayerState(e.data); setIsPlaying(e.data === 1); },
        },
      });
      playerRef.current = p;
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id  = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    }

    return () => {
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
      setPlayerReady(false);
      if (document.body.contains(container)) document.body.removeChild(container);
    };
  }, []);

  // Position polling
  useEffect(() => {
    if (!isPlaying || !playerReady) return;
    const t = setInterval(() => {
      if (playerRef.current) {
        try { setPositionMs(Math.floor(playerRef.current.getCurrentTime() * 1000)); } catch {}
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying, playerReady]);

  // Auto-advance when YouTube reports the track ended (playerState === 0)
  useEffect(() => {
    if (playerState !== 0) return;
    dispatch({ type: "NEXT" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState]);

  // ── Command executor ───────────────────────────────────────────────────────
  function execCommand(cmd: PlayCommand | null) {
    if (!cmd) return;
    switch (cmd.type) {
      case "play":
        if (playerRef.current && playerReadyRef.current)
          playerRef.current.loadVideoById(cmd.track.videoId, cmd.posMs / 1000);
        break;
      case "seek":
        if (playerRef.current) {
          playerRef.current.seekTo(cmd.posMs / 1000, true);
          playerRef.current.playVideo();
        }
        break;
      case "smart_next":
        fetchSmartNext(cmd.baseTrack);
        break;
      case "stop":
        playerRef.current?.pauseVideo();
        break;
    }
  }

  // ── Engine dispatcher ──────────────────────────────────────────────────────
  function dispatch(action: PlayerAction) {
    const { state: next, command } = playerReducer(engStateRef.current, action);
    // Update ref immediately so chained dispatches within the same tick see latest state
    engStateRef.current = next;
    setEngState(next);
    execCommand(command);
  }

  // ── Smart shuffle ──────────────────────────────────────────────────────────
  // baseTrack is passed explicitly — by the time this async fn runs,
  // engState.currentTrack may already be null (cleared by the NEXT reducer).
  async function fetchSmartNext(baseTrack: YTTrack) {
    if (smartLoadingRef.current) return;
    smartLoadingRef.current = true;
    setSmartLoading(true);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(`${baseTrack.title} ${baseTrack.channel}`)}`
      );
      if (!res.ok) return;
      const d = await res.json() as { items: YTTrack[] };
      const pool = (d.items ?? []).filter(i => i.videoId !== baseTrack.videoId);
      if (!pool.length) return;
      const picked = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
      dispatch({ type: "PLAY_NOW", track: picked });
    } finally {
      smartLoadingRef.current = false;
      setSmartLoading(false);
    }
  }

  // ── Raw play (lobby sync — no history mutation) ────────────────────────────
  const play = useCallback((t: YTTrack, posMs = 0) => {
    // Only update currentTrack in state, leave history/queue untouched
    setEngState(s => ({ ...s, currentTrack: t }));
    engStateRef.current = { ...engStateRef.current, currentTrack: t };
    if (playerRef.current && playerReadyRef.current)
      playerRef.current.loadVideoById(t.videoId, posMs / 1000);
  }, []);

  const pause     = useCallback(() => playerRef.current?.pauseVideo(),              []);
  const resume    = useCallback(() => playerRef.current?.playVideo(),               []);
  const seek      = useCallback((ms: number) => playerRef.current?.seekTo(ms / 1000, true), []);
  const setVolume = useCallback((v: number)  => playerRef.current?.setVolume(v),   []);

  return (
    <MusicContext.Provider value={{
      activeLobbyId, setActiveLobbyId,

      track:        engState.currentTrack,
      isPlaying, playerState, positionMs, playerReady, playerRef,

      queue:        engState.queue,
      history:      engState.history,
      activePlId:   engState.activePlId,
      activePlName: engState.activePlName,
      isShuffled:   engState.isShuffled,
      repeatMode:   engState.repeatMode,
      smartShuffle: engState.smartShuffle,
      smartLoading,

      play,
      playNow:      (t)  => dispatch({ type: "PLAY_NOW",      track: t }),
      playNext:     (t)  => dispatch({ type: "PLAY_NEXT",     track: t }),
      addToQueue:   (t)  => dispatch({ type: "ADD_TO_QUEUE",  track: t }),
      playPlaylist: (pl) => dispatch({ type: "PLAY_PLAYLIST", ...pl }),
      next:         ()   => dispatch({ type: "NEXT" }),
      prev: () => {
        // Read live position from player so we don't rely on stale state
        const ms = playerRef.current
          ? Math.floor(playerRef.current.getCurrentTime() * 1000)
          : positionMs;
        dispatch({ type: "PREV", positionMs: ms });
      },

      pause, resume, seek, setVolume,

      toggleShuffle:   () => dispatch({ type: "TOGGLE_SHUFFLE" }),
      setRepeatMode:   (m) => dispatch({ type: "SET_REPEAT", mode: m }),
      setSmartShuffle: (e) => dispatch({ type: "SET_SMART_SHUFFLE", enabled: e }),
      clearQueue:      () => dispatch({ type: "CLEAR" }),
    }}>
      {children}
    </MusicContext.Provider>
  );
}
