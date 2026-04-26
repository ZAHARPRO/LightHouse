"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Music2, Users, Lock, Play, Pause, SkipForward, SkipBack,
  Loader2, X, Copy, Check, Volume2, Search, LogOut,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMusicContext } from "@/contexts/MusicContext";

type Member = { id: string; name: string | null; image: string | null; at: number };

type LobbyData = {
  id: string;
  name: string | null;
  status: string;
  hasPassword: boolean;
  trackUri: string | null;   // = videoId
  trackName: string | null;  // = title
  trackArtist: string | null;// = channel
  trackImage: string | null; // = thumbnail
  positionMs: number;
  isPlaying: boolean;
  elapsedMs: number;
  members: Member[];
  host: { id: string; name: string | null; image: string | null };
};

type YTItem = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
};

function fmtMs(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function MusicLobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const music = useMusicContext();

  const [lobby, setLobby]   = useState<LobbyData | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [joinPass, setJoinPass] = useState("");
  const [joining, setJoining]   = useState(false);
  const [joined, setJoined]     = useState(false);
  const [copied, setCopied]     = useState(false);
  const [leaving, setLeaving]   = useState(false);

  // Search
  const [searchQ, setSearchQ]       = useState("");
  const [results, setResults]       = useState<YTItem[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchErr, setSearchErr]   = useState<string | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHost = lobby?.host.id === session?.user?.id;
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

  useEffect(() => {
    if (authStatus === "loading" || !session?.user?.id) return;
    fetchLobby();
  }, [authStatus, session?.user?.id, fetchLobby]);

  // Poll lobby every 3s
  useEffect(() => {
    if (!session?.user?.id) return;
    pollRef.current = setInterval(fetchLobby, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.user?.id, fetchLobby]);

  // Set active lobby in context
  useEffect(() => {
    if (!lobby) return;
    music.setActiveLobbyId(lobbyId);
    return () => music.setActiveLobbyId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.id, lobbyId]);

  // Guest: sync to host track when lobby changes
  useEffect(() => {
    if (!lobby || isHost || !lobby.trackUri) return;
    const currentUri = music.track?.videoId;
    if (currentUri === lobby.trackUri) return; // already playing this
    const estimated = lobby.positionMs + (lobby.isPlaying ? lobby.elapsedMs : 0);
    music.play(
      { videoId: lobby.trackUri, title: lobby.trackName ?? "", channel: lobby.trackArtist ?? "", thumbnail: lobby.trackImage ?? "" },
      estimated
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.trackUri, isHost]);

  // Host: push context state to lobby every 5s
  useEffect(() => {
    if (!isHost || !joined) return;
    const push = () => {
      if (!music.track) return;
      fetch(`/api/spotify-lobbies/${lobbyId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUri:    music.track.videoId,
          trackName:   music.track.title,
          trackArtist: music.track.channel,
          trackImage:  music.track.thumbnail,
          positionMs:  music.positionMs,
          isPlaying:   music.isPlaying,
        }),
      });
    };
    syncRef.current = setInterval(push, 5000);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [isHost, joined, music.track, music.positionMs, music.isPlaying, lobbyId]);

  // Heartbeat
  useEffect(() => {
    if (!joined || !session?.user?.id) return;
    const beat = () => fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
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

  // Search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setResults([]); setSearchOpen(false); setSearchErr(null); return; }
    setSearching(true);
    setSearchErr(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQ.trim())}`);
        if (res.ok) {
          const d = await res.json() as { items: YTItem[] };
          setResults(d.items ?? []);
          setSearchOpen(true);
          if ((d.items ?? []).length === 0) setSearchErr("No results found.");
        } else {
          const d = await res.json().catch(() => ({})) as { error?: string };
          setSearchErr(d.error === "No API key" ? "YouTube API key not configured." : "Search failed. Try again.");
          setSearchOpen(true);
        }
      } catch {
        setSearchErr("Network error. Check your connection.");
        setSearchOpen(true);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [searchQ]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  async function handleJoin(pass?: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: (pass ?? joinPass) || undefined }),
      });
      if (res.ok) setJoined(true);
      else { const d = await res.json(); setError(d.error ?? "Could not join"); }
    } finally { setJoining(false); }
  }

  function playTrack(item: YTItem) {
    setSearchOpen(false); setSearchQ("");
    music.play({ videoId: item.videoId, title: item.title, channel: item.channel, thumbnail: item.thumbnail });
    if (isHost) {
      fetch(`/api/spotify-lobbies/${lobbyId}/sync`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: item.videoId, trackName: item.title, trackArtist: item.channel, trackImage: item.thumbnail, positionMs: 0, isPlaying: true }),
      });
    }
  }

  async function leaveLobby() {
    setLeaving(true);
    music.pause();
    await fetch(`/api/spotify-lobbies/${lobbyId}`, { method: "DELETE" }).catch(() => {});
    router.push("/feed");
  }

  async function closeLobby() {
    music.pause();
    await fetch(`/api/spotify-lobbies/${lobbyId}`, { method: "DELETE" });
    router.push("/feed");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const duration  = music.playerRef.current ? music.playerRef.current.getDuration() * 1000 : 0;
  const pct       = duration > 0 ? Math.min(100, (music.positionMs / duration) * 100) : 0;
  const estimatedPos = lobby ? lobby.positionMs + (lobby.isPlaying ? Math.min(lobby.elapsedMs, 300_000) : 0) : 0;

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (authStatus === "loading") return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]" /></div>;

  if (!session?.user) return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center">
      <Music2 size={36} className="mx-auto mb-4 text-red-500" />
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

  if (!lobby) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]" /></div>;

  if (!joined && !isHost && lobby.hasPassword) return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 text-center">
        <Lock size={28} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <h2 className="font-display font-extrabold text-[var(--text-primary)] text-xl mb-1">{lobby.name || `${lobby.host.name ?? "?"}'s lobby`}</h2>
        <p className="text-[var(--text-muted)] text-sm mb-4">Password protected.</p>
        <input type="password" value={joinPass} onChange={e => setJoinPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          placeholder="Enter password"
          className="w-full mb-3 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40 text-sm"
        />
        <button onClick={() => handleJoin()} disabled={joining}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50">
          {joining && <Loader2 size={14} className="animate-spin" />} Join
        </button>
      </div>
    </main>
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/feed" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← Feed</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Music2 size={20} className="text-red-500" />
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">
              {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
            </h1>
            {lobby.hasPassword && <Lock size={14} className="text-[var(--text-muted)]" />}
          </div>
          <p className="text-[var(--text-muted)] text-sm">Hosted by {lobby.host.name ?? "Anonymous"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
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
              {leaving ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />} Leave
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            onFocus={() => results.length > 0 && setSearchOpen(true)}
            placeholder={isHost ? "Search YouTube and play for everyone…" : "Search YouTube…"}
            className="w-full h-[42px] pl-9 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm outline-none focus:border-red-500/40 placeholder:text-[var(--text-muted)]"
          />
          {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />}
        </div>

        {searchOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.98)] backdrop-blur-xl shadow-2xl overflow-hidden">
            {searchErr ? (
              <p className="px-4 py-3 text-sm text-[var(--text-muted)]">{searchErr}</p>
            ) : results.map(r => (
              <button key={r.videoId} onClick={() => playTrack(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left">
                <Image src={r.thumbnail} alt="" width={48} height={36} className="rounded shrink-0 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{r.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{r.channel}</p>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-md bg-red-500/15 text-red-400 text-[0.65rem] font-bold flex items-center gap-1">
                  <Play size={9} />{isHost ? "Play for all" : "Play for me"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        {/* Player card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5">
          <p className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            {isHost ? "Now Playing (you control)" : "Now Playing"}
          </p>

          {music.track ? (
            <div>
              <div className="flex items-center gap-4 mb-5">
                <Image src={music.track.thumbnail} alt="" width={88} height={88}
                  className="rounded-xl shadow-lg shrink-0 object-cover" />
                <div className="min-w-0">
                  <p className="font-display font-extrabold text-[var(--text-primary)] text-lg truncate leading-tight">{music.track.title}</p>
                  <p className="text-[var(--text-muted)] text-sm truncate">{music.track.channel}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
                  onClick={e => {
                    if (!isHost) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    music.seek(Math.floor(((e.clientX - rect.left) / rect.width) * duration));
                  }}>
                  <div className="h-full bg-red-500 rounded-full group-hover:bg-red-400 transition-colors"
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtMs(music.positionMs)}</span>
                  <span className="text-[0.65rem] text-[var(--text-muted)]">{fmtMs(duration)}</span>
                </div>
              </div>

              {/* Controls — host only */}
              {isHost && (
                <>
                  <div className="flex items-center justify-center gap-5 mb-4">
                    <button onClick={music.prev} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipBack size={22} /></button>
                    <button onClick={music.isPlaying ? music.pause : music.resume}
                      className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-105 transition-transform">
                      {music.isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button onClick={music.next} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipForward size={22} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100} defaultValue={70}
                      onChange={e => music.setVolume(Number(e.target.value))}
                      className="flex-1 h-1 accent-red-500 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Guest: volume only */}
              {!isHost && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-xs text-[var(--text-muted)]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${lobby.isPlaying ? "bg-red-500 animate-pulse" : "bg-[var(--text-muted)]"}`} />
                    {lobby.isPlaying ? `Playing · ~${fmtMs(estimatedPos)}` : "Paused by host"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100} defaultValue={70}
                      onChange={e => music.setVolume(Number(e.target.value))}
                      className="flex-1 h-1 accent-red-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <p className="text-[0.6rem] text-[var(--text-muted)] text-center mt-3 opacity-60">
                {isHost ? "Audio plays here · guests hear the same track" : "Synced to host · plays in your browser"}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Music2 size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
              <p className="text-[var(--text-muted)] text-sm">
                {isHost ? "Search a track above to start playing for everyone" : "Waiting for host to play something…"}
              </p>
            </div>
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
              : <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">{lobby.host.name?.[0] ?? "?"}</div>
            }
            <div className="min-w-0">
              <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{lobby.host.name ?? "Host"}</p>
              <p className="text-[0.6rem] text-red-400">host</p>
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
          {lobby.members.length === 0 && <p className="text-[0.65rem] text-[var(--text-muted)] text-center py-4">No listeners yet</p>}
        </div>
      </div>

      {/* Share */}
      <div className="mt-4 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-[var(--text-muted)]">
          Share in <Link href="/chat" className="text-red-400 hover:underline">global chat</Link> · audio plays directly in browser for everyone
        </p>
        <button onClick={copyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-red-400 hover:border-red-500/30 transition-colors shrink-0">
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </main>
  );
}
