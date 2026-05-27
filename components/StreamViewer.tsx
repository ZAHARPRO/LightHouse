"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room, RoomEvent, RemoteTrack, RemoteTrackPublication,
  Track, RemoteParticipant, VideoQuality,
} from "livekit-client";
import {
  Monitor, Wifi, WifiOff, Loader2,
  Volume2, VolumeX, Volume1,
  Maximize, Minimize, Settings, Radio,
} from "lucide-react";
import Link from "next/link";

type Status = "connecting" | "live" | "offline" | "ended" | "error";
type Quality = "low" | "medium" | "high";

const QUALITY_LK: Record<Quality, VideoQuality> = {
  low: VideoQuality.LOW,
  medium: VideoQuality.MEDIUM,
  high: VideoQuality.HIGH,
};

const QUALITY_LABEL: Record<Quality, string> = {
  low:    "360p",
  medium: "720p",
  high:   "1080p",
};

interface Props {
  streamId: string;
}

export default function StreamViewer({ streamId }: Props) {
  const roomRef      = useRef<Room | null>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  // One <audio> element per remote audio track — avoids both the "second track.attach()
  // replaces the first" issue AND the LiveKit adaptive-stream problem where the SDK
  // stops forwarding audio to tracks that never had attach() called on them.
  const audioElsRef  = useRef<Map<string, HTMLAudioElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const activePubRef = useRef<RemoteTrackPublication | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutedRef  = useRef(false);
  const volumeRef = useRef(1);

  const [status,       setStatus]     = useState<Status>("connecting");
  const [error,        setError]      = useState<string | null>(null);
  const [muted,        setMuted]      = useState(false);
  const [volume,       setVolume]     = useState(1);
  const [prevVolume,   setPrevVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality,      setQuality]    = useState<Quality>("high");
  const [showQuality,  setShowQuality]    = useState(false);
  const [showControls, setShowControls]   = useState(true);
  const [reconnecting, setReconnecting]   = useState(false);
  const [hasFinePointer, setHasFinePointer] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setHasFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHasFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Keep refs in sync so attachTrack (useCallback) can read current values without stale closures
  useEffect(() => { mutedRef.current  = muted;  }, [muted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // Sync mute/volume → all active audio elements.
  // Video element stays muted (it carries video track only).
  useEffect(() => {
    audioElsRef.current.forEach(el => {
      el.muted  = muted;
      el.volume = volume;
    });
  }, [muted, volume]);

  // Tear down all audio elements on unmount
  useEffect(() => {
    return () => {
      audioElsRef.current.forEach(el => { el.srcObject = null; el.remove(); });
      audioElsRef.current.clear();
    };
  }, []);

  // Fullscreen detection — standard + webkit (iOS)
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(
        !!document.fullscreenElement ||
        !!(document as unknown as Record<string, unknown>).webkitFullscreenElement
      );
    }
    function onVideoFsChange() {
      const vid = videoRef.current as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null;
      setIsFullscreen(!!vid?.webkitDisplayingFullscreen);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    videoRef.current?.addEventListener("webkitbeginfullscreen", onVideoFsChange);
    videoRef.current?.addEventListener("webkitendfullscreen", onVideoFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      videoRef.current?.removeEventListener("webkitbeginfullscreen", onVideoFsChange);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      videoRef.current?.removeEventListener("webkitendfullscreen", onVideoFsChange);
    };
  }, []);

  useEffect(() => {
    if (!hasFinePointer) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyF") toggleFullscreen();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, hasFinePointer]);

  function resetHideTimer() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    if (isFullscreen) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }

  useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [isFullscreen]);

  const applyQuality = useCallback((q: Quality) => {
    activePubRef.current?.setVideoQuality(QUALITY_LK[q]);
  }, []);

  const attachTrack = useCallback((track: RemoteTrack, pub?: RemoteTrackPublication) => {
    if (track.kind === Track.Kind.Video) {
      const el = videoRef.current;
      if (!el) return;
      track.attach(el);
      if (pub) activePubRef.current = pub;
      applyQuality(quality);
      setStatus("live");
    } else if (track.kind === Track.Kind.Audio) {
      // Give each remote audio track its own <audio> element.
      // Use pub.trackSid (always set by SFU) as the key, with track.sid as fallback.
      // We set srcObject directly rather than calling track.attach() to avoid LiveKit SDK v2's
      // adaptiveStream ResizeObserver logic, which can mistakenly pause invisible <audio>
      // elements (they report 0×0 size) and stop server-side delivery.
      const sid = pub?.trackSid ?? track.sid;
      if (!sid || audioElsRef.current.has(sid)) return; // already attached or no sid yet
      const el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "");
      el.muted  = mutedRef.current;
      el.volume = volumeRef.current;
      document.body.appendChild(el);
      audioElsRef.current.set(sid, el);
      // Bypass track.attach() to avoid adaptiveStream visibility side-effects;
      // directly wire the MediaStreamTrack so the browser plays it unconditionally.
      el.srcObject = new MediaStream([track.mediaStreamTrack]);
      el.play()
        .then(() => setAudioBlocked(false))
        .catch(() => setAudioBlocked(true));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, applyQuality]);

  const detachTrack = useCallback((track: RemoteTrack, pub?: RemoteTrackPublication) => {
    if (track.kind === Track.Kind.Video) {
      const el = videoRef.current;
      if (!el) return;
      track.detach(el);
      activePubRef.current = null;
      setStatus("offline");
    } else if (track.kind === Track.Kind.Audio) {
      const sid = pub?.trackSid ?? track.sid;
      if (!sid) return;
      const el = audioElsRef.current.get(sid);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(sid);
      }
    }
  }, []);

  // LiveKit connect
  useEffect(() => {
    if (!streamId) return;
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId }),
        });
        if (!res.ok) throw new Error("Failed to get token");
        const { token } = await res.json();

        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!wsUrl) throw new Error("LiveKit URL not configured");

        const room = new Room({
          // adaptiveStream disabled: in LiveKit SDK v2 it attaches a ResizeObserver to
          // every element passed to track.attach(). Invisible <audio> elements (0×0) are
          // flagged as "not visible" which can pause server-side audio delivery.
          // Video quality is controlled manually via setVideoQuality() instead.
          adaptiveStream: false,
          dynacast: true,
        });
        if (cancelled) return;
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed,
          (track: RemoteTrack, pub: RemoteTrackPublication) => attachTrack(track, pub));
        room.on(RoomEvent.TrackUnsubscribed,
          (track: RemoteTrack, pub: RemoteTrackPublication) => detachTrack(track, pub));
        room.on(RoomEvent.Reconnecting, () => setReconnecting(true));
        room.on(RoomEvent.Reconnected, () => {
          setReconnecting(false);
          let hasVideo = false;
          room.remoteParticipants.forEach((p: RemoteParticipant) => {
            p.trackPublications.forEach((pub) => {
              if (!pub.track) return;
              if (pub.kind === Track.Kind.Video) { attachTrack(pub.track as RemoteTrack, pub); hasVideo = true; }
              else if (pub.kind === Track.Kind.Audio) { attachTrack(pub.track as RemoteTrack, pub); }
            });
          });
          if (!hasVideo) setStatus("offline");
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) { setReconnecting(false); setStatus("error"); }
        });

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        let foundVideo = false;
        room.remoteParticipants.forEach((p: RemoteParticipant) => {
          p.trackPublications.forEach((pub) => {
            if (!pub.track) return;
            if (pub.kind === Track.Kind.Video) {
              attachTrack(pub.track as RemoteTrack, pub);
              foundVideo = true;
            } else if (pub.kind === Track.Kind.Audio) {
              attachTrack(pub.track as RemoteTrack, pub);
            }
          });
        });

        if (!foundVideo) setStatus("offline");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Connection failed");
          setStatus("error");
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [streamId, attachTrack, detachTrack]);

  // SSE for stream_ended
  useEffect(() => {
    if (!streamId) return;
    const es = new EventSource(`/api/streams/${streamId}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "stream_ended") {
          setStatus("ended");
          if (videoRef.current) videoRef.current.srcObject = null;
          audioElsRef.current.forEach(el => { el.srcObject = null; el.remove(); });
          audioElsRef.current.clear();
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [streamId]);

  function toggleFullscreen() {
    const container = containerRef.current;
    const vid = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;

    if (document.fullscreenElement || (document as unknown as Record<string, unknown>).webkitFullscreenElement) {
      (document.exitFullscreen || (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen)
        .call(document);
      return;
    }
    if (container?.requestFullscreen) {
      container.requestFullscreen();
    } else if ((container as unknown as { webkitRequestFullscreen?: () => void })?.webkitRequestFullscreen) {
      (container as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    } else if (vid?.webkitEnterFullscreen) {
      vid.webkitEnterFullscreen();
    }
  }

  function unlockAudio() {
    // Play all audio elements muted-first (guaranteed from a user gesture click),
    // then immediately restore the user's actual mute/volume preference.
    let anyPlaying = false;
    audioElsRef.current.forEach(el => {
      if (!el.paused) { anyPlaying = true; return; }
      el.muted = true;
      el.play()
        .then(() => {
          el.muted  = mutedRef.current;
          el.volume = volumeRef.current;
          anyPlaying = true;
          setAudioBlocked(false);
        })
        .catch(() => {});
    });
    if (anyPlaying) setAudioBlocked(false);
  }

  function toggleMute() {
    if (audioBlocked) { unlockAudio(); return; }
    if (muted) { setMuted(false); setVolume(prevVolume || 1); }
    else { setPrevVolume(volume); setMuted(true); }
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    if (v > 0) setPrevVolume(v);
  }

  function handleQualityChange(q: Quality) {
    setQuality(q);
    applyQuality(q);
    setShowQuality(false);
  }

  function VolumeIcon() {
    if (muted || volume === 0) return <VolumeX size={15} />;
    if (volume < 0.5) return <Volume1 size={15} />;
    return <Volume2 size={15} />;
  }

  const isLive = status === "live";

  if (status === "ended") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-14 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          <Radio size={28} className="text-[var(--text-muted)]" strokeWidth={1.2} />
        </div>
        <div>
          <p className="font-display font-bold text-lg text-[var(--text-primary)] mb-1">Stream has ended</p>
          <p className="text-sm text-[var(--text-muted)]">The broadcast has finished. Thanks for watching!</p>
        </div>
        <Link href="/feed" className="btn-primary no-underline py-2 px-6 text-sm">Back to Feed</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      <div
        ref={containerRef}
        onMouseMove={resetHideTimer}
        onTouchStart={resetHideTimer}
        onMouseLeave={() => { if (!isFullscreen) setShowControls(true); }}
        className="w-full aspect-video rounded-[10px] sm:rounded-[14px] overflow-hidden border border-[var(--border-subtle)] bg-[#0a0a0a] relative flex items-center justify-center select-none"
        style={{ cursor: isFullscreen && !showControls ? "none" : "default" }}
      >
        {/* Video element — carries video track only, always muted */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-contain"
          style={{ display: isLive ? "block" : "none" }}
        />

        {!isLive && (
          <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
            {status === "connecting"
              ? <Loader2 size={36} strokeWidth={1.2} className="animate-spin" />
              : <Monitor size={40} strokeWidth={1.2} />}
            <span className="text-sm font-display">
              {status === "connecting" && "Connecting…"}
              {status === "offline"    && "Waiting for stream"}
              {status === "error"      && (error ?? "Connection error")}
            </span>
          </div>
        )}

        {/* Reconnecting overlay — sits on top of last frozen video frame */}
        {reconnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 z-10">
            <Loader2 size={32} className="animate-spin text-white/80" strokeWidth={1.5} />
            <span className="text-sm font-display text-white/80">Reconnecting…</span>
          </div>
        )}

        {isLive && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.2rem] px-2.5 z-10 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[0.6875rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
          </div>
        )}

        {audioBlocked && isLive && (
          <button
            onClick={unlockAudio}
            className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-[12px] bg-black/80 border border-white/20 text-white font-display font-semibold text-sm backdrop-blur-sm">
              <Volume2 size={18} />
              Click to enable audio
            </div>
          </button>
        )}

        {showQuality && (
          <div
            className="absolute bottom-14 right-2.5 z-30 bg-[#111]/95 backdrop-blur-sm border border-white/10 rounded-[10px] overflow-hidden shadow-xl"
            onMouseLeave={() => setShowQuality(false)}
          >
            <p className="text-[0.6875rem] font-display font-bold tracking-[0.06em] uppercase text-white/40 px-3 pt-2.5 pb-1">Quality</p>
            {(["high", "medium", "low"] as Quality[]).map((q) => (
              <button key={q} onClick={() => handleQualityChange(q)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
              >
                <span className="font-display font-semibold">{QUALITY_LABEL[q]}</span>
                {quality === q && <span className="w-1.5 h-1.5 rounded-full bg-pink-400 ml-4" />}
              </button>
            ))}
          </div>
        )}

        {/* Controls overlay */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 transition-opacity duration-200"
          style={{ opacity: (isLive && showControls) || !isLive ? 1 : 0, pointerEvents: showControls || !isLive ? "auto" : "none" }}
        >
          {isLive && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />}
          <div className="relative flex items-center gap-1.5 px-2.5 py-2">
            <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"} className="text-white/80 hover:text-white transition-colors p-1 shrink-0">
              <VolumeIcon />
            </button>
            {hasFinePointer && (
              <div className="relative flex items-center w-16 shrink-0">
                <input type="range" min={0} max={1} step={0.02}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider w-full"
                />
              </div>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setShowQuality((v) => !v)}
              title="Quality"
              className="flex items-center gap-1 text-white/70 hover:text-white transition-colors p-1"
            >
              <Settings size={13} />
              <span className="text-[0.6875rem] font-display font-semibold hidden xs:inline">{QUALITY_LABEL[quality]}</span>
            </button>
            <button onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="text-white/80 hover:text-white transition-colors p-1 shrink-0"
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            </button>
          </div>
        </div>
      </div>

      {!isLive && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.75rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-[0.05em]">Quality:</span>
          {(["high", "medium", "low"] as Quality[]).map((q) => (
            <button key={q} onClick={() => setQuality(q)}
              className="text-[0.75rem] font-display font-semibold px-2.5 py-1 rounded-[6px] border transition-colors"
              style={{
                borderColor: quality === q ? "rgba(249,115,22,0.5)" : "var(--border-subtle)",
                background:  quality === q ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                color:       quality === q ? "var(--accent-orange)" : "var(--text-muted)",
              }}
            >
              {QUALITY_LABEL[q]}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        {isLive ? (
          <>
            <Wifi size={12} className="text-emerald-400" />
            <span>Live</span>
            {hasFinePointer && (
              <span className="ml-1">
                — press <kbd className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1 py-px text-[0.625rem] mx-0.5">F</kbd> for fullscreen
              </span>
            )}
          </>
        ) : (
          <><WifiOff size={12} /> Waiting for stream</>
        )}
      </div>

      <style>{`
        .volume-slider{-webkit-appearance:none;appearance:none;height:3px;border-radius:3px;background:rgba(255,255,255,0.25);outline:none;cursor:pointer}
        .volume-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:11px;height:11px;border-radius:50%;background:white;cursor:pointer}
        .volume-slider::-moz-range-thumb{width:11px;height:11px;border-radius:50%;background:white;border:none;cursor:pointer}
      `}</style>
    </div>
  );
}
