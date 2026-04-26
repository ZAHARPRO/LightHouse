"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Music2, Users, Lock, Play, Pause, SkipForward, SkipBack,
  Loader2, X, Copy, Check, Volume2, Search, LogOut, Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSpotifySDK } from "@/hooks/useSpotifySDK";

type Member = { id: string; name: string | null; image: string | null; at: number };

type LobbyData = {
  id: string;
  name: string | null;
  status: string;
  hasPassword: boolean;
  trackUri: string | null;
  trackName: string | null;
  trackArtist: string | null;
  trackImage: string | null;
  positionMs: number;
  isPlaying: boolean;
  elapsedMs: number;
  members: Member[];
  host: { id: string; name: string | null; image: string | null };
};

type Track = {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
};

function fmtMs(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ProgressBar({ position, duration, onSeek }: { position: number; duration: number; onSeek: (ms: number) => void }) {
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div>
      <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(Math.floor(((e.clientX - rect.left) / rect.width) * duration));
        }}>
        <div className="h-full bg-[#1DB954] rounded-full group-hover:bg-green-400 transition-colors"
          style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtMs(position)}</span>
        <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtMs(duration)}</span>
      </div>
    </div>
  );
}

export default function MusicLobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinPass, setJoinPass] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Spotify token for SDK
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [hasSpotify, setHasSpotify] = useState(true);

  // Search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const isHost = lobby?.host.id === session?.user?.id;

  // Web Playback SDK
  const { deviceId, state: sdkState, error: sdkError, ready: sdkReady, controls } = useSpotifySDK(spotifyToken);
  const isPremiumError = sdkError?.includes("Premium");
  const transferredRef = useRef(false);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/spotify-lobbies/${lobbyId}`, { cache: "no-store" });
    if (!res.ok) { setError("Lobby not found or closed."); return; }
    const data = await res.json() as LobbyData;
    if (data.status !== "ACTIVE") { setError("This lobby has been closed."); return; }
    setLobby(data);
  }, [lobbyId]);

  // Fetch Spotify token for SDK
  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/spotify/token");
    if (res.status === 404) { setHasSpotify(false); return; }
    if (res.ok) {
      const { token } = await res.json() as { token: string };
      setSpotifyToken(token);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "loading" || !session?.user?.id) return;
    fetchLobby();
    fetchToken();
  }, [authStatus, session?.user?.id, fetchLobby, fetchToken]);

  // Poll lobby every 3s
  useEffect(() => {
    if (!session?.user?.id) return;
    pollRef.current = setInterval(fetchLobby, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.user?.id, fetchLobby]);

  // Transfer playback to browser when SDK is ready
  useEffect(() => {
    if (!sdkReady || !deviceId || transferredRef.current) return;
    transferredRef.current = true;
    fetch("/api/spotify/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer", deviceId, play: false }),
    });
  }, [sdkReady, deviceId]);

  // Guest: auto-sync to host track when SDK is ready and lobby has a track
  useEffect(() => {
    if (isHost || !sdkReady || !deviceId || !lobby?.trackUri) return;
    if (sdkState?.track_window.current_track.uri === lobby.trackUri) return;
    const estimated = lobby.positionMs + (lobby.isPlaying ? lobby.elapsedMs : 0);
    fetch("/api/spotify/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "play", uri: lobby.trackUri, positionMs: estimated }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.trackUri, sdkReady, deviceId, isHost]);

  // Host: auto-sync SDK state to lobby every 5s
  useEffect(() => {
    if (!isHost || !joined || !sdkState) return;
    const track = sdkState.track_window.current_track;
    const push = () => fetch(`/api/spotify-lobbies/${lobbyId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackUri:    track.uri,
        trackName:   track.name,
        trackArtist: track.artists.map(a => a.name).join(", "),
        trackImage:  track.album.images[0]?.url ?? null,
        positionMs:  sdkState.position,
        isPlaying:   !sdkState.paused,
      }),
    });
    syncRef.current = setInterval(push, 5000);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [isHost, joined, sdkState, lobbyId]);

  // Heartbeat membership every 15s
  useEffect(() => {
    if (!joined || !session?.user?.id) return;
    const beat = () => fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
    heartbeatRef.current = setInterval(beat, 15_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [joined, session?.user?.id, lobbyId]);

  // Auto-join
  useEffect(() => {
    if (!lobby || joined || !session?.user?.id) return;
    if (isHost || !lobby.hasPassword) handleJoin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.id, isHost, session?.user?.id]);

  // Search debounce
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQ.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQ.trim())}`);
      if (res.ok) {
        const data = await res.json() as { tracks: Track[] };
        setSearchResults(data.tracks ?? []);
        setSearchOpen(true);
      }
      setSearching(false);
    }, 350);
  }, [searchQ]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function handleJoin(pass?: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: (pass ?? joinPass) || undefined }),
      });
      if (res.ok) setJoined(true);
      else { const d = await res.json(); setError(d.error ?? "Could not join lobby"); }
    } finally { setJoining(false); }
  }

  async function playTrack(uri: string) {
    setSearchOpen(false);
    setSearchQ("");
    if (sdkReady) {
      // Play via SDK (browser)
      await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "play", uri, positionMs: 0 }),
      });
      if (isHost) {
        await fetch(`/api/spotify-lobbies/${lobbyId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackUri: uri, positionMs: 0, isPlaying: true }),
        });
      }
    }
  }

  async function leaveLobby() {
    setLeaving(true);
    controls.pause?.();
    await fetch(`/api/spotify-lobbies/${lobbyId}`, { method: "DELETE" }).catch(() => {});
    router.push("/feed");
  }

  async function closeLobby() {
    controls.pause?.();
    await fetch(`/api/spotify-lobbies/${lobbyId}`, { method: "DELETE" });
    router.push("/feed");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const track = sdkState?.track_window.current_track;
  const estimatedPos = lobby
    ? lobby.positionMs + (lobby.isPlaying ? Math.min(lobby.elapsedMs, 300_000) : 0)
    : 0;

  // ── Loading / auth guards ──────────────────────────────────────────────────
  if (authStatus === "loading") return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

  if (!session?.user) return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center">
      <Music2 size={36} className="mx-auto mb-4 text-[#1DB954]" />
      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-2">Music Lobby</h1>
      <p className="text-[var(--text-muted)] mb-6">Sign in to join this listening session.</p>
      <Link href="/auth/signin" className="btn-primary px-6 py-2 no-underline">Sign In</Link>
    </main>
  );

  if (error) return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center">
      <Music2 size={36} className="mx-auto mb-4 text-[var(--text-muted)] opacity-40" />
      <p className="text-[var(--text-primary)] font-display font-bold text-lg mb-2">{error}</p>
      <Link href="/feed" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-primary)]">← Back to feed</Link>
    </main>
  );

  if (!lobby) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

  if (!joined && !isHost && lobby.hasPassword) return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 text-center">
        <Lock size={28} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <h2 className="font-display font-extrabold text-[var(--text-primary)] text-xl mb-1">
          {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
        </h2>
        <p className="text-[var(--text-muted)] text-sm mb-4">This lobby is password protected.</p>
        <input type="password" value={joinPass} onChange={e => setJoinPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          placeholder="Enter password"
          className="w-full mb-3 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#1DB954]/50 text-sm"
        />
        <button onClick={() => handleJoin()} disabled={joining}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1DB954] text-black font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {joining && <Loader2 size={14} className="animate-spin" />}
          Join Lobby
        </button>
      </div>
    </main>
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/feed" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Feed</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Music2 size={20} className="text-[#1DB954]" />
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">
              {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
            </h1>
            {lobby.hasPassword && <Lock size={14} className="text-[var(--text-muted)]" />}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[var(--text-muted)] text-sm">Hosted by {lobby.host.name ?? "Anonymous"}</p>
            {sdkReady && (
              <span className="flex items-center gap-1 text-[0.65rem] text-[#1DB954] font-bold">
                <Wifi size={10} /> In-browser
              </span>
            )}
            {isPremiumError && (
              <span className="text-[0.65rem] text-yellow-400">Premium required for in-browser audio</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
            {copied ? <Check size={12} className="text-[#1DB954]" /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {isHost ? (
            <button onClick={closeLobby}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-display font-semibold hover:bg-red-500/20 transition-colors">
              <X size={12} /> Close Lobby
            </button>
          ) : (
            <button onClick={leaveLobby} disabled={leaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-red-400 hover:border-red-500/30 transition-colors">
              {leaving ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
              Leave
            </button>
          )}
        </div>
      </div>

      {/* No Spotify connected */}
      {!hasSpotify && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">Connect Spotify to search and play music.</p>
          <a href="/api/spotify/connect"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1DB954] text-black text-xs font-display font-bold hover:opacity-90 transition-opacity no-underline">
            Connect Spotify
          </a>
        </div>
      )}

      {/* Search */}
      {hasSpotify && (
        <div ref={searchRef} className="relative mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              placeholder="Search tracks…"
              className="w-full h-[42px] pl-9 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm outline-none focus:border-[#1DB954]/50 transition-colors placeholder:text-[var(--text-muted)]"
            />
            {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.98)] backdrop-blur-xl shadow-2xl overflow-hidden">
              {searchResults.map(t => (
                <button key={t.id} onClick={() => playTrack(t.uri)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left">
                  {t.album.images[0]?.url
                    ? <Image src={t.album.images[0].url} alt="" width={36} height={36} className="rounded-md shrink-0" />
                    : <div className="w-9 h-9 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center shrink-0"><Music2 size={14} className="text-[var(--text-muted)]" /></div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{t.name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{t.artists.map(a => a.name).join(", ")} · {t.album.name}</p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">{fmtMs(t.duration_ms)}</span>
                  <span className="shrink-0 px-2 py-1 rounded-md bg-[#1DB954]/15 text-[#1DB954] text-[0.65rem] font-bold flex items-center gap-1">
                    <Play size={9} /> Play
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        {/* Player */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5">

          {/* SDK player (host controls / guest sees host track) */}
          {sdkReady && (isHost ? track : lobby.trackName) ? (
            <div>
              {/* Album art + info */}
              <div className="flex items-center gap-4 mb-4">
                {(isHost ? track?.album.images[0]?.url : lobby.trackImage) ? (
                  <Image
                    src={(isHost ? track?.album.images[0]?.url : lobby.trackImage) as string}
                    alt="" width={80} height={80} className="rounded-xl shadow-lg shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                    <Music2 size={28} className="text-[var(--text-muted)]" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-display font-extrabold text-[var(--text-primary)] text-lg truncate leading-tight">
                    {isHost ? track?.name : lobby.trackName}
                  </p>
                  <p className="text-[var(--text-muted)] text-sm truncate">
                    {isHost ? track?.artists.map(a => a.name).join(", ") : lobby.trackArtist}
                  </p>
                  {isHost && track && (
                    <p className="text-[var(--text-muted)] text-xs truncate opacity-60">{track.album.name}</p>
                  )}
                </div>
              </div>

              {/* Progress bar (host only, SDK gives real-time position) */}
              {isHost && sdkState ? (
                <div className="mb-4">
                  <ProgressBar
                    position={sdkState.position}
                    duration={sdkState.duration}
                    onSeek={ms => controls.seek(ms)}
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${lobby.isPlaying ? "bg-[#1DB954] animate-pulse" : "bg-[var(--text-muted)]"}`} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {lobby.isPlaying ? `Playing · ~${fmtMs(estimatedPos)}` : "Paused by host"}
                    </span>
                  </div>
                </div>
              )}

              {/* Controls (host only) */}
              {isHost && (
                <>
                  <div className="flex items-center justify-center gap-5 mb-3">
                    <button onClick={() => controls.prev()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <SkipBack size={22} />
                    </button>
                    <button
                      onClick={() => sdkState?.paused ? controls.resume() : controls.pause()}
                      className="w-12 h-12 rounded-full bg-[#1DB954] flex items-center justify-center text-black hover:scale-105 transition-transform"
                    >
                      {sdkState?.paused ? <Play size={20} /> : <Pause size={20} />}
                    </button>
                    <button onClick={() => controls.next()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <SkipForward size={22} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={1} step={0.01} defaultValue={0.7}
                      onChange={e => controls.setVolume(Number(e.target.value))}
                      className="flex-1 h-1 accent-[#1DB954] cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Guest: volume only */}
              {!isHost && sdkState && (
                <div className="flex items-center gap-2 mt-2">
                  <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                  <input type="range" min={0} max={1} step={0.01} defaultValue={0.7}
                    onChange={e => controls.setVolume(Number(e.target.value))}
                    className="flex-1 h-1 accent-[#1DB954] cursor-pointer"
                  />
                </div>
              )}

              <p className="text-[0.6rem] text-[var(--text-muted)] text-center mt-3 opacity-60">
                {isHost ? "Playing in browser · broadcast to guests every 5s" : "Playing in browser · synced to host"}
              </p>
            </div>
          ) : sdkReady && !track && isHost ? (
            <div className="text-center py-6">
              <Music2 size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
              <p className="text-[var(--text-muted)] text-sm">Search a track above to start playing.</p>
            </div>
          ) : !sdkReady && !hasSpotify ? (
            <div className="text-center py-6">
              <Music2 size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
              <p className="text-[var(--text-muted)] text-sm mb-1">Connect Spotify to hear music.</p>
            </div>
          ) : !sdkReady ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={22} className="animate-spin text-[#1DB954]" />
              <p className="text-[var(--text-muted)] text-sm">Connecting to Spotify…</p>
              {isPremiumError && (
                <p className="text-yellow-400 text-xs text-center max-w-xs">
                  Spotify Premium is required for in-browser playback.
                  Without Premium you can still use the Spotify app on your device.
                </p>
              )}
            </div>
          ) : (
            // Guest without SDK ready yet — show host's current track info
            lobby.trackName ? (
              <div className="text-center py-4">
                {lobby.trackImage && (
                  <Image src={lobby.trackImage} alt="" width={64} height={64} className="mx-auto rounded-xl mb-3 shadow-md" />
                )}
                <p className="font-display font-bold text-[var(--text-primary)] truncate">{lobby.trackName}</p>
                <p className="text-[var(--text-muted)] text-sm truncate mb-2">{lobby.trackArtist}</p>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${lobby.isPlaying ? "bg-[#1DB954] animate-pulse" : "bg-[var(--text-muted)]"}`} />
                  <span className="text-xs text-[var(--text-muted)]">{lobby.isPlaying ? "Playing" : "Paused"}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Music2 size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
                <p className="text-[var(--text-muted)] text-sm">Waiting for host to play something…</p>
              </div>
            )
          )}
        </div>

        {/* Listeners */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:w-52">
          <div className="flex items-center gap-2 mb-3">
            <Users size={13} className="text-[var(--text-muted)]" />
            <span className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Listeners ({lobby.members.length})
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)]">
            {lobby.host.image
              ? <Image src={lobby.host.image} alt="" width={28} height={28} className="rounded-full shrink-0" />
              : <div className="w-7 h-7 rounded-full bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954] text-xs font-bold">{lobby.host.name?.[0] ?? "?"}</div>
            }
            <div className="min-w-0">
              <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{lobby.host.name ?? "Host"}</p>
              <p className="text-[0.6rem] text-[#1DB954]">host</p>
            </div>
          </div>

          {lobby.members.filter(m => m.id !== lobby.host.id).map(m => (
            <div key={m.id} className="flex items-center gap-2 mb-2">
              {m.image
                ? <Image src={m.image} alt="" width={24} height={24} className="rounded-full shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] text-[0.6rem] font-bold">{m.name?.[0] ?? "?"}</div>
              }
              <p className="text-xs text-[var(--text-secondary)] truncate">{m.name ?? "Anonymous"}</p>
            </div>
          ))}

          {lobby.members.length === 0 && (
            <p className="text-[0.65rem] text-[var(--text-muted)] text-center py-4">No listeners yet</p>
          )}
        </div>
      </div>

      {/* Share */}
      <div className="mt-4 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-[var(--text-muted)]">
          Share in <Link href="/chat" className="text-[#1DB954] hover:underline">global chat</Link> · Premium plays in browser, free users need Spotify app open
        </p>
        <button onClick={copyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[#1DB954] hover:border-[#1DB954]/40 transition-colors shrink-0">
          {copied ? <Check size={11} className="text-[#1DB954]" /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </main>
  );
}
