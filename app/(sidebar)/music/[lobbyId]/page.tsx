"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Music2, Users, Lock, Play, Pause, SkipForward, SkipBack,
  Loader2, X, Copy, Check, Volume2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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

type SpotifyState = {
  is_playing: boolean;
  progress_ms: number;
  item: {
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
  } | null;
  device: { volume_percent: number } | null;
} | null;

function fmtMs(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
  const [acting, setActing] = useState(false);

  const [myPlayer, setMyPlayer] = useState<SpotifyState>(undefined as unknown as SpotifyState);
  const [hasSpotify, setHasSpotify] = useState(true);

  const isHost = lobby?.host.id === session?.user?.id;
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/spotify-lobbies/${lobbyId}`, { cache: "no-store" });
    if (!res.ok) { setError("Lobby not found or closed."); return; }
    const data = await res.json() as LobbyData;
    if (data.status !== "ACTIVE") { setError("This lobby has been closed."); return; }
    setLobby(data);
  }, [lobbyId]);

  const fetchMyPlayer = useCallback(async () => {
    const res = await fetch("/api/spotify/player", { cache: "no-store" });
    if (res.status === 404) { setHasSpotify(false); return; }
    if (!res.ok) return;
    const data = await res.json() as SpotifyState;
    setMyPlayer(data);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session?.user?.id) return;
    fetchLobby();
    fetchMyPlayer();
  }, [authStatus, session?.user?.id, fetchLobby, fetchMyPlayer]);

  // Poll lobby every 3s
  useEffect(() => {
    if (!session?.user?.id) return;
    pollRef.current = setInterval(fetchLobby, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.user?.id, fetchLobby]);

  // Poll my player every 4s (host only, to push sync)
  useEffect(() => {
    if (!isHost || !joined) return;
    const interval = setInterval(fetchMyPlayer, 4000);
    return () => clearInterval(interval);
  }, [isHost, joined, fetchMyPlayer]);

  // Host: auto-sync player state to lobby every 5s
  useEffect(() => {
    if (!isHost || !joined) return;
    const push = async () => {
      if (!myPlayer?.item) return;
      await fetch(`/api/spotify-lobbies/${lobbyId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUri:    myPlayer.item.uri,
          trackName:   myPlayer.item.name,
          trackArtist: myPlayer.item.artists.map(a => a.name).join(", "),
          trackImage:  myPlayer.item.album.images[0]?.url ?? null,
          positionMs:  myPlayer.progress_ms,
          isPlaying:   myPlayer.is_playing,
        }),
      });
    };
    syncRef.current = setInterval(push, 5000);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [isHost, joined, myPlayer, lobbyId]);

  // Member heartbeat every 15s
  useEffect(() => {
    if (!joined || !session?.user?.id) return;
    const beat = () => fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: undefined }),
    }).catch(() => {});
    heartbeatRef.current = setInterval(beat, 15_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [joined, session?.user?.id, lobbyId]);

  // Auto-join (for host or public lobbies)
  useEffect(() => {
    if (!lobby || joined || !session?.user?.id) return;
    if (isHost || !lobby.hasPassword) {
      handleJoin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.id, isHost, session?.user?.id]);

  async function handleJoin(pass?: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: (pass ?? joinPass) || undefined }),
      });
      if (res.ok) setJoined(true);
      else {
        const d = await res.json();
        setError(d.error ?? "Could not join lobby");
      }
    } finally { setJoining(false); }
  }

  async function doPlayerAction(action: string, extra?: object) {
    setActing(true);
    await fetch("/api/spotify/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    await fetchMyPlayer();
    setActing(false);
  }

  async function syncToHost() {
    if (!lobby?.trackUri) return;
    const estimatedPos = lobby.positionMs + (lobby.isPlaying ? lobby.elapsedMs : 0);
    await doPlayerAction("play", { uri: lobby.trackUri, positionMs: estimatedPos });
  }

  async function closeLobby() {
    await fetch(`/api/spotify-lobbies/${lobbyId}`, { method: "DELETE" });
    router.push("/");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const estimatedPos = lobby
    ? lobby.positionMs + (lobby.isPlaying ? Math.min(lobby.elapsedMs, lobby.positionMs) : 0)
    : 0;

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
      <Link href="/" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-primary)]">← Back to home</Link>
    </main>
  );

  if (!lobby) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

  // Password gate for non-host
  if (!joined && !isHost && lobby.hasPassword) return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 text-center">
        <Lock size={28} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <h2 className="font-display font-extrabold text-[var(--text-primary)] text-xl mb-1">
          {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
        </h2>
        <p className="text-[var(--text-muted)] text-sm mb-4">This lobby is password protected.</p>
        <input
          type="password"
          value={joinPass}
          onChange={e => setJoinPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          placeholder="Enter password"
          className="w-full mb-3 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#1DB954]/50 text-sm"
        />
        <button onClick={() => handleJoin()} disabled={joining}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1DB954] text-black font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {joining ? <Loader2 size={14} className="animate-spin" /> : null}
          Join Lobby
        </button>
      </div>
    </main>
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Home</Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Music2 size={20} className="text-[#1DB954]" />
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">
              {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
            </h1>
            {lobby.hasPassword && <Lock size={14} className="text-[var(--text-muted)]" />}
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            Hosted by {lobby.host.name ?? "Anonymous"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
            {copied ? <Check size={12} className="text-[#1DB954]" /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {isHost && (
            <button onClick={closeLobby}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-display font-semibold hover:bg-red-500/20 transition-colors">
              <X size={12} /> Close Lobby
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">

        {/* Now Playing card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5">
          <p className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            {isHost ? "Your Player" : "Now Playing"}
          </p>

          {isHost ? (
            // Host sees their own player controls
            !hasSpotify ? (
              <div className="text-center py-6">
                <p className="text-[var(--text-muted)] text-sm mb-3">Connect Spotify to broadcast music.</p>
                <a href="/api/spotify/connect"
                  className="px-4 py-2 rounded-xl bg-[#1DB954] text-black text-sm font-display font-bold hover:opacity-90 transition-opacity no-underline inline-block">
                  Connect Spotify
                </a>
              </div>
            ) : !myPlayer ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-6">Open Spotify on any device to start playing.</p>
            ) : !myPlayer.item ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-6">Nothing playing on Spotify.</p>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  {myPlayer.item.album.images[0]?.url ? (
                    <Image src={myPlayer.item.album.images[0].url} alt="" width={72} height={72} className="rounded-xl shadow-md shrink-0" />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                      <Music2 size={24} className="text-[var(--text-muted)]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display font-bold text-[var(--text-primary)] truncate">{myPlayer.item.name}</p>
                    <p className="text-[var(--text-muted)] text-sm truncate">{myPlayer.item.artists.map(a => a.name).join(", ")}</p>
                    <p className="text-[var(--text-muted)] text-xs truncate opacity-70">{myPlayer.item.album.name}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      doPlayerAction("seek", { positionMs: Math.floor(pct * (myPlayer.item?.duration_ms ?? 1)) });
                    }}>
                    <div className="h-full bg-[#1DB954] rounded-full group-hover:bg-green-400 transition-colors"
                      style={{ width: `${Math.min(100, (myPlayer.progress_ms / (myPlayer.item.duration_ms || 1)) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtMs(myPlayer.progress_ms)}</span>
                    <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtMs(myPlayer.item.duration_ms)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-5 mb-3">
                  <button onClick={() => doPlayerAction("prev")} disabled={acting}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
                    <SkipBack size={20} />
                  </button>
                  <button onClick={() => doPlayerAction(myPlayer.is_playing ? "pause" : "play")} disabled={acting}
                    className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center text-black hover:scale-105 transition-transform disabled:opacity-50">
                    {acting ? <Loader2 size={16} className="animate-spin" /> :
                      myPlayer.is_playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button onClick={() => doPlayerAction("next")} disabled={acting}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
                    <SkipForward size={20} />
                  </button>
                </div>

                {myPlayer.device && (
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100}
                      defaultValue={myPlayer.device.volume_percent}
                      onChange={e => doPlayerAction("volume", { volume: Number(e.target.value) })}
                      className="flex-1 h-1 accent-[#1DB954] cursor-pointer"
                    />
                  </div>
                )}

                <p className="text-[0.65rem] text-[var(--text-muted)] text-center mt-3 opacity-70">
                  Your playback is broadcast to guests every 5s
                </p>
              </div>
            )
          ) : (
            // Guest sees lobby's current track
            !lobby.trackName ? (
              <div className="text-center py-6">
                <Music2 size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
                <p className="text-[var(--text-muted)] text-sm">Waiting for host to play something…</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  {lobby.trackImage ? (
                    <Image src={lobby.trackImage} alt="" width={72} height={72} className="rounded-xl shadow-md shrink-0" />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                      <Music2 size={24} className="text-[var(--text-muted)]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display font-bold text-[var(--text-primary)] truncate">{lobby.trackName}</p>
                    <p className="text-[var(--text-muted)] text-sm truncate">{lobby.trackArtist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${lobby.isPlaying ? "bg-[#1DB954] animate-pulse" : "bg-[var(--text-muted)]"}`} />
                  <span className="text-xs text-[var(--text-muted)]">
                    {lobby.isPlaying ? `Playing · ~${fmtMs(estimatedPos)}` : "Paused"}
                  </span>
                </div>

                {!hasSpotify ? (
                  <div className="mt-4 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                    <p className="text-[var(--text-muted)] text-xs mb-2">Connect Spotify to sync playback</p>
                    <a href="/api/spotify/connect"
                      className="px-4 py-1.5 rounded-lg bg-[#1DB954] text-black text-xs font-display font-bold hover:opacity-90 transition-opacity no-underline inline-block">
                      Connect Spotify
                    </a>
                  </div>
                ) : (
                  <button onClick={syncToHost} disabled={acting}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] font-display font-bold text-sm hover:bg-[#1DB954]/25 transition-colors disabled:opacity-50">
                    {acting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Sync &amp; Play
                  </button>
                )}
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

          {/* Host */}
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

      {/* Share hint */}
      <div className="mt-4 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--text-muted)]">
          Share this lobby link in{" "}
          <Link href="/chat" className="text-[#1DB954] hover:underline">global chat</Link>
          {" "}or anywhere else.
        </p>
        <button onClick={copyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[#1DB954] hover:border-[#1DB954]/40 transition-colors shrink-0">
          {copied ? <Check size={11} className="text-[#1DB954]" /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </main>
  );
}
