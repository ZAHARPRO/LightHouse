"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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

const VOLUME_KEY = "lh_stream_volume";

interface Props {
  streamId: string;
  isOwner?: boolean;
}

export default function StreamViewer({ streamId, isOwner = false }: Props) {
  const roomRef      = useRef<Room | null>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const audioElsRef  = useRef<Map<string, HTMLAudioElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const activePubRef = useRef<RemoteTrackPublication | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);

  const mutedRef    = useRef(false);
  const volumeRef   = useRef(1);
  const qualityRef  = useRef<Quality>("high");
  const camVideoRef = useRef<HTMLVideoElement>(null);

  const [status,       setStatus]     = useState<Status>("connecting");
  const [error,        setError]      = useState<string | null>(null);
  const [muted,        setMuted]      = useState(false);
  const [volume,       setVolume]     = useState(1);
  const [prevVolume,   setPrevVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality,      setQuality]    = useState<Quality>("high");
  const [showQuality,  setShowQuality]  = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [hasFinePointer, setHasFinePointer] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [camCfg,         setCamCfg]         = useState<import("@/lib/stream-overlay").CamCfg | null>(null);
  const [supportCfg,     setSupportCfg]     = useState<import("@/lib/stream-overlay").SupportCfg | null>(null);
  const [chatOverlayPos, setChatOverlayPos] = useState<import("@/lib/stream-overlay").XY>({ x: 68, y: 8 });
  const [chatOverlay,    setChatOverlay]     = useState<{ id: string; userName: string; text: string }[]>([]);
  const [showChatOverlay,setShowChatOverlay] = useState(true);
  const [supportToasts,  setSupportToasts]  = useState<{ id: string; userName: string; text: string }[]>([]);

  // Track mounted state to avoid setState on unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setHasFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHasFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Load overlay settings + subscribe to overlay SSE updates
  useEffect(() => {
    if (!streamId) return;
    fetch(`/api/streams/${streamId}/overlay`)
      .then(r => r.json())
      .then((d: { cam: import("@/lib/stream-overlay").CamCfg; support: import("@/lib/stream-overlay").SupportCfg; chatPos?: import("@/lib/stream-overlay").XY; chatEnabled?: boolean }) => {
        setCamCfg(d.cam);
        setSupportCfg(d.support);
        if (d.chatPos) setChatOverlayPos(d.chatPos);
        if (d.chatEnabled !== undefined) setShowChatOverlay(d.chatEnabled);
      })
      .catch(() => {});
  }, [streamId]);

  // Restore saved volume on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOLUME_KEY);
      if (saved) {
        const { volume: v, muted: m } = JSON.parse(saved);
        if (typeof v === "number" && v >= 0 && v <= 1) {
          setVolume(v);
          volumeRef.current = v;
          setPrevVolume(v > 0 ? v : 1);
        }
        if (typeof m === "boolean") {
          setMuted(m);
          mutedRef.current = m;
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs in sync + persist to localStorage
  useEffect(() => {
    mutedRef.current = muted;
    try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume, muted })); } catch { /* ignore */ }
  }, [muted, volume]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { qualityRef.current = quality; }, [quality]);

  // Sync mute/volume → all active audio elements
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

  // Fullscreen detection
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

  // attachTrack uses qualityRef (not quality state) so it stays stable and
  // never triggers the LiveKit connect effect to disconnect/reconnect on quality change.
  const attachTrack = useCallback((track: RemoteTrack, pub?: RemoteTrackPublication) => {
    if (track.kind === Track.Kind.Video) {
      if (pub?.source === Track.Source.Camera) {
        const el = camVideoRef.current;
        if (el) track.attach(el);
        return;
      }
      const el = videoRef.current;
      if (!el) return;
      track.attach(el);
      if (pub) activePubRef.current = pub;
      applyQuality(qualityRef.current);
      setStatus("live");
    } else if (track.kind === Track.Kind.Audio) {
      const sid = pub?.trackSid ?? track.sid;
      if (!sid || audioElsRef.current.has(sid)) return;
      const el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "");
      el.muted  = mutedRef.current;
      el.volume = volumeRef.current;
      document.body.appendChild(el);
      audioElsRef.current.set(sid, el);
      track.attach(el);
      el.play()
        .then(() => { if (mountedRef.current) setAudioBlocked(false); })
        .catch(() => { if (mountedRef.current) setAudioBlocked(true); });
    }
  }, [applyQuality]);

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
        track.detach(el);
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(sid);
      }
    }
  }, []);

  // LiveKit connect — only re-runs when streamId changes (attachTrack is now stable)
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

        const room = new Room({ adaptiveStream: false, dynacast: true });
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

  // SSE — stream events + overlay settings + chat overlay + support toasts
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
        if (data.type === "overlay_settings") {
          if (data.cam)     setCamCfg(data.cam);
          if (data.support) setSupportCfg(data.support);
          if (data.chatPos) setChatOverlayPos(data.chatPos as import("@/lib/stream-overlay").XY);
          if (data.chatEnabled !== undefined) setShowChatOverlay(data.chatEnabled as boolean);
        }
        if (data.type === "chat") {
          const msg = { id: data.id as string, userName: data.userName as string, text: data.text as string };
          setChatOverlay(prev => [...prev.slice(-19), msg]);
          if (data.isSupport) {
            const toast = { id: data.id as string, userName: data.userName as string, text: data.text as string };
            setSupportToasts(prev => [...prev, toast]);
            setTimeout(() => setSupportToasts(p => p.filter(t => t.id !== toast.id)), ((data.duration as number) ?? 6) * 1000);
          }
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
    let anyPlaying = false;
    audioElsRef.current.forEach(el => {
      if (!el.paused) { anyPlaying = true; return; }
      el.muted = true;
      el.play()
        .then(() => {
          el.muted  = mutedRef.current;
          el.volume = volumeRef.current;
          anyPlaying = true;
          if (mountedRef.current) setAudioBlocked(false);
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

  const volumeIcon = useMemo(() => {
    if (muted || volume === 0) return <VolumeX size={15} />;
    if (volume < 0.5) return <Volume1 size={15} />;
    return <Volume2 size={15} />;
  }, [muted, volume]);

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

        {reconnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 z-10">
            <Loader2 size={32} className="animate-spin text-white/80" strokeWidth={1.5} />
            <span className="text-sm font-display text-white/80">Reconnecting…</span>
          </div>
        )}

        {isLive && !isFullscreen && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.2rem] px-2.5 z-10 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[0.6875rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
          </div>
        )}

        {/* ── Camera PiP ── always in DOM so camVideoRef exists when the track arrives */}
        <div style={{
          position: "absolute",
          left: `${camCfg?.pos.x ?? 65}%`,
          top:  `${camCfg?.pos.y ?? 65}%`,
          width: `${camCfg?.widthPct ?? 25}%`,
          zIndex: 8,
          display: (isLive && camCfg?.enabled) ? "block" : "none",
        }}>
          <video
            ref={camVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              aspectRatio: "16/9",
              objectFit: "cover",
              display: "block",
              border: camCfg?.borderW && camCfg.borderW > 0
                ? `${camCfg.borderW}px solid ${camCfg.borderColor}`
                : "none",
              borderRadius: camCfg?.borderRadius,
            }}
          />
          {camCfg?.ticker && (
            <div style={{ overflow: "hidden", background: "rgba(0,0,0,0.55)", paddingTop: 2, paddingBottom: 2 }}>
              <div style={{
                display: "inline-block",
                animation: "camTicker 12s linear infinite",
                fontSize: camCfg.tickerSize,
                color: camCfg.tickerColor,
                fontFamily: `'${camCfg.tickerFont}', sans-serif`,
                whiteSpace: "nowrap",
                paddingLeft: "100%",
              }}>
                {camCfg.ticker}
              </div>
            </div>
          )}
        </div>

        {/* ── Support toasts ── */}
        {supportToasts.map((t, i) => {
          const pos: React.CSSProperties = {
            left: `${supportCfg?.pos?.x ?? 32}%`,
            top:  `calc(${supportCfg?.pos?.y ?? 4}% + ${i * 52}px)`,
          };
          return (
            <div key={t.id} style={{
              position: "absolute", ...pos,
              background: supportCfg?.bgColor ?? "#831843",
              color: supportCfg?.textColor ?? "#fce7f3",
              borderRadius: 10, padding: "8px 18px",
              fontSize: 13, fontWeight: 700,
              animation: "slideDownIn 0.3s ease",
              zIndex: 15, whiteSpace: "nowrap",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}>
              ❤️ {t.userName}: {t.text}
            </div>
          );
        })}

        {/* ── Chat overlay ── */}
        {isLive && showChatOverlay && chatOverlay.length > 0 && (
          <div style={{
            position: "absolute",
            left: `${chatOverlayPos.x}%`,
            top:  `${chatOverlayPos.y}%`,
            width: 260, maxHeight: "55%",
            display: "flex", flexDirection: "column", gap: 4,
            overflowY: "hidden", zIndex: 9, pointerEvents: "none",
          }}>
            {chatOverlay.slice(-10).map(m => (
              <div key={m.id} style={{
                background: "rgba(0,0,0,0.72)", borderRadius: 6,
                padding: "3px 8px", display: "flex", gap: 5,
                animation: "slideDownIn 0.18s ease",
              }}>
                <span style={{ color: "#fb923c", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{m.userName}:</span>
                <span style={{ color: "#fff", fontSize: 12, wordBreak: "break-word" }}>{m.text}</span>
              </div>
            ))}
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

        <div
          className="absolute inset-x-0 bottom-0 z-20 transition-opacity duration-200"
          style={{ opacity: (isLive && showControls) || !isLive ? 1 : 0, pointerEvents: showControls || !isLive ? "auto" : "none" }}
        >
          {isLive && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />}
          <div className="relative flex items-center gap-1.5 px-2.5 py-2">
            <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"} className="text-white/80 hover:text-white transition-colors p-1 shrink-0">
              {volumeIcon}
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
            {/* Chat overlay toggle — owner only */}
            {isOwner && (
              <button
                onClick={() => setShowChatOverlay(v => !v)}
                title={showChatOverlay ? "Hide chat overlay" : "Show chat overlay"}
                className="text-white/70 hover:text-white transition-colors p-1"
                style={{ color: showChatOverlay ? "#fb923c" : undefined }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            )}
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
        @keyframes slideDownIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes camTicker{from{transform:translateX(0)}to{transform:translateX(-200%)}}
      `}</style>
    </div>
  );
}
