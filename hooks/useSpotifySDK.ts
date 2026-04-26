"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifySDKPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifySDKPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: "ready",            cb: (d: { device_id: string }) => void): void;
  addListener(event: "not_ready",        cb: (d: { device_id: string }) => void): void;
  addListener(event: "player_state_changed", cb: (d: SDKState | null) => void): void;
  addListener(event: "initialization_error" | "authentication_error" | "account_error" | "playback_error", cb: (d: { message: string }) => void): void;
  removeListener(event: string): void;
  getCurrentState(): Promise<SDKState | null>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  setVolume(v: number): Promise<void>;
}

export interface SDKState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      uri: string;
      name: string;
      duration_ms: number;
      artists: { name: string }[];
      album: { name: string; images: { url: string }[] };
    };
  };
}

export function useSpotifySDK(token: string | null) {
  const [deviceId, setDeviceId]   = useState<string | null>(null);
  const [state, setState]         = useState<SDKState | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [ready, setReady]         = useState(false);
  const playerRef = useRef<SpotifySDKPlayer | null>(null);

  useEffect(() => {
    if (!token) return;

    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: "LightHouse Music",
        getOAuthToken: cb => cb(token),
        volume: 0.7,
      });

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setReady(true);
      });

      player.addListener("not_ready", () => {
        setReady(false);
        setDeviceId(null);
      });

      player.addListener("player_state_changed", s => setState(s));

      player.addListener("initialization_error", ({ message }) => setError(`Init: ${message}`));
      player.addListener("authentication_error", ({ message }) => setError(`Auth: ${message}`));
      player.addListener("account_error", () => setError("Spotify Premium required for in-browser playback"));
      player.addListener("playback_error", ({ message }) => setError(`Playback: ${message}`));

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      if (!document.getElementById("spotify-sdk-script")) {
        const script = document.createElement("script");
        script.id = "spotify-sdk-script";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setReady(false);
      setDeviceId(null);
    };
  }, [token]);

  const controls = {
    pause:    () => playerRef.current?.pause(),
    resume:   () => playerRef.current?.resume(),
    next:     () => playerRef.current?.nextTrack(),
    prev:     () => playerRef.current?.previousTrack(),
    seek:     (ms: number) => playerRef.current?.seek(ms),
    setVolume:(v: number)  => playerRef.current?.setVolume(v),
  };

  return { deviceId, state, error, ready, controls };
}
