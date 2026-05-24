"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, RemoteTrack, Track, RemoteParticipant } from "livekit-client";
import { Monitor, Wifi, WifiOff, Loader2 } from "lucide-react";

type Status = "connecting" | "live" | "offline" | "error";

export default function StreamViewer() {
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);

  const attachTrack = useCallback((track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video && videoRef.current) {
      track.attach(videoRef.current);
      setStatus("live");
    }
  }, []);

  const detachTrack = useCallback((track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video && videoRef.current) {
      track.detach(videoRef.current);
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch("/api/livekit/token", { method: "POST" });
        if (!res.ok) throw new Error("Failed to get token");
        const { token } = await res.json();

        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!wsUrl) throw new Error("LiveKit URL not configured");

        const room = new Room();
        if (cancelled) return;
        roomRef.current = room;

        // Attach any tracks already published when we join
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => attachTrack(track));
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => detachTrack(track));

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        // Check for existing published tracks (broadcaster already live)
        let foundTrack = false;
        room.remoteParticipants.forEach((participant: RemoteParticipant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.kind === Track.Kind.Video) {
              attachTrack(pub.track as RemoteTrack);
              foundTrack = true;
            }
          });
        });

        if (!foundTrack) setStatus("offline");
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
  }, [attachTrack, detachTrack]);

  return (
    <div className="flex flex-col gap-5">
      {/* Player */}
      <div className="w-full aspect-video rounded-[14px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] relative flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-contain"
          style={{ display: status === "live" ? "block" : "none" }}
        />

        {status !== "live" && (
          <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
            {status === "connecting" ? (
              <Loader2 size={40} strokeWidth={1.2} className="animate-spin" />
            ) : (
              <Monitor size={48} strokeWidth={1.2} />
            )}
            <span className="text-sm font-display">
              {status === "connecting" && "Connecting…"}
              {status === "offline" && "No active stream"}
              {status === "error" && (error ?? "Connection error")}
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
      </div>

      {/* Status line */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        {status === "live" ? (
          <><Wifi size={12} className="text-emerald-400" /> Live stream active</>
        ) : (
          <><WifiOff size={12} /> Waiting for admin to start a stream</>
        )}
      </div>
    </div>
  );
}
