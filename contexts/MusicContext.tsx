"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";

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
  events?: { onReady?: (e: { target: YTPlayer }) => void; onStateChange?: (e: { data: number; target: YTPlayer }) => void };
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

// ─── Types ────────────────────────────────────────────────────────────────────
export type YTTrack = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
};

type MusicCtx = {
  activeLobbyId: string | null;
  setActiveLobbyId: (id: string | null) => void;
  track: YTTrack | null;
  isPlaying: boolean;
  playerState: number;
  positionMs: number;
  playerReady: boolean;
  play: (track: YTTrack, positionMs?: number) => void;
  pause: () => void;
  resume: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  next: () => void;
  prev: () => void;
  playerRef: React.MutableRefObject<YTPlayer | null>;
};

const MusicContext = createContext<MusicCtx | null>(null);

export function useMusicContext() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusicContext must be inside MusicProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const playerRef   = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [track, setTrack]             = useState<YTTrack | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [positionMs, setPositionMs]   = useState(0);
  const [activeLobbyId, setActiveLobbyId] = useState<string | null>(null);

  // Update position every second while playing
  useEffect(() => {
    if (!isPlaying || !playerReady) return;
    const t = setInterval(() => {
      if (playerRef.current) {
        setPositionMs(Math.floor(playerRef.current.getCurrentTime() * 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying, playerReady]);

  // Load YouTube IFrame API
  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;
      const p = new window.YT.Player(containerRef.current, {
        width: "1", height: "1",
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (e) => {
            setPlayerState(e.data);
            setIsPlaying(e.data === 1);
          },
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
      playerRef.current?.destroy();
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, []);

  const play = useCallback((t: YTTrack, posMs = 0) => {
    setTrack(t);
    if (playerRef.current && playerReady) {
      playerRef.current.loadVideoById(t.videoId, posMs / 1000);
    }
  }, [playerReady]);

  const pause  = useCallback(() => playerRef.current?.pauseVideo(),  []);
  const resume = useCallback(() => playerRef.current?.playVideo(),   []);
  const seek   = useCallback((ms: number) => playerRef.current?.seekTo(ms / 1000, true), []);
  const setVolume = useCallback((v: number) => playerRef.current?.setVolume(v), []);
  const next   = useCallback(() => {}, []); // YouTube doesn't have native next/prev
  const prev   = useCallback(() => { playerRef.current?.seekTo(0, true); }, []);

  return (
    <MusicContext.Provider value={{
      activeLobbyId, setActiveLobbyId,
      track, isPlaying, playerState, positionMs, playerReady,
      play, pause, resume, seek, setVolume, next, prev,
      playerRef,
    }}>
      {/* Hidden persistent YouTube player */}
      <div
        ref={containerRef}
        style={{ position: "fixed", width: 1, height: 1, bottom: 0, right: 0, opacity: 0, pointerEvents: "none" }}
      />
      {children}
    </MusicContext.Provider>
  );
}
