"use client";

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState,
} from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, X } from "lucide-react";

// ── Local player interface (window.YT is declared globally by MusicContext) ──
// We use a local name to avoid conflicting with MusicContext's global declaration.
interface VPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getDuration(): number;
  getCurrentTime(): number;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  destroy(): void;
}

// ── Public handle for imperative control ──────────────────────────────────────
export interface YouTubePlayerHandle {
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  /** When true the video is always muted — audio comes from an external source. */
  muted?: boolean;
  /** Controlled play state driven by parent. */
  externalPlaying?: boolean;
  onSeek?: (seconds: number) => void;
  onPlayPause?: (playing: boolean) => void;
  onEnded?: () => void;
  onClose?: () => void;
  className?: string;
}

function fmt(sec: number) {
  const s = Math.floor(Math.max(0, sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    {
      videoId,
      startSeconds = 0,
      muted = false,
      externalPlaying,
      onSeek,
      onPlayPause,
      onEnded,
      onClose,
      className = "",
    },
    ref,
  ) {
    const mountRef  = useRef<HTMLDivElement>(null); // div that YT replaces with iframe
    const wrapperRef = useRef<HTMLDivElement>(null);
    const ytRef     = useRef<VPlayer | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hideRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [playing, setPlaying]     = useState(false);
    const [buffering, setBuffering] = useState(false);
    const [currentSec, setCurrent]  = useState(startSeconds);
    const [durationSec, setDur]     = useState(0);
    const [volume, setVol]          = useState(80);
    const [volMuted, setVolMuted]   = useState(false);
    const [isFullscreen, setFs]     = useState(false);
    const [showCtrl, setShowCtrl]   = useState(true);

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      seekTo(s) { ytRef.current?.seekTo(s, true); setCurrent(s); },
      play()    { ytRef.current?.playVideo();  setPlaying(true);  },
      pause()   { ytRef.current?.pauseVideo(); setPlaying(false); },
    }));

    // ── Polling ───────────────────────────────────────────────────────────────
    function startPoll() {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(() => {
        const ct = ytRef.current?.getCurrentTime?.();
        if (ct !== undefined) setCurrent(ct);
      }, 250);
    }
    function stopPoll() {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }

    // ── Init player ───────────────────────────────────────────────────────────
    useEffect(() => {
      let dead = false;

      function init() {
        if (dead || !mountRef.current) return;
        // Use a local cast so MusicContext's narrower global YT type doesn't conflict
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const YTCtor = (window as any).YT.Player as new (el: HTMLElement, opts: object) => VPlayer;
        ytRef.current = new YTCtor(mountRef.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            start: Math.floor(startSeconds),
            mute: 1,
          },
          events: {
            onReady(e: { target: VPlayer }) {
              if (dead) return;
              setDur(e.target.getDuration());
              if (muted) {
                e.target.mute();
              } else {
                e.target.unMute();
                e.target.setVolume(volume);
              }
              e.target.playVideo();
            },
            onStateChange(e: { data: number }) {
              if (dead) return;
              const st = e.data;
              setBuffering(st === 3);
              if (st === 1) { setPlaying(true);  startPoll(); }
              if (st === 2 || st === 0) { setPlaying(false); stopPoll(); }
              if (st === 0) onEnded?.();
              if (ytRef.current) setDur(ytRef.current.getDuration());
            },
          },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ytWin = () => (window as any).YT?.Player;
      if (ytWin()) {
        init();
      } else {
        const t = setInterval(() => { if (ytWin()) { clearInterval(t); init(); } }, 50);
        return () => clearInterval(t);
      }

      return () => {
        dead = true;
        stopPoll();
        ytRef.current?.destroy();
        ytRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    // ── Controlled play/pause from parent ────────────────────────────────────
    useEffect(() => {
      if (externalPlaying === undefined || !ytRef.current) return;
      if (externalPlaying) ytRef.current.playVideo();
      else ytRef.current.pauseVideo();
    }, [externalPlaying]);

    // ── Fullscreen detection ──────────────────────────────────────────────────
    useEffect(() => {
      const fn = () => setFs(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", fn);
      return () => document.removeEventListener("fullscreenchange", fn);
    }, []);

    // ── Auto-hide controls ────────────────────────────────────────────────────
    const bumpCtrl = useCallback(() => {
      setShowCtrl(true);
      if (hideRef.current) clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => setShowCtrl(false), 3000);
    }, []);

    useEffect(() => {
      bumpCtrl();
      return () => { if (hideRef.current) clearTimeout(hideRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Handlers ──────────────────────────────────────────────────────────────
    function togglePlay() {
      if (!ytRef.current) return;
      const next = !playing;
      if (next) ytRef.current.playVideo(); else ytRef.current.pauseVideo();
      setPlaying(next);
      onPlayPause?.(next);
    }

    function toggleMute() {
      if (!ytRef.current || muted) return;
      if (volMuted) { ytRef.current.unMute(); ytRef.current.setVolume(volume); setVolMuted(false); }
      else          { ytRef.current.mute();   setVolMuted(true); }
    }

    function handleVolume(v: number) {
      setVol(v);
      setVolMuted(v === 0);
      ytRef.current?.setVolume(v);
      if (v > 0) ytRef.current?.unMute();
    }

    function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
      e.stopPropagation();
      if (!durationSec) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sec  = Math.max(0, Math.min(durationSec, ((e.clientX - rect.left) / rect.width) * durationSec));
      ytRef.current?.seekTo(sec, true);
      setCurrent(sec);
      onSeek?.(sec);
    }

    function toggleFs() {
      const el = wrapperRef.current;
      if (!el) return;
      if (!document.fullscreenElement) el.requestFullscreen?.();
      else document.exitFullscreen?.();
    }

    const pct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;
    const ctrlVisible = showCtrl || !playing;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div
        ref={wrapperRef}
        className={`relative bg-black select-none overflow-hidden ${className}`}
        style={{ aspectRatio: "16/9" }}
        onMouseMove={bumpCtrl}
        onMouseLeave={() => playing && setShowCtrl(false)}
        onClick={togglePlay}
      >
        {/* YT iframe mount — YT replaces this div with an <iframe> */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Buffering ring */}
        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-10 h-10 rounded-full border-[2.5px] border-pink-500/20 border-t-pink-500 animate-spin" />
          </div>
        )}

        {/* Controls overlay */}
        <div
          className={[
            "absolute inset-0 flex flex-col justify-between z-20 transition-opacity duration-200",
            ctrlVisible ? "opacity-100" : "opacity-0 pointer-events-none",
          ].join(" ")}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Top bar ── */}
          <div
            className="flex items-center justify-end p-1.5 gap-1"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,2,0.75) 0%, transparent 100%)" }}
          >
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg bg-black/50 text-pink-300/80 hover:text-pink-200 hover:bg-pink-500/20 transition-all"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* ── Center play button ── */}
          <div className="flex items-center justify-center pointer-events-none">
            <div
              className={[
                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 pointer-events-auto",
                "bg-black/40 backdrop-blur-sm border border-pink-500/30 text-pink-400",
                "hover:bg-pink-500/15 hover:scale-110 hover:border-pink-400/60",
                // hide when playing and controls are fading out
                playing && !showCtrl ? "opacity-0" : "opacity-100",
              ].join(" ")}
              onClick={togglePlay}
            >
              {playing
                ? <Pause  size={18} />
                : <Play   size={18} className="ml-0.5" />}
            </div>
          </div>

          {/* ── Bottom bar ── */}
          <div
            className="px-3 pt-8 pb-2.5 flex flex-col gap-2"
            style={{ background: "linear-gradient(to top, rgba(2,0,6,0.97) 0%, rgba(2,0,6,0.55) 65%, transparent 100%)" }}
          >
            {/* Seek bar */}
            <div
              className="group/s relative h-[3px] rounded-full cursor-pointer"
              style={{ background: "rgba(255,255,255,0.12)" }}
              onClick={handleSeek}
            >
              {/* Filled portion */}
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(to right, #be185d, #ec4899, #f472b6)",
                  boxShadow: "0 0 6px rgba(236,72,153,0.5)",
                }}
              />
              {/* Handle dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full -translate-x-1/2 opacity-0 group-hover/s:opacity-100 transition-opacity shadow-lg"
                style={{
                  left: `${pct}%`,
                  background: "#f9a8d4",
                  boxShadow: "0 0 8px rgba(249,168,212,0.8)",
                }}
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2.5">
              {/* Play/pause */}
              <button
                onClick={togglePlay}
                className="text-pink-300 hover:text-pink-100 transition-colors shrink-0"
              >
                {playing ? <Pause size={13} /> : <Play size={13} className="ml-px" />}
              </button>

              {/* Time */}
              <span className="text-[0.58rem] font-mono tabular-nums shrink-0" style={{ color: "rgba(249,168,212,0.7)" }}>
                {fmt(currentSec)}
                <span style={{ color: "rgba(249,168,212,0.35)" }}> / {fmt(durationSec)}</span>
              </span>

              <div className="flex-1" />

              {/* Volume (only when not externally muted) */}
              {!muted && (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <button onClick={toggleMute} className="text-pink-300 hover:text-pink-100 transition-colors shrink-0">
                    {volMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                  <div className="relative w-14 h-1 rounded-full cursor-pointer" style={{ background: "rgba(255,255,255,0.12)" }}>
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{ width: `${volMuted ? 0 : volume}%`, background: "linear-gradient(to right, #be185d, #ec4899)" }}
                    />
                    <input
                      type="range" min={0} max={100} value={volMuted ? 0 : volume}
                      onChange={e => handleVolume(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Fullscreen */}
              <button
                onClick={e => { e.stopPropagation(); toggleFs(); }}
                className="text-pink-300 hover:text-pink-100 transition-colors shrink-0"
              >
                {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default YouTubePlayer;
