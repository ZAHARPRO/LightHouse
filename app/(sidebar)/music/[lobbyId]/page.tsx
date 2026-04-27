"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Music2, Users, Lock, Play, Pause, SkipForward, SkipBack,
  Loader2, X, Copy, Check, Volume2, Search, LogOut,
  History, ListMusic, Plus, Trash2, Download, ChevronRight,
  Youtube,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMusicContext } from "@/contexts/MusicContext";

type Member = { id: string; name: string | null; image: string | null; at: number };
type HistoryItem = { videoId: string; title: string; channel: string; thumbnail: string; at: number };
type YTItem = { videoId: string; title: string; channel: string; thumbnail: string };
type Playlist = { id: string; name: string; tracks: YTItem[] };

type LobbyData = {
  id: string; name: string | null; status: string; hasPassword: boolean;
  trackUri: string | null; trackName: string | null; trackArtist: string | null; trackImage: string | null;
  positionMs: number; isPlaying: boolean; elapsedMs: number;
  members: Member[]; host: { id: string; name: string | null; image: string | null };
  history: HistoryItem[];
};

function fmtMs(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function timeAgo(at: number) {
  const d = Math.floor((Date.now() - at) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

type SideTab = "listeners" | "history" | "playlists";

export default function MusicLobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const music = useMusicContext();

  const [lobby, setLobby]         = useState<LobbyData | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [joinPass, setJoinPass]   = useState("");
  const [joining, setJoining]     = useState(false);
  const [joined, setJoined]       = useState(false);
  const [copied, setCopied]       = useState(false);
  const [leaving, setLeaving]     = useState(false);
  const [volume, setVolume]       = useState(70);
  const [sideTab, setSideTab]     = useState<SideTab>("listeners");

  // Search
  const [searchQ, setSearchQ]       = useState("");
  const [results, setResults]       = useState<YTItem[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchErr, setSearchErr]   = useState<string | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Playlists
  const [playlists, setPlaylists]         = useState<Playlist[]>([]);
  const [playlistsLoaded, setPlLoaded]    = useState(false);
  const [newPlName, setNewPlName]         = useState("");
  const [ytImportUrl, setYtImportUrl]     = useState("");
  const [importing, setImporting]         = useState(false);
  const [importErr, setImportErr]         = useState<string | null>(null);
  const [creatingPl, setCreatingPl]       = useState(false);
  const [showCreatePl, setShowCreatePl]   = useState(false);
  const [activeQueue, setActiveQueue]     = useState<YTItem[]>([]);
  const [queueIdx, setQueueIdx]           = useState(0);
  const [activePlaylistId, setActivePl]   = useState<string | null>(null);
  const [expandedPl, setExpandedPl]       = useState<string | null>(null);

  const isHost = lobby?.host.id === session?.user?.id;
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch lobby ────────────────────────────────────────────────────────────
  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/music-lobbies/${lobbyId}`, { cache: "no-store" });
    if (!res.ok) { setError("Lobby not found or closed."); return; }
    const data = await res.json() as LobbyData;
    if (data.status !== "ACTIVE") { setError("This lobby has been closed."); return; }
    setLobby(data);
  }, [lobbyId]);

  useEffect(() => {
    if (authStatus === "loading" || !session?.user?.id) return;
    fetchLobby();
  }, [authStatus, session?.user?.id, fetchLobby]);

  useEffect(() => {
    if (!session?.user?.id) return;
    pollRef.current = setInterval(fetchLobby, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.user?.id, fetchLobby]);

  // ── Context active lobby ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lobby) return;
    music.setActiveLobbyId(lobbyId);
    return () => music.setActiveLobbyId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.id, lobbyId]);

  // ── Guest: sync to host ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lobby || isHost || !lobby.trackUri) return;
    if (music.track?.videoId === lobby.trackUri) return;
    const estimated = lobby.positionMs + (lobby.isPlaying ? lobby.elapsedMs : 0);
    music.play(
      { videoId: lobby.trackUri, title: lobby.trackName ?? "", channel: lobby.trackArtist ?? "", thumbnail: lobby.trackImage ?? "" },
      estimated
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.trackUri, isHost]);

  // ── Host: push state every 5s ──────────────────────────────────────────────
  useEffect(() => {
    if (!isHost || !joined) return;
    const push = () => {
      if (!music.track) return;
      fetch(`/api/music-lobbies/${lobbyId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUri: music.track.videoId, trackName: music.track.title,
          trackArtist: music.track.channel, trackImage: music.track.thumbnail,
          positionMs: music.positionMs, isPlaying: music.isPlaying,
        }),
      });
    };
    syncRef.current = setInterval(push, 5000);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [isHost, joined, music.track, music.positionMs, music.isPlaying, lobbyId]);

  // ── Host: auto-advance playlist on track end ───────────────────────────────
  useEffect(() => {
    if (!isHost || music.playerState !== 0 || activeQueue.length === 0) return;
    const next = queueIdx + 1;
    if (next < activeQueue.length) {
      setQueueIdx(next);
      const item = activeQueue[next];
      music.play({ videoId: item.videoId, title: item.title, channel: item.channel, thumbnail: item.thumbnail });
      fetch(`/api/music-lobbies/${lobbyId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: item.videoId, trackName: item.title, trackArtist: item.channel, trackImage: item.thumbnail, positionMs: 0, isPlaying: true }),
      });
    } else {
      // Playlist finished
      setActiveQueue([]); setQueueIdx(0); setActivePl(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.playerState]);

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined || !session?.user?.id) return;
    const beat = () => fetch(`/api/music-lobbies/${lobbyId}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).catch(() => {});
    heartbeatRef.current = setInterval(beat, 15_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [joined, session?.user?.id, lobbyId]);

  // ── Auto-join ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lobby || joined || !session?.user?.id) return;
    if (isHost || !lobby.hasPassword) handleJoin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.id, isHost, session?.user?.id]);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setResults([]); setSearchOpen(false); setSearchErr(null); return; }
    setSearching(true); setSearchErr(null);
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
          setSearchErr(d.error === "No API key" ? "YouTube API key not configured." : "Search failed.");
          setSearchOpen(true);
        }
      } catch { setSearchErr("Network error."); setSearchOpen(true); }
      finally { setSearching(false); }
    }, 350);
  }, [searchQ]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Load playlists ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (sideTab !== "playlists" || playlistsLoaded) return;
    fetch("/api/playlists").then(r => r.json()).then((d: Playlist[]) => { setPlaylists(d); setPlLoaded(true); }).catch(() => {});
  }, [sideTab, playlistsLoaded]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleJoin(pass?: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/music-lobbies/${lobbyId}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: (pass ?? joinPass) || undefined }),
      });
      if (res.ok) setJoined(true);
      else { const d = await res.json(); setError(d.error ?? "Could not join"); }
    } finally { setJoining(false); }
  }

  function playTrack(item: YTItem) {
    setSearchOpen(false); setSearchQ("");
    setActiveQueue([]); setQueueIdx(0); setActivePl(null);
    music.play({ videoId: item.videoId, title: item.title, channel: item.channel, thumbnail: item.thumbnail });
    if (isHost) syncTrack(item, 0, true);
  }

  function syncTrack(item: YTItem, positionMs: number, isPlaying: boolean) {
    fetch(`/api/music-lobbies/${lobbyId}/sync`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackUri: item.videoId, trackName: item.title, trackArtist: item.channel, trackImage: item.thumbnail, positionMs, isPlaying }),
    });
  }

  function startPlaylist(pl: Playlist) {
    if (!pl.tracks.length) return;
    setActiveQueue(pl.tracks); setQueueIdx(0); setActivePl(pl.id);
    const first = pl.tracks[0];
    music.play({ videoId: first.videoId, title: first.title, channel: first.channel, thumbnail: first.thumbnail });
    if (isHost) syncTrack(first, 0, true);
  }

  async function importYouTubePlaylist() {
    if (!ytImportUrl.trim()) return;
    setImporting(true); setImportErr(null);
    try {
      const res = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(ytImportUrl.trim())}`);
      const d = await res.json() as { tracks?: YTItem[]; error?: string };
      if (!res.ok || !d.tracks) { setImportErr(d.error ?? "Import failed."); return; }
      if (d.tracks.length === 0) { setImportErr("Playlist is empty or private."); return; }
      const name = newPlName.trim() || `YouTube Playlist (${d.tracks.length} tracks)`;
      const cr = await fetch("/api/playlists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tracks: d.tracks }),
      });
      if (cr.ok) {
        const pl = await cr.json() as Playlist;
        setPlaylists(prev => [pl, ...prev]);
        setYtImportUrl(""); setNewPlName(""); setShowCreatePl(false);
      }
    } finally { setImporting(false); }
  }

  async function createEmptyPlaylist() {
    if (!newPlName.trim()) return;
    setCreatingPl(true);
    const res = await fetch("/api/playlists", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPlName.trim(), tracks: [] }),
    });
    if (res.ok) {
      const pl = await res.json() as Playlist;
      setPlaylists(prev => [pl, ...prev]);
      setNewPlName(""); setShowCreatePl(false);
    }
    setCreatingPl(false);
  }

  async function addToPlaylist(playlistId: string, item: YTItem) {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const updated = [...pl.tracks, item];
    await fetch(`/api/playlists/${playlistId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: updated }),
    });
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: updated } : p));
  }

  async function removeFromPlaylist(playlistId: string, videoId: string) {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const updated = pl.tracks.filter(t => t.videoId !== videoId);
    await fetch(`/api/playlists/${playlistId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: updated }),
    });
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: updated } : p));
  }

  async function deletePlaylist(id: string) {
    await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (activePlaylistId === id) { setActiveQueue([]); setQueueIdx(0); setActivePl(null); }
  }

  async function leaveLobby() {
    setLeaving(true); music.pause();
    await fetch(`/api/music-lobbies/${lobbyId}`, { method: "DELETE" }).catch(() => {});
    router.push("/feed");
  }

  async function closeLobby() {
    music.pause();
    await fetch(`/api/music-lobbies/${lobbyId}`, { method: "DELETE" });
    router.push("/feed");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const duration      = music.playerRef.current?.getDuration() ? music.playerRef.current.getDuration() * 1000 : 0;
  const pct           = duration > 0 ? Math.min(100, (music.positionMs / duration) * 100) : 0;
  const estimatedPos  = lobby ? lobby.positionMs + (lobby.isPlaying ? Math.min(lobby.elapsedMs, 300_000) : 0) : 0;

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (authStatus === "loading") return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

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

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
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
              <button key={r.videoId} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left group">
                <Image src={r.thumbnail} alt="" width={48} height={36} className="rounded shrink-0 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{r.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{r.channel}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => playTrack(r)}
                    className="px-2 py-1 rounded-md bg-red-500/15 text-red-400 text-[0.62rem] font-bold flex items-center gap-1 hover:bg-red-500/25">
                    <Play size={9} />{isHost ? "Play all" : "Play"}
                  </button>
                  {isHost && sideTab === "playlists" && playlists.length > 0 && (
                    <div className="relative group/pl">
                      <button className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] text-[var(--text-muted)] text-[0.62rem] font-bold flex items-center gap-1 hover:text-[var(--text-primary)]">
                        <Plus size={9} />Add
                      </button>
                      <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl overflow-hidden min-w-[140px] hidden group-hover/pl:block">
                        {playlists.map(pl => (
                          <button key={pl.id} onClick={() => addToPlaylist(pl.id, r)}
                            className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] truncate">
                            {pl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
        {/* Player card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {isHost ? "Now Playing (you control)" : "Now Playing"}
            </p>
            {activePlaylistId && isHost && (
              <span className="text-[0.62rem] text-red-400 font-display font-bold flex items-center gap-1">
                <ListMusic size={10} /> Playlist · {queueIdx + 1}/{activeQueue.length}
              </span>
            )}
          </div>

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

              {/* Host controls */}
              {isHost && (
                <>
                  <div className="flex items-center justify-center gap-5 mb-4">
                    <button onClick={music.prev} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipBack size={22} /></button>
                    <button onClick={music.isPlaying ? music.pause : music.resume}
                      className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-105 transition-transform">
                      {music.isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button onClick={() => {
                      if (activeQueue.length > 0 && queueIdx + 1 < activeQueue.length) {
                        const next = queueIdx + 1;
                        setQueueIdx(next);
                        const item = activeQueue[next];
                        music.play({ videoId: item.videoId, title: item.title, channel: item.channel, thumbnail: item.thumbnail });
                        syncTrack(item, 0, true);
                      } else music.next();
                    }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipForward size={22} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100} value={volume}
                      onChange={e => { const v = Number(e.target.value); setVolume(v); music.setVolume(v); }}
                      className="flex-1 h-1 accent-red-500 cursor-pointer" />
                  </div>
                </>
              )}

              {/* Guest controls */}
              {!isHost && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-xs text-[var(--text-muted)]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${lobby.isPlaying ? "bg-red-500 animate-pulse" : "bg-[var(--text-muted)]"}`} />
                    {lobby.isPlaying ? `Playing · ~${fmtMs(estimatedPos)}` : "Paused by host"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100} value={volume}
                      onChange={e => { const v = Number(e.target.value); setVolume(v); music.setVolume(v); }}
                      className="flex-1 h-1 accent-red-500 cursor-pointer" />
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

        {/* Right sidebar with tabs */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-[var(--border-subtle)]">
            {([
              { key: "listeners", icon: Users,     label: "People" },
              { key: "history",   icon: History,   label: "History" },
              { key: "playlists", icon: ListMusic, label: "Lists" },
            ] as { key: SideTab; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setSideTab(key)}
                className={[
                  "flex-1 flex flex-col items-center gap-0.5 py-2 text-[0.58rem] font-display font-bold uppercase tracking-wide transition-colors",
                  sideTab === key
                    ? "text-red-400 border-b-2 border-red-500"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                ].join(" ")}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Listeners tab */}
            {sideTab === "listeners" && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)]">
                  {lobby.host.image
                    ? <Image src={lobby.host.image} alt="" width={26} height={26} className="rounded-full shrink-0" />
                    : <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">{lobby.host.name?.[0] ?? "?"}</div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{lobby.host.name ?? "Host"}</p>
                    <p className="text-[0.58rem] text-red-400">host</p>
                  </div>
                </div>
                {lobby.members.filter(m => m.id !== lobby.host.id).map(m => (
                  <div key={m.id} className="flex items-center gap-2 mb-2">
                    {m.image
                      ? <Image src={m.image} alt="" width={22} height={22} className="rounded-full shrink-0" />
                      : <div className="w-[22px] h-[22px] rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] text-[0.58rem] font-bold">{m.name?.[0] ?? "?"}</div>
                    }
                    <p className="text-xs text-[var(--text-secondary)] truncate">{m.name ?? "Anonymous"}</p>
                  </div>
                ))}
                {lobby.members.length === 0 && (
                  <p className="text-[0.65rem] text-[var(--text-muted)] text-center py-4">No listeners yet</p>
                )}
              </div>
            )}

            {/* History tab */}
            {sideTab === "history" && (
              <div className="p-3">
                {lobby.history.length === 0 ? (
                  <div className="text-center py-6">
                    <History size={22} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
                    <p className="text-[0.65rem] text-[var(--text-muted)]">No tracks played yet</p>
                  </div>
                ) : lobby.history.map((item, i) => (
                  <button key={`${item.videoId}-${i}`}
                    onClick={() => isHost && playTrack(item)}
                    className={[
                      "w-full flex items-center gap-2 p-1.5 rounded-lg mb-1 text-left transition-colors",
                      isHost ? "hover:bg-[var(--bg-secondary)] cursor-pointer" : "cursor-default",
                    ].join(" ")}>
                    <Image src={item.thumbnail} alt="" width={36} height={27} className="rounded shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.7rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{item.title}</p>
                      <p className="text-[0.58rem] text-[var(--text-muted)] truncate">{timeAgo(item.at)}</p>
                    </div>
                    {isHost && <Play size={10} className="text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100" />}
                  </button>
                ))}
              </div>
            )}

            {/* Playlists tab */}
            {sideTab === "playlists" && (
              <div className="p-3">
                {/* Create / Import */}
                {!showCreatePl ? (
                  <button onClick={() => setShowCreatePl(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 mb-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:border-red-500/40 hover:text-red-400 transition-colors">
                    <Plus size={12} /> New playlist / Import
                  </button>
                ) : (
                  <div className="mb-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col gap-2">
                    <input value={newPlName} onChange={e => setNewPlName(e.target.value)}
                      placeholder="Playlist name"
                      className="w-full px-2 py-1.5 rounded-lg text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40"
                    />
                    <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <Youtube size={11} className="text-red-500 shrink-0" />
                      <input value={ytImportUrl} onChange={e => setYtImportUrl(e.target.value)}
                        placeholder="YouTube playlist URL (optional)"
                        className="flex-1 text-xs bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                      />
                    </div>
                    {importErr && <p className="text-[0.6rem] text-red-400">{importErr}</p>}
                    <div className="flex gap-1.5">
                      <button onClick={() => { setShowCreatePl(false); setImportErr(null); setNewPlName(""); setYtImportUrl(""); }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-display font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={ytImportUrl.trim() ? importYouTubePlaylist : createEmptyPlaylist}
                        disabled={importing || creatingPl || !newPlName.trim() && !ytImportUrl.trim()}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-display font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                        {(importing || creatingPl) ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                        {ytImportUrl.trim() ? "Import" : "Create"}
                      </button>
                    </div>
                  </div>
                )}

                {!playlistsLoaded ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>
                ) : playlists.length === 0 ? (
                  <div className="text-center py-6">
                    <ListMusic size={22} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
                    <p className="text-[0.65rem] text-[var(--text-muted)]">No playlists yet</p>
                  </div>
                ) : playlists.map(pl => (
                  <div key={pl.id} className="mb-2 rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]">
                      <button onClick={() => setExpandedPl(expandedPl === pl.id ? null : pl.id)}
                        className="flex-1 flex items-center gap-1.5 text-left min-w-0">
                        <ChevronRight size={11} className={`text-[var(--text-muted)] shrink-0 transition-transform ${expandedPl === pl.id ? "rotate-90" : ""}`} />
                        <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{pl.name}</span>
                        <span className="text-[0.58rem] text-[var(--text-muted)] shrink-0">{pl.tracks.length}</span>
                      </button>
                      {isHost && (
                        <button onClick={() => startPlaylist(pl)}
                          className={[
                            "shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] font-bold transition-colors",
                            activePlaylistId === pl.id
                              ? "bg-red-500 text-white"
                              : "bg-red-500/15 text-red-400 hover:bg-red-500/25",
                          ].join(" ")}>
                          <Play size={8} />{activePlaylistId === pl.id ? "Playing" : "Play"}
                        </button>
                      )}
                      <button onClick={() => deletePlaylist(pl.id)}
                        className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    {expandedPl === pl.id && (
                      <div className="max-h-48 overflow-y-auto">
                        {pl.tracks.length === 0 ? (
                          <p className="text-[0.62rem] text-[var(--text-muted)] text-center py-3">Empty playlist</p>
                        ) : pl.tracks.map((t, i) => (
                          <div key={`${t.videoId}-${i}`}
                            className={[
                              "flex items-center gap-2 px-3 py-1.5 border-t border-[var(--border-subtle)]",
                              activePlaylistId === pl.id && queueIdx === i ? "bg-red-500/10" : "",
                            ].join(" ")}>
                            <span className="text-[0.55rem] text-[var(--text-muted)] w-4 shrink-0">{i + 1}</span>
                            <Image src={t.thumbnail} alt="" width={28} height={21} className="rounded shrink-0 object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{t.title}</p>
                              <p className="text-[0.55rem] text-[var(--text-muted)] truncate">{t.channel}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isHost && (
                                <button onClick={() => {
                                  setQueueIdx(i); setActivePl(pl.id); setActiveQueue(pl.tracks);
                                  music.play({ videoId: t.videoId, title: t.title, channel: t.channel, thumbnail: t.thumbnail });
                                  syncTrack(t, 0, true);
                                }} className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5">
                                  <Play size={10} />
                                </button>
                              )}
                              <button onClick={() => removeFromPlaylist(pl.id, t.videoId)}
                                className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5">
                                <X size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
