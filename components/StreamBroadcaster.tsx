"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, LocalVideoTrack, createLocalScreenTracks } from "livekit-client";
import { Monitor, MonitorOff, Wifi, WifiOff, Loader2 } from "lucide-react";

type Status = "idle" | "connecting" | "live" | "error";

export default function StreamBroadcaster() {
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);

  const updateViewers = useCallback((room: Room) => {
    // Count participants who are not us
    setViewerCount(room.remoteParticipants.size);
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    try {
      const res = await fetch("/api/livekit/token", { method: "POST" });
      if (!res.ok) throw new Error("Failed to get token");
      const { token } = await res.json();

      const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!wsUrl) throw new Error("LiveKit URL not configured");

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => updateViewers(room));
      room.on(RoomEvent.ParticipantDisconnected, () => updateViewers(room));

      await room.connect(wsUrl, token);
      updateViewers(room);

      const [screenTrack] = await createLocalScreenTracks({ audio: false });
      await room.localParticipant.publishTrack(screenTrack);

      // Preview the screen in local video element
      if (videoRef.current) {
        (screenTrack as LocalVideoTrack).attach(videoRef.current);
      }

      // Stop stream when user stops sharing via browser UI
      screenTrack.mediaStreamTrack.addEventListener("ended", () => {
        stopStream();
      });

      setStatus("live");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg.includes("Permission denied") || msg.includes("NotAllowedError")
        ? "Screen share permission denied"
        : msg);
      setStatus("error");
      roomRef.current?.disconnect();
      roomRef.current = null;
    }
  }, [updateViewers]);

  const stopStream = useCallback(async () => {
    if (roomRef.current) {
      const pubs = [...roomRef.current.localParticipant.trackPublications.values()];
      await Promise.all(pubs.map((p) => roomRef.current!.localParticipant.unpublishTrack(p.track!)));
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
    setViewerCount(0);
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* Preview */}
      <div className="w-full aspect-video rounded-[14px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] relative flex items-center justify-center">
        {status === "live" ? (
          <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
            <Monitor size={48} strokeWidth={1.2} />
            <span className="text-sm font-display">
              {status === "connecting" ? "Connecting…" : "No active stream"}
            </span>
          </div>
        )}

        {/* Live badge */}
        {status === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.2rem] px-2.5 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[0.6875rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
          </div>
        )}

        {/* Viewer count */}
        {status === "live" && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-[5px] py-[0.2rem] px-2 z-10">
            <Wifi size={11} color="#10b981" />
            <span className="text-[0.6875rem] text-white font-display">{viewerCount} watching</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-[8px] px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {status === "idle" || status === "error" ? (
          <button
            onClick={startStream}
            className="flex items-center gap-2 btn-primary py-2.5 px-5 text-sm"
          >
            <Monitor size={15} />
            Start Stream
          </button>
        ) : status === "connecting" ? (
          <button disabled className="flex items-center gap-2 btn-primary py-2.5 px-5 text-sm opacity-60 cursor-not-allowed">
            <Loader2 size={15} className="animate-spin" />
            Connecting…
          </button>
        ) : (
          <button
            onClick={stopStream}
            className="flex items-center gap-2 py-2.5 px-5 text-sm rounded-[9px] border border-red-500/40 bg-red-500/10 text-red-400 font-semibold transition-colors hover:bg-red-500/20"
          >
            <MonitorOff size={15} />
            Stop Stream
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {status === "live" ? (
            <><Wifi size={12} className="text-emerald-400" /> Streaming via LiveKit Cloud</>
          ) : (
            <><WifiOff size={12} /> Stream is offline</>
          )}
        </div>
      </div>
    </div>
  );
}
