"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, Track, ConnectionQuality } from "livekit-client";
import {
  Monitor, MonitorOff, Wifi, WifiOff, Loader2,
  ChevronDown, Link2, Check, Eye, EyeOff,
  Mic, MicOff, MousePointer, Mouse, ImagePlus, X,
  Volume2, VolumeX, RefreshCw, Gamepad2, Info, Plus,
  Pause, Play, Timer,
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
      ctx = new AudioContext({ sampleRate: 48_000 });
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

function drawPauseFrame(canvas: HTMLCanvasElement, secondsLeft: number) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;

  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(0, 0, w, h);

  // Subtle radial glow
  const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.55);
  glow.addColorStop(0, "rgba(249,115,22,0.10)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Main label
  ctx.fillStyle = "#f97316";
  ctx.font = `bold ${Math.round(w * 0.065)}px system-ui, sans-serif`;
  ctx.fillText("Be Right Back", w / 2, h / 2 - h * 0.09);

  // Countdown
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(w * 0.055)}px ui-monospace, monospace`;
  ctx.fillText(`${mins}:${String(secs).padStart(2, "0")}`, w / 2, h / 2 + h * 0.04);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `${Math.round(w * 0.022)}px system-ui, sans-serif`;
  ctx.fillText("Stream will resume automatically", w / 2, h / 2 + h * 0.15);
}

interface Props {
  existingStreamId?: string;
  onStreamChange?: (streamId: string | null) => void;
}

type VideoConstraintsExt = MediaTrackConstraints & { cursor?: "always" | "never" | "motion" };

interface AudioSource {
  id: string;
  label: string;
  rawStream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode | null;
  gainNode: GainNode | null;
  muted: boolean;
}

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

const SCREEN_VIDEO_OPTS = (captureCursor: boolean, fps: number) => ({
  frameRate: { ideal: fps },
  width:     { ideal: 1920, max: 2560 },
  height:    { ideal: 1080, max: 1440 },
  cursor: captureCursor ? "always" : "never",
} as VideoConstraintsExt);

// Processing constraints applied AFTER capture — never passed to getDisplayMedia.
// Passing constraints (esp. sampleRate) directly to getDisplayMedia causes Chrome to
// silently drop the audio track for whole-screen capture (OS loopback can't satisfy them).
const SCREEN_AUDIO_APPLY_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

// Mic constraints: 48kHz mono, processing on (good for voice)
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate:   48_000,
  channelCount: 2,
};

export default function StreamBroadcaster({ existingStreamId, onStreamChange }: Props) {
  const roomRef                 = useRef<Room | null>(null);
  const videoRef                = useRef<HTMLVideoElement>(null);
  const previewRef              = useRef<HTMLVideoElement>(null);
  const screenTrackRef          = useRef<LocalVideoTrack | null>(null);
  const streamIdRef             = useRef<string | null>(existingStreamId ?? null);
  const dropdownRef             = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopStreamRef           = useRef<(() => void) | null>(null);
  const micRawTrackRef           = useRef<MediaStreamTrack | null>(null);
  const micLiveTrackRef          = useRef<LocalAudioTrack | null>(null);
  const screenAudioRawTrackRef   = useRef<MediaStreamTrack | null>(null);
  const screenAudioLiveTrackRef  = useRef<LocalAudioTrack | null>(null);
  const rawScreenVideoTrackRef   = useRef<MediaStreamTrack | null>(null);
  // Cleanup fn that removes the "ended" listener from the current raw video track
  const videoEndedCleanupRef     = useRef<(() => void) | null>(null);
  const previewAudioRef          = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef              = useRef<AudioContext | null>(null);
  const mixerDestRef             = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mixedTrackRef            = useRef<MediaStreamTrack | null>(null);
  const audioSourcesRef          = useRef<AudioSource[]>([]);
  const pauseTimerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseCanvasRef           = useRef<HTMLCanvasElement | null>(null);
  const pauseTrackRef            = useRef<LocalVideoTrack | null>(null);
  const pauseRawTrackRef         = useRef<MediaStreamTrack | null>(null);
  const pauseEndTimeRef          = useRef<number>(0);
  const resumeFromPauseRef       = useRef<(() => Promise<void>) | null>(null);

  const [status,            setStatus]           = useState<Status>("idle");
  const [error,             setError]            = useState<string | null>(null);
  const [viewerCount,       setViewerCount]      = useState(0);
  const [previewAudioMuted, setPreviewAudioMuted] = useState(false);
  const [previewAudioVol,   setPreviewAudioVol]  = useState(0.7);
  const [streamTitle,       setStreamTitle]      = useState("");
  const [description,       setDescription]      = useState("");
  const [thumbnail,         setThumbnail]        = useState<string | null>(null);
  const [captureAudio,      setCaptureAudio]     = useState(true);
  const [captureCursor,     setCaptureCursor]    = useState(true);
  const [gameMode,          setGameMode]         = useState(false);
  const [showDropdown,      setShowDropdown]     = useState(false);
  const [showPreview,       setShowPreview]      = useState(false);
  const [copied,            setCopied]           = useState(false);
  // Live controls
  const [micMuted,          setMicMuted]         = useState(false);
  const [switchingScreen,   setSwitchingScreen]  = useState(false);
  const [isReconnecting,    setIsReconnecting]   = useState(false);
  const [poorConnection,    setPoorConnection]   = useState(false);
  const [noScreenAudio,     setNoScreenAudio]    = useState(false);
  const [audioSources,      setAudioSources]     = useState<AudioSource[]>([]);
  const [addingTab,         setAddingTab]        = useState(false);
  const [isPaused,          setIsPaused]         = useState(false);
  const [pauseSecondsLeft,  setPauseSecondsLeft] = useState(0);
  const [showPauseMenu,     setShowPauseMenu]    = useState(false);
  const pauseMenuRef                             = useRef<HTMLDivElement>(null);

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

  // Close pause-duration menu on outside click
  useEffect(() => {
    if (!showPauseMenu) return;
    function onDown(e: MouseEvent) {
      if (!pauseMenuRef.current?.contains(e.target as Node)) setShowPauseMenu(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showPauseMenu]);

  // ── Pause / resume helpers ──────────────────────────────────────────────────

  const resumeFromPause = useCallback(async () => {
    if (pauseTimerRef.current) {
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    // Unpublish BRB canvas track
    if (pauseTrackRef.current && roomRef.current) {
      if (videoRef.current) pauseTrackRef.current.detach(videoRef.current);
      await roomRef.current.localParticipant.unpublishTrack(pauseTrackRef.current);
    }
    pauseRawTrackRef.current?.stop();
    pauseRawTrackRef.current = null;
    pauseTrackRef.current    = null;
    pauseCanvasRef.current   = null;

    // Republish original screen track
    if (screenTrackRef.current && roomRef.current) {
      const captureFps = gameMode ? 120 : 60;
      const maxBitrate = gameMode ? 25_000_000 : 15_000_000;
      await roomRef.current.localParticipant.publishTrack(screenTrackRef.current, {
        source: Track.Source.ScreenShare,
        videoCodec: gameMode ? "h264" : "vp9",
        ...(gameMode
          ? { videoCodecOptions: { h264StartBitrate: 12000 } }
          : { scalabilityMode: "L1T3", videoCodecOptions: { vp9StartBitrate: 10000 } }
        ),
        screenShareEncoding: { maxBitrate, maxFramerate: captureFps, priority: "high" },
      });
      if (videoRef.current) screenTrackRef.current.attach(videoRef.current);
      if (showPreview && previewRef.current) screenTrackRef.current.attach(previewRef.current);
    }

    // Restore audio
    audioSourcesRef.current.forEach(src => {
      src.gainNode!.gain.value = src.muted ? 0 : 1;
    });
    if (micLiveTrackRef.current && !micMuted) {
      await micLiveTrackRef.current.unmute().catch(() => {});
    }

    setIsPaused(false);
    setPauseSecondsLeft(0);
  }, [gameMode, showPreview, micMuted]);

  useEffect(() => { resumeFromPauseRef.current = resumeFromPause; }, [resumeFromPause]);

  const pauseStream = useCallback(async (durationMinutes: 1 | 3 | 5) => {
    if (!roomRef.current || !screenTrackRef.current) return;
    setShowPauseMenu(false);

    const totalSeconds = durationMinutes * 60;
    pauseEndTimeRef.current = Date.now() + totalSeconds * 1000;

    // Build BRB canvas
    const canvas = document.createElement("canvas");
    canvas.width  = 1280;
    canvas.height = 720;
    drawPauseFrame(canvas, totalSeconds);
    pauseCanvasRef.current = canvas;

    // Capture 2fps video from canvas (plenty for a static countdown)
    const canvasStream    = (canvas as unknown as { captureStream(fps: number): MediaStream }).captureStream(2);
    const canvasRawTrack  = canvasStream.getVideoTracks()[0];
    pauseRawTrackRef.current = canvasRawTrack;

    // Swap out the screen track: detach + unpublish (don't stop it)
    if (videoRef.current) screenTrackRef.current.detach(videoRef.current);
    await roomRef.current.localParticipant.unpublishTrack(screenTrackRef.current);

    // Publish BRB track
    const brbLiveTrack = new LocalVideoTrack(canvasRawTrack, undefined, false);
    pauseTrackRef.current = brbLiveTrack;
    await roomRef.current.localParticipant.publishTrack(brbLiveTrack, {
      source: Track.Source.ScreenShare,
      videoCodec: "vp9",
      screenShareEncoding: { maxBitrate: 400_000, maxFramerate: 2, priority: "low" },
    });
    if (videoRef.current) brbLiveTrack.attach(videoRef.current);

    // Silence all stream audio
    audioSourcesRef.current.forEach(src => {
      src.gainNode!.gain.value = 0;
    });
    if (micLiveTrackRef.current) await micLiveTrackRef.current.mute().catch(() => {});

    setIsPaused(true);
    setPauseSecondsLeft(totalSeconds);

    // Countdown tick
    pauseTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((pauseEndTimeRef.current - Date.now()) / 1000));
      setPauseSecondsLeft(remaining);
      if (pauseCanvasRef.current) drawPauseFrame(pauseCanvasRef.current, remaining);
      if (remaining <= 0) resumeFromPauseRef.current?.();
    }, 1000);
  }, []);

  // ── Web Audio mixer helpers ──────────────────────────────────────────────────

  const addToMixer = useCallback((id: string, label: string, rawStream: MediaStream) => {
    const ctx  = audioCtxRef.current;
    const dest = mixerDestRef.current;
    if (!ctx || !dest) return;
    const sourceNode = ctx.createMediaStreamSource(rawStream);
    const gainNode   = ctx.createGain();
    gainNode.gain.value = 1;
    sourceNode.connect(gainNode);
    gainNode.connect(dest);
    const src: AudioSource = { id, label, rawStream, sourceNode, gainNode, muted: false };
    audioSourcesRef.current = [...audioSourcesRef.current, src];
    setAudioSources(audioSourcesRef.current);
  }, []);

  const removeFromMixer = useCallback((id: string) => {
    const src = audioSourcesRef.current.find(s => s.id === id);
    if (!src) return;
    try { src.gainNode?.disconnect();   } catch {}
    try { src.sourceNode?.disconnect(); } catch {}
    src.rawStream.getTracks().forEach(t => t.stop());
    audioSourcesRef.current = audioSourcesRef.current.filter(s => s.id !== id);
    setAudioSources([...audioSourcesRef.current]);
  }, []);

  const toggleSourceMute = useCallback((id: string) => {
    const src = audioSourcesRef.current.find(s => s.id === id);
    if (!src) return;
    const newMuted = !src.muted;
    src.gainNode!.gain.value = newMuted ? 0 : 1;
    audioSourcesRef.current = audioSourcesRef.current.map(s =>
      s.id === id ? { ...s, muted: newMuted } : s
    );
    setAudioSources([...audioSourcesRef.current]);
  }, []);

  const addTabAudio = useCallback(async () => {
    setAddingTab(true);
    try {
      // Minimal video required so Chrome shows the tab picker; we discard it immediately
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: { width: 1, height: 1 },
      } as DisplayMediaStreamOptions);
      stream.getVideoTracks().forEach(t => t.stop());
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) { stream.getTracks().forEach(t => t.stop()); return; }

      const id    = crypto.randomUUID();
      const label = audioTrack.label.replace(/^(audio for |system audio[: -]+)/i, "").trim() || "Tab Audio";

      if (!audioCtxRef.current) {
        // No screen audio was captured — create mixer and publish its output
        const ctx  = new AudioContext({ sampleRate: 48_000 });
        if (ctx.state !== "running") await ctx.resume();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        mixerDestRef.current  = dest;
        mixedTrackRef.current = dest.stream.getAudioTracks()[0];
        addToMixer(id, label, new MediaStream([audioTrack]));
        if (roomRef.current && mixedTrackRef.current) {
          const liveTrack = new LocalAudioTrack(mixedTrackRef.current, undefined, true);
          screenAudioLiveTrackRef.current = liveTrack;
          await roomRef.current.localParticipant.publishTrack(liveTrack, {
            source: Track.Source.ScreenShareAudio,
            audioPreset: { maxBitrate: 510_000 },
            dtx: false,
            forceStereo: true,
            red: true,
          });
          setNoScreenAudio(false);
        }
      } else {
        // Mixer already running — just plug this source in
        addToMixer(id, label, new MediaStream([audioTrack]));
      }

      audioTrack.addEventListener("ended", () => removeFromMixer(id));
    } catch {
      // user cancelled the picker
    } finally {
      setAddingTab(false);
    }
  }, [addToMixer, removeFromMixer]);

  // Route screen audio through the Web Audio mixer at 48 kHz.
  // The mixer destination always outputs stereo PCM, making forceStereo safe,
  // and the 48 kHz AudioContext prevents resampling artifacts.
  const publishScreenAudio = useCallback(async (rawTrack: MediaStreamTrack) => {
    if (!roomRef.current) return;
    await rawTrack.applyConstraints(SCREEN_AUDIO_APPLY_CONSTRAINTS).catch(() => {});
    screenAudioRawTrackRef.current = rawTrack;

    const ctx  = new AudioContext({ sampleRate: 48_000 });
    if (ctx.state !== "running") await ctx.resume();
    audioCtxRef.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    mixerDestRef.current  = dest;
    mixedTrackRef.current = dest.stream.getAudioTracks()[0];

    // Connect source to mixer BEFORE publishing — the LiveKit encoder starts
    // pulling audio immediately on publishTrack; if no source is connected yet
    // it encodes silence and some codecs/SFUs never recover from that initial gap.
    addToMixer("screen", "Screen Audio", new MediaStream([rawTrack]));

    const liveTrack = new LocalAudioTrack(mixedTrackRef.current, undefined, true);
    screenAudioLiveTrackRef.current = liveTrack;
    await roomRef.current.localParticipant.publishTrack(liveTrack, {
      source: Track.Source.ScreenShareAudio,
      audioPreset: { maxBitrate: 510_000 },
      dtx: false,
      forceStereo: true,
      red: true,
    });
  }, [addToMixer]);

  // Helper: publish mic track and store refs
  const publishMic = useCallback(async () => {
    if (!roomRef.current) return false;
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS, video: false });
      const rawTrack = micStream.getAudioTracks()[0];
      if (!rawTrack) return false;
      micRawTrackRef.current = rawTrack;
      const liveTrack = new LocalAudioTrack(rawTrack, undefined, true);
      micLiveTrackRef.current = liveTrack;
      await roomRef.current.localParticipant.publishTrack(liveTrack, {
        source: Track.Source.Microphone,
        audioPreset: { maxBitrate: 510_000 },
        dtx: true,
        forceStereo: true,
        red: true,    // FEC: recovers lost packets
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

      const room = new Room({
        adaptiveStream: true,             // viewer auto-adjusts incoming quality to their bandwidth
        dynacast: true,                   // only publish layers that subscribers actually consume
        stopLocalTrackOnUnpublish: false, // don't stop our tracks when unpublishing during screen switch
        disconnectOnPageLeave: false,     // keep connection when user tabs to game / another app
      });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected,    () => updateViewers(room));
      room.on(RoomEvent.ParticipantDisconnected, () => updateViewers(room));
      room.on(RoomEvent.Reconnecting,  () => setIsReconnecting(true));
      room.on(RoomEvent.Reconnected,   () => setIsReconnecting(false));
      room.on(RoomEvent.Disconnected,  () => { setIsReconnecting(false); });
      room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant === room.localParticipant) {
          setPoorConnection(quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost);
        }
      });

      await room.connect(wsUrl, token);
      updateViewers(room);

      // 3. Pre-capture mic BEFORE opening the screen share dialog.
      // getUserMedia called after getDisplayMedia can fail on some OS/browser combos
      // when a non-browser window is being shared (audio subsystem conflict).
      let preMicStream: MediaStream | null = null;
      if (captureAudio) {
        preMicStream = await navigator.mediaDevices
          .getUserMedia({ audio: MIC_CONSTRAINTS, video: false })
          .catch(() => null);
      }

      // Game mode vs screen/app mode:
      // Game  → H.264 (hardware encoder: NVENC/QuickSync/AMF) + "motion" hint + 30fps/4Mbps
      // Screen → VP9 (better compression for static content) + "detail" hint + 24fps/2.5Mbps
      const captureFps   = gameMode ? 120 : 60;
      const maxBitrate   = gameMode ? 25_000_000 : 15_000_000;
      const videoCodec   = gameMode ? "h264" : "vp9";
      const contentHint  = gameMode ? "motion" : "detail";

      // 4. Capture screen
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_VIDEO_OPTS(captureCursor, captureFps),
        // audio: true — let browser show "Share audio" natively.
        // Passing constraints causes Chrome to silently drop audio for whole-screen
        // capture (OS loopback can't satisfy sampleRate etc.).
        audio: true,
      } as DisplayMediaStreamOptions);

      const videoMediaTrack = displayStream.getVideoTracks()[0];
      // contentHint tells the encoder to optimise for text/edges vs. motion
      (videoMediaTrack as MediaStreamTrack & { contentHint?: string }).contentHint = contentHint;
      // Screen: prefer sharp resolution over framerate; game: prefer smooth framerate over resolution
      await videoMediaTrack.applyConstraints(
        { degradationPreference: gameMode ? "maintain-framerate" : "maintain-resolution" } as MediaTrackConstraints
      ).catch(() => {});
      rawScreenVideoTrackRef.current = videoMediaTrack;

      // userProvidedTrack=true — we manage the lifecycle so LiveKit won't stop it
      // on unpublishTrack (which would fire "ended" and kill the stream)
      const screenTrack = new LocalVideoTrack(videoMediaTrack, undefined, true);
      screenTrackRef.current = screenTrack;

      // No simulcast — degrades sharp text/edges and wastes upload bandwidth
      // scalabilityMode L1T3 (screen) = VP9 SVC temporal layers: SFU delivers the right
      // layer per viewer bandwidth without extra encode cost. H.264 doesn't support SVC.
      await room.localParticipant.publishTrack(screenTrack, {
        source: Track.Source.ScreenShare,
        videoCodec,
        ...(gameMode
          ? { videoCodecOptions: { h264StartBitrate: 12000 } }
          : { scalabilityMode: "L1T3", videoCodecOptions: { vp9StartBitrate: 10000 } }
        ),
        screenShareEncoding: { maxBitrate, maxFramerate: captureFps, priority: "high" },
      });

      if (videoRef.current) screenTrack.attach(videoRef.current);

      // Publish screen audio if the user opted in via the browser dialog
      const screenAudioTracks = displayStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        await publishScreenAudio(screenAudioTracks[0]);
        setNoScreenAudio(false);
      } else {
        // No screen audio — show a tip (especially relevant for game/window capture)
        setNoScreenAudio(true);
      }

      // Publish pre-captured mic (secured before screen dialog to avoid audio conflicts)
      if (preMicStream) {
        const micRaw = preMicStream.getAudioTracks()[0];
        if (micRaw && roomRef.current) {
          micRawTrackRef.current = micRaw;
          const micLive = new LocalAudioTrack(micRaw, undefined, true);
          micLiveTrackRef.current = micLive;
          await roomRef.current.localParticipant.publishTrack(micLive, {
            source: Track.Source.Microphone,
            audioPreset: { maxBitrate: 510_000 },
            dtx: true,
            forceStereo: true,
            red: true,
          });
          setMicMuted(false);
        }
      }

      // "ended" fires only when the user clicks "Stop sharing" in the browser UI.
      // Use the ref so we don't need stopStream in startStream's dep array.
      const endedHandler = () => stopStreamRef.current?.();
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
  }, [existingStreamId, streamTitle, description, thumbnail, captureAudio, captureCursor, gameMode, updateViewers, onStreamChange, publishScreenAudio]);

  const stopStream = useCallback(async () => {
    setShowPreview(false);

    // Cancel any active pause
    if (pauseTimerRef.current) {
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    pauseRawTrackRef.current?.stop();
    pauseRawTrackRef.current = null;
    pauseTrackRef.current    = null;
    pauseCanvasRef.current   = null;
    setIsPaused(false);
    setPauseSecondsLeft(0);

    // Remove "ended" listener before stopping the raw track
    videoEndedCleanupRef.current?.();
    videoEndedCleanupRef.current = null;
    rawScreenVideoTrackRef.current?.stop();
    rawScreenVideoTrackRef.current = null;
    screenTrackRef.current = null;

    micRawTrackRef.current?.stop();
    micRawTrackRef.current = null;
    micLiveTrackRef.current = null;

    // Tear down all audio sources (mixer or direct)
    audioSourcesRef.current.forEach(src => {
      try { src.gainNode?.disconnect();   } catch {}
      try { src.sourceNode?.disconnect(); } catch {}
      src.rawStream.getTracks().forEach(t => t.stop());
    });
    audioSourcesRef.current = [];
    setAudioSources([]);
    mixedTrackRef.current = null;
    mixerDestRef.current  = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
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

  // Keep stopStreamRef in sync so startStream can reference it without a dep cycle
  useEffect(() => { stopStreamRef.current = stopStream; }, [stopStream]);

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
      const captureFps  = gameMode ? 120 : 60;
      const maxBitrate  = gameMode ? 25_000_000 : 15_000_000;
      const videoCodec  = gameMode ? "h264" : "vp9";
      const contentHint = gameMode ? "motion" : "detail";

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_VIDEO_OPTS(captureCursor, captureFps),
        audio: true,
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
      (newVideoMediaTrack as MediaStreamTrack & { contentHint?: string }).contentHint = contentHint;
      await newVideoMediaTrack.applyConstraints(
        { degradationPreference: gameMode ? "maintain-framerate" : "maintain-resolution" } as MediaTrackConstraints
      ).catch(() => {});
      rawScreenVideoTrackRef.current = newVideoMediaTrack;

      const newScreenTrack = new LocalVideoTrack(newVideoMediaTrack, undefined, true);
      screenTrackRef.current = newScreenTrack;

      await roomRef.current.localParticipant.publishTrack(newScreenTrack, {
        source: Track.Source.ScreenShare,
        videoCodec,
        ...(gameMode
          ? { videoCodecOptions: { h264StartBitrate: 12000 } }
          : { scalabilityMode: "L1T3", videoCodecOptions: { vp9StartBitrate: 10000 } }
        ),
        screenShareEncoding: { maxBitrate, maxFramerate: captureFps, priority: "high" },
      });
      if (videoRef.current) newScreenTrack.attach(videoRef.current);
      if (showPreview && previewRef.current) newScreenTrack.attach(previewRef.current);

      // Handle new screen audio
      const newScreenAudioTracks = displayStream.getAudioTracks();
      if (newScreenAudioTracks.length > 0) {
        if (audioCtxRef.current) {
          // Mixer running — hot-swap screen source, no LiveKit republish needed
          removeFromMixer("screen");
          addToMixer("screen", "Screen Audio", new MediaStream([newScreenAudioTracks[0]]));
        } else {
          // No mixer yet — publish fresh (creates mixer)
          await publishScreenAudio(newScreenAudioTracks[0]);
        }
        setNoScreenAudio(false);
      } else {
        // New capture has no audio
        if (audioCtxRef.current) {
          removeFromMixer("screen");
        } else {
          if (screenAudioLiveTrackRef.current && roomRef.current) {
            await roomRef.current.localParticipant.unpublishTrack(screenAudioLiveTrackRef.current);
            screenAudioLiveTrackRef.current = null;
          }
          screenAudioRawTrackRef.current?.stop();
          screenAudioRawTrackRef.current = null;
          audioSourcesRef.current = audioSourcesRef.current.filter(s => s.id !== "screen");
          setAudioSources([...audioSourcesRef.current]);
        }
        setNoScreenAudio(true);
      }

      // Wire up new "ended" listener
      const endedHandler = () => stopStreamRef.current?.();
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
  }, [captureCursor, gameMode, showPreview, publishScreenAudio, addToMixer, removeFromMixer, stopStream]);

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

    // Heartbeat runs continuously — including when the user is gaming in another window.
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 25_000);

    // End the stream only when the tab or browser is actually closed (not on alt-tab).
    // fetch with keepalive:true survives page unload; pagehide fires on tab close and
    // browser close, unlike beforeunload which is unreliable on mobile.
    function onPageHide() {
      const id = streamIdRef.current;
      if (!id) return;
      fetch(`/api/streams/${id}`, { method: "PATCH", keepalive: true }).catch(() => {});
    }

    window.addEventListener("pagehide",     onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      clearInterval(heartbeatIntervalRef.current!);
      heartbeatIntervalRef.current = null;
      window.removeEventListener("pagehide",     onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [status, sendHeartbeat]);

  useEffect(() => { return () => { roomRef.current?.disconnect(); }; }, []);

  // Chrome suspends AudioContext when the tab is hidden (broadcaster alt-tabs to their game).
  // 1. Resume immediately when they return to the tab.
  // 2. Poll every 3 s while live so suspended contexts are caught before the user notices.
  //    (3 s is fast enough to be imperceptible, slow enough to be cheap.)
  useEffect(() => {
    function resumeCtx() {
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", resumeCtx);
    const id = setInterval(resumeCtx, 3_000);
    return () => {
      document.removeEventListener("visibilitychange", resumeCtx);
      clearInterval(id);
    };
  }, []);

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
    if (mixedTrackRef.current?.readyState === "live") tracks.push(mixedTrackRef.current);
    if (micRawTrackRef.current?.readyState === "live") tracks.push(micRawTrackRef.current);

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

                <button
                  onClick={() => setGameMode((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-[0.8125rem] font-display font-semibold transition-colors"
                  style={{
                    borderColor: gameMode ? "rgba(234,179,8,0.4)" : "var(--border-subtle)",
                    background:  gameMode ? "rgba(234,179,8,0.08)" : "var(--bg-card)",
                    color:       gameMode ? "#eab308" : "var(--text-muted)",
                  }}
                >
                  <Gamepad2 size={13} />
                  {gameMode ? "Game mode" : "Screen mode"}
                </button>
              </div>

              {gameMode && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px] bg-yellow-500/6 border border-yellow-500/20 text-yellow-300/80 text-[0.75rem] leading-relaxed">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <span>
                    <b>Game mode</b>: uses H.264 hardware encoding (less CPU) and 30 fps.
                    For game audio, select <b>Entire Screen</b> in the browser dialog and check <b>Share system audio</b>.
                  </span>
                </div>
              )}
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
          <div
            className="absolute top-3 left-3 flex items-center gap-1.5 rounded-[5px] py-[0.2rem] px-2.5 z-10"
            style={{ background: isPaused ? "#92400e" : "#dc2626" }}
          >
            {isPaused
              ? <Pause size={9} color="white" />
              : <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            <span className="text-[0.6875rem] font-bold text-white font-display tracking-[0.06em] uppercase">
              {isPaused ? "Paused" : "Live"}
            </span>
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
            disabled={switchingScreen || isPaused}
            title="Switch capture window"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[0.8125rem] font-display font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] hover:border-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={13} className={switchingScreen ? "animate-spin" : ""} />
            {switchingScreen ? "Switching…" : "Switch window"}
          </button>

          {/* Pause / Resume */}
          {isPaused ? (
            <button
              onClick={() => resumeFromPauseRef.current?.()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border text-[0.8125rem] font-display font-semibold transition-colors"
              style={{ borderColor: "rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.08)", color: "#eab308" }}
            >
              <Play size={13} />
              Resume ({Math.floor(pauseSecondsLeft / 60)}:{String(pauseSecondsLeft % 60).padStart(2, "0")})
            </button>
          ) : (
            <div ref={pauseMenuRef} className="relative">
              <button
                onClick={() => setShowPauseMenu(v => !v)}
                title="Pause stream"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[0.8125rem] font-display font-semibold text-[var(--text-muted)] transition-colors hover:text-orange-400 hover:border-orange-500/30"
              >
                <Timer size={13} />
                Pause
                <ChevronDown size={10} className={`transition-transform duration-150 ${showPauseMenu ? "rotate-180" : ""}`} />
              </button>

              {showPauseMenu && (
                <div
                  className="absolute bottom-[calc(100%+6px)] left-0 bg-[#111]/95 backdrop-blur-sm border border-white/10 rounded-[10px] shadow-xl overflow-hidden z-30"
                  style={{ animation: "slideDownIn 0.12s ease both" }}
                >
                  {([1, 3, 5] as const).map(mins => (
                    <button
                      key={mins}
                      onClick={() => pauseStream(mins)}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-[0.8125rem] text-white/80 hover:bg-white/10 transition-colors text-left whitespace-nowrap"
                    >
                      <Pause size={12} className="text-orange-400 shrink-0" />
                      Pause {mins} {mins === 1 ? "minute" : "minutes"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Audio Sources panel ── */}
      {status === "live" && (
        <div className="flex flex-col gap-2 px-3 py-2.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-display font-bold tracking-[0.06em] uppercase text-[var(--text-muted)]">
              Audio Sources
            </span>
            <button
              onClick={addTabAudio}
              disabled={addingTab}
              className="flex items-center gap-1 px-2 py-0.5 rounded-[5px] border border-[var(--border-subtle)] text-[0.75rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={11} />
              {addingTab ? "Selecting…" : "Add tab audio"}
            </button>
          </div>

          {audioSources.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {audioSources.map(src => (
                <div key={src.id} className="flex items-center gap-2 py-1">
                  <button
                    onClick={() => toggleSourceMute(src.id)}
                    title={src.muted ? "Unmute in stream" : "Mute in stream"}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-[5px] border transition-colors ${
                      src.muted
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-emerald-500/30 bg-emerald-500/8 text-emerald-400"
                    }`}
                  >
                    {src.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                  <span className={`flex-1 text-[0.8125rem] truncate ${src.muted ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]"}`}>
                    {src.label}
                  </span>
                  {src.id !== "screen" && (
                    <button
                      onClick={() => removeFromMixer(src.id)}
                      title="Remove source"
                      className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.75rem] text-[var(--text-muted)]">
              No audio sources. Add a browser tab to include its audio in the stream.
            </p>
          )}
        </div>
      )}

      {/* ── Inline viewer preview panel ── */}
      {showPreview && status === "live" && (
        <div className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[#0a0a0a]">
          <div className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <span className="text-[0.75rem] font-display font-semibold text-[var(--text-secondary)] shrink-0">Viewer Preview</span>

            <div className="flex items-end gap-3 flex-1">
              <AudioLevelBar track={mixedTrackRef.current} label="Stream" />
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

      {/* No screen audio tip */}
      {noScreenAudio && status === "live" && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-[10px] border border-blue-500/20 bg-blue-500/6 text-blue-300/80 text-[0.75rem] leading-relaxed">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            No screen audio detected. For game/app audio, restart and select <b>Entire Screen</b> instead of a window, then check <b>Share system audio</b> in the browser dialog.
          </span>
        </div>
      )}

      {/* Reconnecting banner */}
      {isReconnecting && status === "live" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] border border-blue-500/30 bg-blue-500/8 text-blue-300">
          <Loader2 size={15} className="shrink-0 animate-spin" />
          <span className="text-[0.8125rem] font-display font-semibold">Reconnecting to LiveKit…</span>
        </div>
      )}

      {/* Poor connection warning */}
      {poorConnection && !isReconnecting && status === "live" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] border border-orange-500/30 bg-orange-500/8 text-orange-300">
          <WifiOff size={15} className="shrink-0" />
          <span className="text-[0.8125rem] font-display font-semibold">Poor connection — viewers may see lag</span>
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
