"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Music2, X, Minus, ChevronDown, Play, Pause, SkipBack, SkipForward,
  Volume2, Search, Plus, Lock, Users, Loader2, ExternalLink, Check, Copy,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMusicContext, type YTTrack } from "@/contexts/MusicContext";

type Lobby = {
  id: string;
  name: string | null;
  memberCount: number;
  hasPassword: boolean;
  trackName: string | null;
  trackArtist: string | null;
  trackImage: string | null;
  isPlaying: boolean;
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

export default function MusicPlayer({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const music = useMusicContext();

  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    return { x: window.innerWidth - 348, y: window.innerHeight - 380 };
  });
  const [size, setSize]       = useState({ w: 320, h: 220 });
  const [minimized, setMin]   = useState(false);
  const [view, setView]       = useState<"player" | "lobbies" | "create">("player");

  // Lobbies
  const [lobbies, setLobbies]     = useState<Lobby[]>([]);
  const [lobbyName, setLobbyName] = useState("");
  const [lobbyPass, setLobbyPass] = useState("");
  const [creating, setCreating]   = useState(false);
  const [joinPass, setJoinPass]   = useState<Record<string, string>>({});
  const [joining, setJoining]     = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  // Search
  const [searchQ, setSearchQ]         = useState("");
  const [results, setResults]         = useState<YTItem[]>([]);
  const [searching, setSearching]     = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLobbies = useCallback(async () => {
    const res = await fetch("/api/spotify-lobbies");
    if (res.ok) setLobbies(await res.json());
  }, []);

  useEffect(() => {
    if (view !== "lobbies") return;
    fetchLobbies();
    const t = setInterval(fetchLobbies, 5000);
    return () => clearInterval(t);
  }, [view, fetchLobbies]);

  // Search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setResults([]); setSearchOpen(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQ.trim())}`);
      if (res.ok) {
        const d = await res.json() as { items: YTItem[] };
        setResults(d.items ?? []);
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

  function playTrack(item: YTItem) {
    setSearchOpen(false); setSearchQ("");
    music.play({ videoId: item.videoId, title: item.title, channel: item.channel, thumbnail: item.thumbnail });
    // If host in active lobby, sync to lobby
    if (music.activeLobbyId) {
      fetch(`/api/spotify-lobbies/${music.activeLobbyId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUri: item.videoId, trackName: item.title,
          trackArtist: item.channel, trackImage: item.thumbnail,
          positionMs: 0, isPlaying: true,
        }),
      });
    }
  }

  async function createLobby() {
    setCreating(true);
    try {
      const res = await fetch("/api/spotify-lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lobbyName, password: lobbyPass || undefined }),
      });
      if (res.ok) {
        const { id } = await res.json() as { id: string };
        music.setActiveLobbyId(id);
        window.open(`/music/${id}`, "_blank");
        setView("lobbies"); setLobbyName(""); setLobbyPass("");
      }
    } finally { setCreating(false); }
  }

  async function joinLobby(lobbyId: string, hasPass: boolean) {
    const pass = joinPass[lobbyId];
    if (hasPass && typeof pass !== "string") {
      setJoinPass(p => ({ ...p, [lobbyId]: "" })); return;
    }
    setJoining(lobbyId);
    try {
      const res = await fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass || undefined }),
      });
      if (res.ok) { music.setActiveLobbyId(lobbyId); window.open(`/music/${lobbyId}`, "_blank"); }
      else { const d = await res.json(); alert(d.error ?? "Error"); }
    } finally { setJoining(null); }
  }

  function copyLobbyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/music/${id}`);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  // ─── Drag ─────────────────────────────────────────────────────────────────
  const handleDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const ox = e.clientX - pos.x, oy = e.clientY - pos.y;
    const onMove = (ev: MouseEvent) => setPos({
      x: Math.max(0, Math.min(window.innerWidth  - size.w, ev.clientX - ox)),
      y: Math.max(0, Math.min(window.innerHeight - 48,     ev.clientY - oy)),
    });
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ─── Resize ───────────────────────────────────────────────────────────────
  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const sx = e.clientX, sy = e.clientY, sw = size.w, sh = size.h;
    const onMove = (ev: MouseEvent) => setSize({
      w: Math.max(290, Math.min(560, sw + ev.clientX - sx)),
      h: Math.max(180, Math.min(600, sh + ev.clientY - sy)),
    });
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!session?.user) return null;

  const { track, isPlaying, positionMs, playerReady, pause, resume, seek, setVolume, prev, next } = music;
  const duration = music.playerRef.current?.getDuration() ? music.playerRef.current.getDuration() * 1000 : 0;
  const pct = duration > 0 ? Math.min(100, (positionMs / duration) * 100) : 0;

  return (
    <div
      className="fixed z-[980] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.97)] backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y, width: size.w, userSelect: "none" }}
    >
      {/* Drag handle / header */}
      <div onMouseDown={handleDrag}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing select-none">
        <Music2 size={13} className="text-red-500 shrink-0" />
        <span className="flex-1 text-[0.7rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
          {view === "player" ? "Music" : view === "lobbies" ? "Lobbies" : "Create Lobby"}
        </span>
        {music.activeLobbyId && (
          <Link href={`/music/${music.activeLobbyId}`} target="_blank"
            className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5" title="Open lobby">
            <ExternalLink size={12} />
          </Link>
        )}
        <button onClick={() => setView(view === "player" ? "lobbies" : "player")}
          className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5" title="Lobbies">
          <Users size={13} />
        </button>
        <button onClick={() => setMin(m => !m)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
          {minimized ? <ChevronDown size={13} /> : <Minus size={13} />}
        </button>
        <button onClick={onClose}
          className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5">
          <X size={13} />
        </button>
      </div>

      {!minimized && (
        <div style={{ height: view === "player" ? "auto" : size.h - 40, overflowY: "auto" }}>

          {/* ── PLAYER VIEW ─────────────────────────────────────────── */}
          {view === "player" && (
            <div className="p-3 flex flex-col gap-3">
              {/* Search */}
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onFocus={() => results.length > 0 && setSearchOpen(true)}
                    placeholder="Search YouTube music…"
                    className="w-full h-8 pl-7 pr-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs outline-none focus:border-red-500/40 placeholder:text-[var(--text-muted)]"
                  />
                  {searching && <Loader2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />}
                </div>

                {searchOpen && results.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.99)] backdrop-blur-xl shadow-2xl overflow-hidden">
                    {results.map(r => (
                      <button key={r.videoId} onClick={() => playTrack(r)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left">
                        <Image src={r.thumbnail} alt="" width={40} height={28} className="rounded shrink-0 object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{r.title}</p>
                          <p className="text-[0.6rem] text-[var(--text-muted)] truncate">{r.channel}</p>
                        </div>
                        <Play size={10} className="text-red-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Track info */}
              {track ? (
                <>
                  <div className="flex items-center gap-3">
                    <Image src={track.thumbnail} alt="" width={52} height={52}
                      className="rounded-lg shrink-0 shadow-md object-cover" />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-[var(--text-primary)] text-sm truncate leading-tight">{track.title}</p>
                      <p className="text-[var(--text-muted)] text-xs truncate">{track.channel}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="w-full h-1 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seek(Math.floor(((e.clientX - rect.left) / rect.width) * duration));
                      }}>
                      <div className="h-full bg-red-500 rounded-full group-hover:bg-red-400 transition-colors"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[0.6rem] text-[var(--text-muted)]">{fmtMs(positionMs)}</span>
                      <span className="text-[0.6rem] text-[var(--text-muted)]">{fmtMs(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={prev} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <SkipBack size={18} />
                    </button>
                    <button onClick={isPlaying ? pause : resume}
                      className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-105 transition-transform">
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={next} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <SkipForward size={18} />
                    </button>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <Volume2 size={11} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100} defaultValue={70}
                      onChange={e => setVolume(Number(e.target.value))}
                      className="flex-1 h-1 accent-red-500 cursor-pointer"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <Music2 size={24} className="text-[var(--text-muted)] opacity-30" />
                  <p className="text-[var(--text-muted)] text-xs">Search a track to start playing</p>
                </div>
              )}

              {!playerReady && (
                <p className="text-[0.6rem] text-[var(--text-muted)] text-center opacity-60">Loading player…</p>
              )}
            </div>
          )}

          {/* ── LOBBIES VIEW ────────────────────────────────────────── */}
          {view === "lobbies" && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">Active Lobbies</span>
                <button onClick={() => setView("create")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[0.7rem] font-display font-bold hover:bg-red-500/25 transition-colors">
                  <Plus size={11} /> Create
                </button>
              </div>

              {lobbies.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Music2 size={24} className="text-[var(--text-muted)] opacity-30" />
                  <p className="text-[var(--text-muted)] text-xs">No active lobbies</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                  {lobbies.map(lobby => (
                    <div key={lobby.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate flex-1">
                          {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
                        </span>
                        {lobby.hasPassword && <Lock size={10} className="text-[var(--text-muted)] shrink-0" />}
                        <span className="text-[0.6rem] text-[var(--text-muted)] flex items-center gap-0.5 shrink-0">
                          <Users size={9} />{lobby.memberCount}
                        </span>
                        <button onClick={() => copyLobbyLink(lobby.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                        </button>
                      </div>

                      {lobby.trackName && (
                        <p className="text-[0.62rem] text-[var(--text-muted)] truncate mb-1.5">
                          {lobby.isPlaying ? "▶ " : "⏸ "}{lobby.trackName}
                        </p>
                      )}

                      {lobby.hasPassword && typeof joinPass[lobby.id] === "string" && (
                        <input type="password" placeholder="Password"
                          value={joinPass[lobby.id]}
                          onChange={e => setJoinPass(p => ({ ...p, [lobby.id]: e.target.value }))}
                          className="w-full mb-1.5 px-2 py-1 rounded-md text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none"
                        />
                      )}

                      <div className="flex items-center gap-1.5">
                        <button onClick={() => joinLobby(lobby.id, lobby.hasPassword)}
                          disabled={joining === lobby.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.62rem] font-display font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50">
                          {joining === lobby.id ? <Loader2 size={9} className="animate-spin" /> : <ExternalLink size={9} />}
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CREATE VIEW ─────────────────────────────────────────── */}
          {view === "create" && (
            <div className="p-3 flex flex-col gap-3">
              <div>
                <label className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Name (optional)</label>
                <input value={lobbyName} onChange={e => setLobbyName(e.target.value)}
                  placeholder="My session"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40"
                />
              </div>
              <div>
                <label className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Password (optional)</label>
                <input type="password" value={lobbyPass} onChange={e => setLobbyPass(e.target.value)}
                  placeholder="Leave blank for public"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("lobbies")}
                  className="flex-1 py-2 rounded-xl text-sm font-display font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Cancel
                </button>
                <button onClick={createLobby} disabled={creating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-display font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resize handle */}
      {!minimized && (
        <div onMouseDown={handleResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          style={{ background: "linear-gradient(135deg,transparent 50%,rgba(255,255,255,0.07) 50%)" }}
        />
      )}
    </div>
  );
}
