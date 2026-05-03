"use client";

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState,
} from "react";
import { useTranslations } from "next-intl";
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, X, Subtitles, Settings,
} from "lucide-react";

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
  setPlaybackQuality(quality: string): void;
  getAvailableQualityLevels(): string[];
  getPlaybackQuality(): string;
  setPlaybackRate(rate: number): void;
  loadModule(moduleName: string): void;
  unloadModule(moduleName: string): void;
  setOption(module: string, option: string, value: unknown): void;
}

export interface YouTubePlayerHandle {
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
}

export interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  startSeconds?: number;
  /** When true the video is always muted — audio comes from an external source. */
  muted?: boolean;
  /** Controlled play state driven by parent. */
  externalPlaying?: boolean;
  /** Ad mode: hides all controls except mute and close; disables click-to-pause. */
  adMode?: boolean;
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

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const QUALITY_LABELS: Record<string, string> = {
  tiny: "144p", small: "240p", medium: "360p", large: "480p",
  hd720: "720p", hd1080: "1080p", hd1440: "1440p", hd2160: "4K",
  highres: "4K+", default: "Auto", auto: "Auto",
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    {
      videoId,
      title,
      startSeconds = 0,
      muted = false,
      externalPlaying,
      adMode = false,
      onSeek,
      onPlayPause,
      onEnded,
      onClose,
      className = "",
    },
    ref,
  ) {
    const t = useTranslations("youtubePlayer");

    const mountRef   = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const ytRef      = useRef<VPlayer | null>(null);
    const readyRef   = useRef(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hideRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [playing, setPlaying]       = useState(false);
    const [buffering, setBuffering]   = useState(false);
    const [currentSec, setCurrent]    = useState(startSeconds);
    const [durationSec, setDur]       = useState(0);
    const [volume, setVol]            = useState(80);
    const [volMuted, setVolMuted]     = useState(false);
    const [isFullscreen, setFs]       = useState(false);
    const [showCtrl, setShowCtrl]     = useState(true);
    const [speed, setSpeed]           = useState(1);
    const [quality, setQuality]       = useState("auto");
    const [availQualities, setAvailQ] = useState<string[]>([]);
    const [captionsOn, setCaptions]   = useState(false);
    const [menu, setMenu]             = useState<"speed" | "quality" | null>(null);

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      seekTo(s)        { ytRef.current?.seekTo(s, true); setCurrent(s); },
      play()           { ytRef.current?.playVideo();  setPlaying(true);  },
      pause()          { ytRef.current?.pauseVideo(); setPlaying(false); },
      getCurrentTime() { return ytRef.current?.getCurrentTime?.() ?? 0; },
      getDuration()    { return ytRef.current?.getDuration?.() ?? 0; },
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

      function syncQualities() {
        const qs = ytRef.current?.getAvailableQualityLevels?.() ?? [];
        if (qs.length) setAvailQ(qs);
        const cur = ytRef.current?.getPlaybackQuality?.() ?? "auto";
        setQuality(cur);
      }

      function init() {
        if (dead || !mountRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const YTCtor = (window as any).YT.Player as new (el: HTMLElement, opts: object) => VPlayer;
        ytRef.current = new YTCtor(mountRef.current, {
          videoId,
          playerVars: {
            autoplay: 1, controls: 0, disablekb: 1, rel: 0,
            modestbranding: 1, iv_load_policy: 3, showinfo: 0,
            start: Math.floor(startSeconds), mute: 1, cc_load_policy: 0,
            fs: 0, // we use our own fullscreen
          },
          events: {
            onReady(e: { target: VPlayer }) {
              if (dead) return;
              readyRef.current = true;
              setDur(e.target.getDuration());
              if (muted) { e.target.mute(); }
              else { e.target.unMute(); e.target.setVolume(volume); }
              e.target.playVideo();
              syncQualities();
            },
            onStateChange(e: { data: number }) {
              if (dead) return;
              const st = e.data;
              setBuffering(st === 3);
              if (st === 1) { setPlaying(true);  startPoll(); syncQualities(); }
              if (st === 2 || st === 0) { setPlaying(false); stopPoll(); }
              if (st === 0) onEnded?.();
              if (ytRef.current) setDur(ytRef.current.getDuration());
            },
            onPlaybackQualityChange(e: { data: string }) {
              if (!dead) setQuality(e.data);
            },
          },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ytWin = () => (window as any).YT?.Player;
      if (ytWin()) {
        init();
      } else {
        const interval = setInterval(() => { if (ytWin()) { clearInterval(interval); init(); } }, 50);
        return () => clearInterval(interval);
      }
      return () => {
        dead = true;
        readyRef.current = false;
        stopPoll();
        ytRef.current?.destroy();
        ytRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    // ── Controlled play/pause from parent ─────────────────────────────────────
    useEffect(() => {
      if (externalPlaying === undefined || !ytRef.current || !readyRef.current) return;
      if (externalPlaying) ytRef.current.playVideo();
      else ytRef.current.pauseVideo();
    }, [externalPlaying]);

    // ── Fullscreen detection ──────────────────────────────────────────────────
    useEffect(() => {
      const fn = () => setFs(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", fn);
      return () => document.removeEventListener("fullscreenchange", fn);
    }, []);

    // ── Spacebar → play/pause ─────────────────────────────────────────────────
    const togglePlayRef = useRef<() => void>(() => {});
    useEffect(() => {
      togglePlayRef.current = () => {
        if (!ytRef.current) return;
        setMenu(null);
        const next = !playing;
        if (next) ytRef.current.playVideo(); else ytRef.current.pauseVideo();
        setPlaying(next);
        onPlayPause?.(next);
      };
    });
    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if (e.code !== "Space") return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        togglePlayRef.current();
      }
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
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
      setMenu(null);
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
      setVol(v); setVolMuted(v === 0);
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

    function changeSpeed(s: number) {
      ytRef.current?.setPlaybackRate(s);
      setSpeed(s);
      setMenu(null);
    }

    function changeQuality(q: string) {
      ytRef.current?.setPlaybackQuality(q);
      setQuality(q);
      setMenu(null);
    }

    function toggleCaptions() {
      if (!ytRef.current) return;
      if (captionsOn) {
        try { ytRef.current.unloadModule("captions"); } catch { /* ignore */ }
        setCaptions(false);
      } else {
        try {
          ytRef.current.loadModule("captions");
          ytRef.current.setOption("captions", "track", { languageCode: "" });
        } catch { /* ignore */ }
        setCaptions(true);
      }
    }

    const pct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;
    const ctrlVisible = showCtrl || !playing;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div
        ref={wrapperRef}
        className={`relative bg-black select-none overflow-hidden ${className}`}
        style={{ aspectRatio: "16/9" }}
        onMouseMove={adMode ? undefined : bumpCtrl}
        onMouseLeave={adMode ? undefined : () => { if (playing) setShowCtrl(false); setMenu(null); }}
        onClick={adMode ? undefined : togglePlay}
      >
        {/* YT iframe mount */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Buffering ring */}
        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-10 h-10 rounded-full border-[2.5px] border-pink-500/20 border-t-pink-500 animate-spin" />
          </div>
        )}

        {/* ── Ad mode: minimal overlay (mute + close only) ── */}
        {adMode && (
          <div className="absolute inset-0 flex flex-col z-20 pointer-events-none">
            <div
              className="flex items-center justify-end px-2 py-1.5 pointer-events-auto"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            >
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label={t("close")}
                  className="p-1 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex-1" />
            <div
              className="flex items-center px-2.5 py-2 pointer-events-auto"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            >
              <button
                onClick={toggleMute}
                aria-label={volMuted ? t("unmute") : t("mute")}
                className="p-1 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
              >
                {volMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* ── Full controls overlay (normal mode) ── */}
        {!adMode && (
          <div
            className={[
              "absolute inset-0 flex flex-col z-20 transition-opacity duration-200",
              ctrlVisible ? "opacity-100" : "opacity-0 pointer-events-none",
            ].join(" ")}
          >
            {/* Top bar */}
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 shrink-0"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,2,0.82) 0%, transparent 100%)" }}
              onClick={e => e.stopPropagation()}
            >
              {title && (
                <span className="flex-1 min-w-0 truncate text-[0.65rem] font-semibold text-white/80 leading-none">
                  {title}
                </span>
              )}
              {!title && <div className="flex-1" />}
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label={t("close")}
                  className="p-1 rounded-lg bg-black/50 text-pink-300/80 hover:text-pink-200 hover:bg-pink-500/20 transition-all shrink-0"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Middle click zone */}
            <div
              className="flex-1 flex items-center justify-center cursor-pointer group"
              onClick={e => { e.stopPropagation(); togglePlay(); }}
            >
              <div
                className={[
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 pointer-events-none",
                  "bg-black/40 backdrop-blur-sm border border-pink-500/30 text-pink-400",
                  "group-hover:bg-pink-500/15 group-hover:scale-110 group-hover:border-pink-400/60",
                  playing && !showCtrl ? "opacity-0" : "opacity-100",
                ].join(" ")}
              >
                {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </div>
            </div>

            {/* Bottom bar */}
            <div
              className="px-3 pt-8 pb-2.5 flex flex-col gap-2 shrink-0"
              style={{ background: "linear-gradient(to top, rgba(2,0,6,0.97) 0%, rgba(2,0,6,0.55) 65%, transparent 100%)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Seek bar */}
              <div
                className="group/s relative h-[3px] rounded-full cursor-pointer"
                style={{ background: "rgba(255,255,255,0.12)" }}
                onClick={handleSeek}
              >
                <div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(to right, #be185d, #ec4899, #f472b6)",
                    boxShadow: "0 0 6px rgba(236,72,153,0.5)",
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full -translate-x-1/2 opacity-0 group-hover/s:opacity-100 transition-opacity shadow-lg"
                  style={{ left: `${pct}%`, background: "#f9a8d4", boxShadow: "0 0 8px rgba(249,168,212,0.8)" }}
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} aria-label={playing ? t("pause") : t("play")} className="text-pink-300 hover:text-pink-100 transition-colors shrink-0">
                  {playing ? <Pause size={13} /> : <Play size={13} className="ml-px" />}
                </button>
                <span className="text-[0.58rem] font-mono tabular-nums shrink-0" style={{ color: "rgba(249,168,212,0.7)" }}>
                  {fmt(currentSec)}<span style={{ color: "rgba(249,168,212,0.35)" }}> / {fmt(durationSec)}</span>
                </span>
                <div className="flex-1" />

                {/* Speed */}
                <div className="relative shrink-0">
                  {menu === "speed" && (
                    <div className="absolute bottom-full mb-2 right-0 bg-black/95 border border-pink-500/25 rounded-lg overflow-hidden shadow-xl z-30">
                      {[...SPEEDS].reverse().map(s => (
                        <button key={s} onClick={() => changeSpeed(s)}
                          className={["w-full px-3 py-1.5 text-[0.65rem] font-mono text-right hover:bg-pink-500/15 transition-colors whitespace-nowrap",
                            speed === s ? "text-pink-400 font-bold bg-pink-500/10" : "text-pink-200/70"].join(" ")}>
                          {s === 1 ? t("normal") : `${s}×`}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setMenu(m => m === "speed" ? null : "speed")} aria-label={t("speed")}
                    className="text-pink-300 hover:text-pink-100 transition-colors font-mono text-[0.6rem] font-bold leading-none">
                    {speed === 1 ? "1×" : `${speed}×`}
                  </button>
                </div>

                {/* Quality */}
                {availQualities.length > 0 && (
                  <div className="relative shrink-0">
                    {menu === "quality" && (
                      <div className="absolute bottom-full mb-2 right-0 bg-black/95 border border-pink-500/25 rounded-lg overflow-hidden shadow-xl z-30">
                        {availQualities.map(q => (
                          <button key={q} onClick={() => changeQuality(q)}
                            className={["w-full px-3 py-1.5 text-[0.65rem] text-right hover:bg-pink-500/15 transition-colors whitespace-nowrap",
                              quality === q ? "text-pink-400 font-bold bg-pink-500/10" : "text-pink-200/70"].join(" ")}>
                            {QUALITY_LABELS[q] ?? q}
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setMenu(m => m === "quality" ? null : "quality")} aria-label={t("quality")}
                      className="text-pink-300 hover:text-pink-100 transition-colors">
                      <Settings size={11} />
                    </button>
                  </div>
                )}

                {/* Subtitles */}
                <button onClick={toggleCaptions} aria-label={t("subtitles")}
                  className={["transition-colors shrink-0", captionsOn ? "text-pink-400" : "text-pink-300/50 hover:text-pink-300"].join(" ")}>
                  <Subtitles size={11} />
                </button>

                {/* Volume */}
                {!muted && (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={toggleMute} aria-label={volMuted ? t("unmute") : t("mute")}
                      className="text-pink-300 hover:text-pink-100 transition-colors shrink-0">
                      {volMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                    </button>
                    <div className="relative w-14 h-1 rounded-full cursor-pointer" style={{ background: "rgba(255,255,255,0.12)" }}>
                      <div className="absolute left-0 top-0 h-full rounded-full"
                        style={{ width: `${volMuted ? 0 : volume}%`, background: "linear-gradient(to right, #be185d, #ec4899)" }} />
                      <input type="range" min={0} max={100} value={volMuted ? 0 : volume}
                        onChange={e => handleVolume(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                )}

                {/* Fullscreen */}
                <button onClick={toggleFs} aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
                  className="text-pink-300 hover:text-pink-100 transition-colors shrink-0">
                  {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default YouTubePlayer;
