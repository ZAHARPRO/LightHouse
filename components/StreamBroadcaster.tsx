"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, Track } from "livekit-client";
import {
  Monitor, MonitorOff, Wifi, WifiOff, Loader2,
  ChevronDown, Link2, Check, Eye, EyeOff,
  Mic, MicOff, MousePointer, Mouse, ImagePlus, X, Clock,
  Volume2, VolumeX, RefreshCw,
} from "lucide-react";

type Status = "idle" | "connecting" | "live" | "error";

// ── Audio level bar (VU meter) ───────────────────────────────────────────────
function AudioLevelBar({ track, label }: { track: MediaStreamTrack | null; label: string }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!track || track.readyState !== "live") { setLevel(0); return; }
    let ctx: AudioContext | undefined;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        analyser.getByteFrequencyData(data);
        setLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    } catch { /* ignore */ }
    return () => { cancelAnimationFrame(raf); ctx?.close(); };
  }, [track]);

  const pct = Math.min(level * 100, 100);
  return (
    <div className="flex flex-col gap-0.5 min-w-[44px]">
      <span className="text-[0.5625rem] text-white/50 font-display uppercase tracking-wider">{label}</span>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${pct}%`,
            background: pct > 80 ? "#ef4444" : pct > 50 ? "#fbbf24" : "#10b981",
          }}
        />
      </div>
      <span className="text-[0.5rem] text-white/30 font-mono text-right">
        {level > 0.01 ? "●" : "○"}
      </span>
    </div>
  );
}

interface Props {
  existingStreamId?: string;
  onStreamChange?: (streamId: string | null) => void;
}

type VideoConstraintsExt = MediaTrackConstraints & { cursor?: "always" | "never" | "motion" };

async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 640, MAX_H = 360;
      let { width, height } = img;
      const ratio = Math.min(MAX_W / width, MAX_H / height);
      if (ratio < 1) { width = Math.round(width * ratio); height = Math.round(height * ratio); }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const SCREEN_VIDEO_OPTS = (captureCursor: boolean) => ({
  frameRate: 60,
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  cursor: captureCursor ? "always" : "never",
} as VideoConstraintsExt);

const SCREEN_AUDIO_OPTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  sampleRate: 48000,
};

export default function StreamBroadcaster({ existingStreamId, onStreamChange }: Props) {
  const roomRef                 = useRef<Room | null>(null);
  const videoRef                = useRef<HTMLVideoElement>(null);
  const previewRef              = useRef<HTMLVideoElement>(null);
  const screenTrackRef          = useRef<LocalVideoTrack | null>(null);
  const streamIdRef             = useRef<string | null>(existingStreamId ?? null);
  const dropdownRef             = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const awayTimeoutRef          = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const awayTickRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenAtRef             = useRef<number | null>(null);
  const micRawTrackRef           = useRef<MediaStreamTrack | null>(null);
  const micLiveTrackRef          = useRef<LocalAudioTrack | null>(null);
  const screenAudioRawTrackRef   = useRef<MediaStreamTrack | null>(null);
  const screenAudioLiveTrackRef  = useRef<LocalAudioTrack | null>(null);
  const rawScreenVideoTrackRef   = useRef<MediaStreamTrack | null>(null);
  // Cleanup fn that removes the "ended" listener from the current raw video track
  const videoEndedCleanupRef     = useRef<(() => void) | null>(null);
  const previewAudioRef          = useRef<HTMLAudioElement | null>(null);

  const [status,            setStatus]           = useState<Status>("idle");
  const [error,             setError]            = useState<string | null>(null);
  const [viewerCount,       setViewerCount]      = useState(0);
  const [awaySecondsLeft,   setAwaySecondsLeft]  = useState<number | null>(null);
  const [previewAudioMuted, setPreviewAudioMuted] = useState(false);
  const [previewAudioVol,   setPreviewAudioVol]  = useState(0.7);
  const [streamTitle,       setStreamTitle]      = useState("");
  const [description,       setDescription]      = useState("");
  const [thumbnail,         setThumbnail]        = useState<string | null>(null);
  const [captureAudio,      setCaptureAudio]     = useState(true);
  const [captureCursor,     setCaptureCursor]    = useState(true);
  const [showDropdown,      setShowDropdown]     = useState(false);
  const [showPreview,       setShowPreview]      = useState(false);
  const [copied,            setCopied]           = useState(false);
  // Live controls
  const [micMuted,          setMicMuted]         = useState(false);
  const [switchingScreen,   setSwitchingScreen]  = useState(false);

  // Attach/detach track to inline preview
  useEffect(() => {
    const track = screenTrackRef.current;
    const el = previewRef.current;
    if (!track || !el) return;
    if (showPreview) {
      track.attach(el);
    } else {
      track.detach(el);
      el.srcObject = null;
    }
  }, [showPreview]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function onDown(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDropdown]);

  const updateViewers = useCallback((room: Room) => {
    setViewerCount(room.remoteParticipants.size);
  }, []);

  // Helper: publish screen audio — userProvidedTrack=true prevents LiveKit from
  // re-acquiring the track via getUserMedia (which would re-enable noise suppression)
  const publishScreenAudio = useCallback(async (rawTrack: MediaStreamTrack) => {
    if (!roomRef.current) return;
    await rawTrack.applyConstraints({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }).catch(() => {});
    screenAudioRawTrackRef.current = rawTrack;
    const liveTrack = new LocalAudioTrack(rawTrack, undefined, true);
    screenAudioLiveTrackRef.current = liveTrack;
    await roomRef.current.localParticipant.publishTrack(liveTrack, {
      source: Track.Source.ScreenShareAudio,
    });
  }, []);

  // Helper: publish mic track and store refs
  const publishMic = useCallback(async () => {
    if (!roomRef.current) return false;
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const rawTrack = micStream.getAudioTracks()[0];
      if (!rawTrack) return false;
      micRawTrackRef.current = rawTrack;
      const liveTrack = new LocalAudioTrack(rawTrack, undefined, true);
      micLiveTrackRef.current = liveTrack;
      await roomRef.current.localParticipant.publishTrack(liveTrack, {
        source: Track.Source.Microphone,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    try {
      // 1. Get or create stream in DB
      let streamId: string;
      if (existingStreamId) {
        streamId = existingStreamId;
      } else {
        const dbRes = await fetch("/api/streams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: streamTitle.trim() || "Live Stream",
            description: description.trim() || null,
            thumbnail,
          }),
        });
        if (!dbRes.ok) throw new Error("Failed to register stream");
        const data = await dbRes.json();
        streamId = data.id;
        window.history.replaceState(null, "", `/stream/${streamId}`);
      }
      streamIdRef.current = streamId;
      onStreamChange?.(streamId);

      // 2. Connect to LiveKit
      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId }),
      });
      if (!tokenRes.ok) throw new Error("Failed to get token");
      const { token } = await tokenRes.json();

      const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!wsUrl) throw new Error("LiveKit URL not configured");

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected,    () => updateViewers(room));
      room.on(RoomEvent.ParticipantDisconnected, () => updateViewers(room));

      await room.connect(wsUrl, token);
      updateViewers(room);

      // 3. Capture screen
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_VIDEO_OPTS(captureCursor),
        audio: SCREEN_AUDIO_OPTS,
      } as DisplayMediaStreamOptions);

      // Hint the encoder that this is screen content (sharp edges/text, not motion)
      const videoMediaTrack = displayStream.getVideoTracks()[0];
      (videoMediaTrack as MediaStreamTrack & { contentHint?: string }).contentHint = "detail";
      rawScreenVideoTrackRef.current = videoMediaTrack;

      // userProvidedTrack=true — we manage the track lifecycle so LiveKit won't
      // stop it on unpublishTrack (which would fire "ended" and kill the stream)
      const screenTrack = new LocalVideoTrack(videoMediaTrack, undefined, true);
      screenTrackRef.current = screenTrack;

      // No simulcast for screen share — simulcast degrades sharp text/edges.
      // Use a single high-quality layer with a realistic bitrate cap.
      await room.localParticipant.publishTrack(screenTrack, {
        source: Track.Source.ScreenShare,
        screenShareEncoding: { maxBitrate: 3_500_000, maxFramerate: 30, priority: "high" },
      });

      if (videoRef.current) screenTrack.attach(videoRef.current);

      // Publish screen audio if user shared it
      const screenAudioTracks = displayStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        await publishScreenAudio(screenAudioTracks[0]);
      }

      // Publish mic if enabled
      if (captureAudio) {
        await publishMic();
        setMicMuted(false);
      }

      // "ended" fires only when the user clicks "Stop sharing" in the browser UI
      const endedHandler = () => stopStream();
      videoMediaTrack.addEventListener("ended", endedHandler);
      videoEndedCleanupRef.current = () => videoMediaTrack.removeEventListener("ended", endedHandler);

      setStatus("live");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(
        msg.includes("Permission denied") || msg.includes("NotAllowedError")
          ? "Screen share permission denied"
          : msg === "user canceled"
          ? "Screen share cancelled"
          : msg,
      );
      setStatus("error");
      if (!existingStreamId && streamIdRef.current) {
        await fetch(`/api/streams/${streamIdRef.current}`, { method: "PATCH" }).catch(() => {});
        onStreamChange?.(null);
        streamIdRef.current = null;
      }
      roomRef.current?.disconnect();
      roomRef.current = null;
      screenTrackRef.current = null;
    }
  }, [existingStreamId, streamTitle, description, thumbnail, captureAudio, captureCursor, updateViewers, onStreamChange, publishScreenAudio, publishMic]);

  const stopStream = useCallback(async () => {
    setShowPreview(false);

    // Remove "ended" listener before stopping the raw track
    videoEndedCleanupRef.current?.();
    videoEndedCleanupRef.current = null;
    rawScreenVideoTrackRef.current?.stop();
    rawScreenVideoTrackRef.current = null;
    screenTrackRef.current = null;

    micRawTrackRef.current?.stop();
    micRawTrackRef.current = null;
    micLiveTrackRef.current = null;
    screenAudioRawTrackRef.current?.stop();
    screenAudioRawTrackRef.current = null;
    screenAudioLiveTrackRef.current = null;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.srcObject = null;
    }

    if (roomRef.current) {
      const pubs = [...roomRef.current.localParticipant.trackPublications.values()];
      await Promise.all(pubs.map((p) => p.track ? roomRef.current!.localParticipant.unpublishTrack(p.track) : null));
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (streamIdRef.current) {
      await fetch(`/api/streams/${streamIdRef.current}`, { method: "PATCH" }).catch(() => {});
      onStreamChange?.(null);
      if (!existingStreamId) window.history.replaceState(null, "", "/stream");
      streamIdRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setViewerCount(0);
    setMicMuted(false);
  }, [existingStreamId, onStreamChange]);

  // Toggle mic on/off while streaming
  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return;

    if (micLiveTrackRef.current && micRawTrackRef.current) {
      // Track exists — toggle mute state
      const newMuted = !micMuted;
      micRawTrackRef.current.enabled = !newMuted;
      if (newMuted) {
        await micLiveTrackRef.current.mute();
      } else {
        await micLiveTrackRef.current.unmute();
      }
      setMicMuted(newMuted);
    } else {
      // No mic track yet — request and publish one
      const ok = await publishMic();
      if (ok) setMicMuted(false);
    }
  }, [micMuted, publishMic]);

  // Switch capture window while streaming
  const switchScreen = useCallback(async () => {
    if (!roomRef.current) return;
    setSwitchingScreen(true);
    setError(null);

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_VIDEO_OPTS(captureCursor),
        audio: SCREEN_AUDIO_OPTS,
      } as DisplayMediaStreamOptions);

      // Remove "ended" listener from old raw track BEFORE unpublishing.
      // unpublishTrack would stop the track (even with userProvidedTrack=true in some
      // LiveKit versions), so we guard against stopStream() firing mid-switch.
      videoEndedCleanupRef.current?.();
      videoEndedCleanupRef.current = null;

      // Detach + unpublish old video track
      const oldScreenTrack = screenTrackRef.current;
      if (oldScreenTrack) {
        if (videoRef.current) oldScreenTrack.detach(videoRef.current);
        await roomRef.current.localParticipant.unpublishTrack(oldScreenTrack);
      }
      // Stop the old raw track now (safe — listener already removed)
      rawScreenVideoTrackRef.current?.stop();
      rawScreenVideoTrackRef.current = null;

      // Publish new video track
      const newVideoMediaTrack = displayStream.getVideoTracks()[0];
      (newVideoMediaTrack as MediaStreamTrack & { contentHint?: string }).contentHint = "detail";
      rawScreenVideoTrackRef.current = newVideoMediaTrack;

      const newScreenTrack = new LocalVideoTrack(newVideoMediaTrack, undefined, true);
      screenTrackRef.current = newScreenTrack;

      await roomRef.current.localParticipant.publishTrack(newScreenTrack, {
        source: Track.Source.ScreenShare,
        screenShareEncoding: { maxBitrate: 3_500_000, maxFramerate: 30, priority: "high" },
      });
      if (videoRef.current) newScreenTrack.attach(videoRef.current);
      if (showPreview && previewRef.current) newScreenTrack.attach(previewRef.current);

      // Handle new screen audio
      const newScreenAudioTracks = displayStream.getAudioTracks();
      if (newScreenAudioTracks.length > 0) {
        if (screenAudioLiveTrackRef.current) {
          await roomRef.current.localParticipant.unpublishTrack(screenAudioLiveTrackRef.current);
          screenAudioRawTrackRef.current?.stop();
          screenAudioLiveTrackRef.current = null;
          screenAudioRawTrackRef.current = null;
        }
        await publishScreenAudio(newScreenAudioTracks[0]);
      } else if (screenAudioLiveTrackRef.current) {
        await roomRef.current.localParticipant.unpublishTrack(screenAudioLiveTrackRef.current);
        screenAudioRawTrackRef.current?.stop();
        screenAudioLiveTrackRef.current = null;
        screenAudioRawTrackRef.current = null;
      }

      // Wire up new "ended" listener
      const endedHandler = () => stopStream();
      newVideoMediaTrack.addEventListener("ended", endedHandler);
      videoEndedCleanupRef.current = () => newVideoMediaTrack.removeEventListener("ended", endedHandler);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!msg.toLowerCase().includes("cancel") && !msg.includes("NotAllowedError")) {
        setError("Failed to switch capture window");
      }
    } finally {
      setSwitchingScreen(false);
    }
  }, [captureCursor, showPreview, publishScreenAudio, stopStream]);

  async function copyLink() {
    const id = streamIdRef.current;
    const url = id ? `${window.location.origin}/stream/${id}` : `${window.location.origin}/stream`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowDropdown(false);
  }

  async function handleThumbnailFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setThumbnail(await resizeImage(file)); } catch { /* ignore */ }
    e.target.value = "";
  }

  const sendHeartbeat = useCallback(() => {
    const id = streamIdRef.current;
    if (!id) return;
    fetch(`/api/streams/${id}/heartbeat`, { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== "live") return;

    const TIMEOUT_S = 5 * 60;
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 25_000);

    function onVisibilityChange() {
      if (document.hidden) {
        clearInterval(heartbeatIntervalRef.current!);
        heartbeatIntervalRef.current = null;
        hiddenAtRef.current = Date.now();

        let left = TIMEOUT_S;
        setAwaySecondsLeft(left);

        awayTickRef.current = setInterval(() => {
          left -= 1;
          setAwaySecondsLeft(left);
          if (left <= 0) { clearInterval(awayTickRef.current!); awayTickRef.current = null; }
        }, 1_000);

        awayTimeoutRef.current = setTimeout(() => {
          clearInterval(awayTickRef.current!);
          awayTickRef.current = null;
          setAwaySecondsLeft(null);
          stopStream();
        }, TIMEOUT_S * 1_000);
      } else {
        clearTimeout(awayTimeoutRef.current!);
        clearInterval(awayTickRef.current!);
        awayTimeoutRef.current = null;
        awayTickRef.current = null;
        hiddenAtRef.current = null;
        setAwaySecondsLeft(null);
        sendHeartbeat();
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 25_000);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(heartbeatIntervalRef.current!);
      clearTimeout(awayTimeoutRef.current!);
      clearInterval(awayTickRef.current!);
      heartbeatIntervalRef.current = null;
      awayTimeoutRef.current = null;
      awayTickRef.current = null;
      setAwaySecondsLeft(null);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [status, sendHeartbeat, stopStream]);

  useEffect(() => { return () => { roomRef.current?.disconnect(); }; }, []);

  useEffect(() => {
    const el = previewAudioRef.current;
    if (!el) return;
    el.muted  = previewAudioMuted;
    el.volume = previewAudioMuted ? 0 : previewAudioVol;
  }, [previewAudioMuted, previewAudioVol]);

  useEffect(() => {
    const el = previewAudioRef.current;
    if (!showPreview || status !== "live" || !el) return;

    const tracks: MediaStreamTrack[] = [];
    if (screenAudioRawTrackRef.current?.readyState === "live") tracks.push(screenAudioRawTrackRef.current);
    if (micRawTrackRef.current?.readyState === "live")        tracks.push(micRawTrackRef.current);

    if (tracks.length === 0) return;
    el.srcObject = new MediaStream(tracks);
    el.muted  = previewAudioMuted;
    el.volume = previewAudioMuted ? 0 : previewAudioVol;
    el.play().catch(() => {});

    return () => { el.pause(); el.srcObject = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, status]);

  const isIdle = status === "idle" || status === "error";
  const buttonLabel = existingStreamId ? "Reconnect to Stream" : "Start Stream";

  return (
    <div className="flex flex-col gap-4">

      {/* ── Setup form (idle only) ── */}
      {isIdle && (
        <div className="flex flex-col gap-3 p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px]">
          <p className="text-[0.6875rem] font-display font-bold tracking-[0.08em] uppercase text-[var(--text-muted)]">
            {existingStreamId ? "Reconnect to your stream" : "Stream Setup"}
          </p>

          {!existingStreamId && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[0.75rem] font-display font-semibold text-[var(--text-secondary)]">Title</label>
                <input
                  className="input-field text-sm h-9 px-3"
                  placeholder="Live Stream"
                  value={streamTitle}
                  maxLength={80}
                  onChange={(e) => setStreamTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[0.75rem] font-display font-semibold text-[var(--text-secondary)]">
                  Description <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                </label>
                <textarea
                  className="input-field text-sm px-3 py-2 resize-none leading-relaxed"
                  placeholder="What are you streaming today?"
                  value={description}
                  maxLength={300}
                  rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <span className="self-end text-[0.6875rem] text-[var(--text-muted)]">{description.length}/300</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[0.75rem] font-display font-semibold text-[var(--text-secondary)]">
                  Thumbnail <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                </label>
                {thumbnail ? (
                  <div className="relative w-40 rounded-[8px] overflow-hidden border border-[var(--border-subtle)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail} alt="Stream thumbnail" className="w-full aspect-video object-cover" />
                    <button
                      onClick={() => setThumbnail(null)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <X size={10} color="white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 w-fit cursor-pointer px-3 py-1.5 rounded-[8px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-orange-500/40 transition-colors text-[0.8125rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                    <ImagePlus size={14} />
                    Upload thumbnail
                    <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailFile} />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => setCaptureAudio((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-[0.8125rem] font-display font-semibold transition-colors"
                  style={{
                    borderColor: captureAudio ? "rgba(16,185,129,0.4)" : "var(--border-subtle)",
                    background:  captureAudio ? "rgba(16,185,129,0.08)" : "var(--bg-card)",
                    color:       captureAudio ? "#10b981" : "var(--text-muted)",
                  }}
                >
                  {captureAudio ? <Mic size={13} /> : <MicOff size={13} />}
                  {captureAudio ? "Microphone on" : "Microphone off"}
                </button>

                <button
                  onClick={() => setCaptureCursor((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-[0.8125rem] font-display font-semibold transition-colors"
                  style={{
                    borderColor: captureCursor ? "rgba(99,102,241,0.4)" : "var(--border-subtle)",
                    background:  captureCursor ? "rgba(99,102,241,0.08)" : "var(--bg-card)",
                    color:       captureCursor ? "#818cf8" : "var(--text-muted)",
                  }}
                >
                  {captureCursor ? <MousePointer size={13} /> : <Mouse size={13} />}
                  {captureCursor ? "Cursor visible" : "Cursor hidden"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Main video preview ── */}
      <div className="w-full aspect-video rounded-[14px] overflow-hidden border border-[var(--border-subtle)] bg-[#0a0a0a] relative flex items-center justify-center">
        {status === "live" ? (
          <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {thumbnail && isIdle && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
              </>
            )}
            <div className="relative flex flex-col items-center gap-3 text-[var(--text-muted)]">
              <Monitor size={48} strokeWidth={1.2} />
              <span className="text-sm font-display">
                {status === "connecting" ? "Connecting…" : "No active stream"}
              </span>
            </div>
          </div>
        )}

        {status === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.2rem] px-2.5 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[0.6875rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
          </div>
        )}

        {status === "live" && (
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            <div className="flex items-center gap-1.5 bg-black/60 rounded-[5px] py-[0.2rem] px-2">
              <Wifi size={11} color="#10b981" />
              <span className="text-[0.6875rem] text-white font-display">{viewerCount} watching</span>
            </div>

            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowDropdown((v) => !v)}
                className="flex items-center gap-1 bg-black/60 hover:bg-black/80 rounded-[5px] py-[0.2rem] px-2 transition-colors"
              >
                <Eye size={11} color="#ccc" />
                <span className="text-[0.6875rem] text-white/80 font-display">Preview</span>
                <ChevronDown size={10} color="#aaa" className={`transition-transform duration-150 ${showDropdown ? "rotate-180" : ""}`} />
              </button>

              {showDropdown && (
                <div
                  className="absolute top-[calc(100%+6px)] right-0 w-[200px] bg-[#111]/95 backdrop-blur-sm border border-white/10 rounded-[10px] shadow-xl overflow-hidden z-30"
                  style={{ animation: "slideDownIn 0.12s ease both" }}
                >
                  <button
                    onClick={() => { setShowPreview((v) => !v); setShowDropdown(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[0.8125rem] text-white/80 hover:bg-white/10 transition-colors text-left"
                  >
                    {showPreview
                      ? <EyeOff size={14} className="text-white/50 shrink-0" />
                      : <Eye    size={14} className="text-white/50 shrink-0" />}
                    {showPreview ? "Hide inline preview" : "Show as viewer"}
                  </button>

                  <div className="h-px bg-white/8 mx-2" />

                  <button
                    onClick={copyLink}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[0.8125rem] text-white/80 hover:bg-white/10 transition-colors text-left"
                  >
                    {copied
                      ? <Check size={14} className="text-emerald-400 shrink-0" />
                      : <Link2 size={14} className="text-white/50 shrink-0" />}
                    {copied ? "Copied!" : "Copy stream link"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Live controls bar ── */}
      {status === "live" && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <span className="text-[0.6875rem] font-display font-bold tracking-[0.06em] uppercase text-[var(--text-muted)] shrink-0 mr-1">
            Controls
          </span>

          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            title={micMuted ? "Unmute microphone" : (micLiveTrackRef.current ? "Mute microphone" : "Enable microphone")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border text-[0.8125rem] font-display font-semibold transition-colors"
            style={{
              borderColor: (!micMuted && micLiveTrackRef.current) ? "rgba(16,185,129,0.4)" : "var(--border-subtle)",
              background:  (!micMuted && micLiveTrackRef.current) ? "rgba(16,185,129,0.08)" : "var(--bg-card)",
              color:       (!micMuted && micLiveTrackRef.current) ? "#10b981" : "var(--text-muted)",
            }}
          >
            {(!micMuted && micLiveTrackRef.current) ? <Mic size={13} /> : <MicOff size={13} />}
            {(!micMuted && micLiveTrackRef.current) ? "Mic on" : "Mic off"}
          </button>

          {/* Switch capture window */}
          <button
            onClick={switchScreen}
            disabled={switchingScreen}
            title="Switch capture window"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[0.8125rem] font-display font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] hover:border-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={13} className={switchingScreen ? "animate-spin" : ""} />
            {switchingScreen ? "Switching…" : "Switch window"}
          </button>
        </div>
      )}

      {/* ── Inline viewer preview panel ── */}
      {showPreview && status === "live" && (
        <div className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[#0a0a0a]">
          <div className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <span className="text-[0.75rem] font-display font-semibold text-[var(--text-secondary)] shrink-0">Viewer Preview</span>

            <div className="flex items-end gap-3 flex-1">
              <AudioLevelBar track={screenAudioRawTrackRef.current} label="Screen" />
              <AudioLevelBar track={micRawTrackRef.current} label="Mic" />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setPreviewAudioMuted((v) => !v)}
                className="text-white/60 hover:text-white transition-colors"
                title={previewAudioMuted ? "Unmute preview" : "Mute preview"}
              >
                {previewAudioMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05}
                value={previewAudioMuted ? 0 : previewAudioVol}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setPreviewAudioVol(v);
                  setPreviewAudioMuted(v === 0);
                }}
                className="volume-slider w-14"
              />
            </div>

            <button
              onClick={() => setShowPreview(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          <div className="aspect-video relative">
            <video ref={previewRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain" />
          </div>

          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio ref={previewAudioRef} autoPlay />

          <p className="text-center text-[0.6875rem] text-[var(--text-muted)] py-2">
            This is exactly what viewers see · Adjust volume above to monitor audio
          </p>
        </div>
      )}

      {/* Away warning */}
      {awaySecondsLeft !== null && status === "live" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-[10px] border border-amber-500/30 bg-amber-500/8 text-amber-300">
          <Clock size={15} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.8125rem] font-display font-semibold">
              Tab is inactive — stream ends in{" "}
              {String(Math.floor(awaySecondsLeft / 60)).padStart(2, "0")}:{String(awaySecondsLeft % 60).padStart(2, "0")}
            </span>
            <span className="text-[0.75rem] text-amber-400/70">Return to this tab to keep streaming</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-[8px] px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Bottom controls */}
      <div className="flex items-center gap-3">
        {isIdle ? (
          <button onClick={startStream} className="flex items-center gap-2 btn-primary py-2.5 px-5 text-sm">
            <Monitor size={15} /> {buttonLabel}
          </button>
        ) : status === "connecting" ? (
          <button disabled className="flex items-center gap-2 btn-primary py-2.5 px-5 text-sm opacity-60 cursor-not-allowed">
            <Loader2 size={15} className="animate-spin" /> Connecting…
          </button>
        ) : (
          <button
            onClick={stopStream}
            className="flex items-center gap-2 py-2.5 px-5 text-sm rounded-[9px] border border-red-500/40 bg-red-500/10 text-red-400 font-semibold transition-colors hover:bg-red-500/20"
          >
            <MonitorOff size={15} /> Stop Stream
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {status === "live"
            ? <><Wifi size={12} className="text-emerald-400" /> Streaming via LiveKit Cloud</>
            : <><WifiOff size={12} /> Stream is offline</>}
        </div>
      </div>
    </div>
  );
}
