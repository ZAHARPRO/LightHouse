"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Music2, X, Minus, ChevronDown, SkipBack, SkipForward,
  Play, Pause, Volume2, Users, Plus, Lock, Loader2, ExternalLink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type SpotifyState = {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
  } | null;
  device: { volume_percent: number } | null;
} | null;

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

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SpotifyPlayer({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();

  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    return { x: window.innerWidth - 348, y: window.innerHeight - 320 };
  });
  const [size, setSize] = useState({ w: 320, h: 180 });
  const [minimized, setMinimized] = useState(false);

  const [state, setState] = useState<SpotifyState>(undefined as unknown as SpotifyState);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [view, setView] = useState<"player" | "lobbies" | "create">("player");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [lobbyName, setLobbyName] = useState("");
  const [lobbyPass, setLobbyPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinPass, setJoinPass] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState<string | null>(null);

  const hasSpotify = session?.user
    ? undefined
    : false;

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/spotify/player", { cache: "no-store" });
    if (res.status === 404) { setState(null); setLoading(false); return; }
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json() as SpotifyState;
    setState(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return; }
    fetchState();
    pollRef.current = setInterval(fetchState, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.user?.id, fetchState]);

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

  async function doAction(action: string, extra?: object) {
    setActing(true);
    await fetch("/api/spotify/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    await fetchState();
    setActing(false);
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
        const { id } = await res.json();
        window.open(`/music/${id}`, "_blank");
        setView("lobbies");
        setLobbyName(""); setLobbyPass("");
      }
    } finally { setCreating(false); }
  }

  async function joinLobby(lobbyId: string, hasPassword: boolean) {
    const pass = joinPass[lobbyId];
    if (hasPassword && !pass) {
      setJoinPass(p => ({ ...p, [lobbyId]: "" }));
      return;
    }
    setJoining(lobbyId);
    try {
      const res = await fetch(`/api/spotify-lobbies/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      if (res.ok) window.open(`/music/${lobbyId}`, "_blank");
      else { const d = await res.json(); alert(d.error ?? "Error"); }
    } finally { setJoining(null); }
  }

  // ─── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;
    const onMove = (ev: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - size.w, ev.clientX - ox)),
        y: Math.max(0, Math.min(window.innerHeight - 48, ev.clientY - oy)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ─── Resize ────────────────────────────────────────────────────────────────
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const sx = e.clientX; const sy = e.clientY;
    const sw = size.w; const sh = size.h;
    const onMove = (ev: MouseEvent) => {
      setSize({
        w: Math.max(280, Math.min(560, sw + ev.clientX - sx)),
        h: Math.max(160, Math.min(500, sh + ev.clientY - sy)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const track = state?.item;
  const progress = state?.progress_ms ?? 0;
  const duration = track?.duration_ms ?? 1;
  const pct = Math.min(100, (progress / duration) * 100);

  if (!session?.user) return null;

  return (
    <div
      className="fixed z-[980] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.97)] backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y, width: size.w, userSelect: "none" }}
    >
      {/* Header / drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing select-none"
      >
        <Music2 size={13} className="text-[#1DB954] shrink-0" />
        <span className="flex-1 text-[0.7rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
          {view === "player" ? "Spotify" : view === "lobbies" ? "Listen Together" : "Create Lobby"}
        </span>
        <button onClick={() => setView(view === "player" ? "lobbies" : "player")}
          title={view === "player" ? "Listen Together" : "Player"}
          className="text-[var(--text-muted)] hover:text-[#1DB954] transition-colors p-0.5">
          <Users size={13} />
        </button>
        <button onClick={() => setMinimized(m => !m)}
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

          {/* ── PLAYER VIEW ─────────────────────────────────────────────────── */}
          {view === "player" && (
            <div className="p-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : state === null ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Music2 size={28} className="text-[var(--text-muted)] opacity-40" />
                  <p className="text-[var(--text-muted)] text-xs">No Spotify account connected.</p>
                  <a
                    href="/api/spotify/connect"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-bold bg-[#1DB954] text-black hover:opacity-90 transition-opacity no-underline"
                  >
                    Connect Spotify
                  </a>
                </div>
              ) : !state ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Music2 size={24} className="text-[var(--text-muted)] opacity-30" />
                  <p className="text-[var(--text-muted)] text-xs">Nothing playing on Spotify.</p>
                  <p className="text-[var(--text-muted)] text-[0.65rem]">Open Spotify on any device to start.</p>
                </div>
              ) : (
                <>
                  {/* Track info */}
                  <div className="flex items-center gap-3 mb-3">
                    {track?.album.images[0]?.url ? (
                      <Image
                        src={track.album.images[0].url} alt=""
                        width={52} height={52}
                        className="rounded-lg shrink-0 shadow-md"
                      />
                    ) : (
                      <div className="w-[52px] h-[52px] rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                        <Music2 size={20} className="text-[var(--text-muted)]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-display font-bold text-[var(--text-primary)] text-sm truncate leading-tight">
                        {track?.name ?? "—"}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs truncate">
                        {track?.artists.map(a => a.name).join(", ") ?? ""}
                      </p>
                      <p className="text-[var(--text-muted)] text-[0.65rem] truncate opacity-70">
                        {track?.album.name ?? ""}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div
                      className="w-full h-1 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        doAction("seek", { positionMs: Math.floor(pct * duration) });
                      }}
                    >
                      <div className="h-full bg-[#1DB954] rounded-full transition-all group-hover:bg-green-400"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[0.6rem] text-[var(--text-muted)]">{fmtMs(progress)}</span>
                      <span className="text-[0.6rem] text-[var(--text-muted)]">{fmtMs(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => doAction("prev")} disabled={acting}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
                      <SkipBack size={18} />
                    </button>
                    <button
                      onClick={() => doAction(state.is_playing ? "pause" : "play")}
                      disabled={acting}
                      className="w-9 h-9 rounded-full bg-[#1DB954] flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 text-black"
                    >
                      {acting ? <Loader2 size={15} className="animate-spin" /> :
                        state.is_playing ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={() => doAction("next")} disabled={acting}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
                      <SkipForward size={18} />
                    </button>
                  </div>

                  {/* Volume */}
                  {state.device && (
                    <div className="flex items-center gap-2 mt-3">
                      <Volume2 size={11} className="text-[var(--text-muted)] shrink-0" />
                      <input type="range" min={0} max={100}
                        defaultValue={state.device.volume_percent}
                        onChange={(e) => doAction("volume", { volume: Number(e.target.value) })}
                        className="flex-1 h-1 accent-[#1DB954] cursor-pointer"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── LOBBIES VIEW ────────────────────────────────────────────────── */}
          {view === "lobbies" && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Active Lobbies
                </span>
                <button onClick={() => setView("create")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] text-[0.7rem] font-display font-bold hover:bg-[#1DB954]/25 transition-colors">
                  <Plus size={11} /> Create
                </button>
              </div>

              {lobbies.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Music2 size={24} className="text-[var(--text-muted)] opacity-30" />
                  <p className="text-[var(--text-muted)] text-xs">No active lobbies.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                  {lobbies.map(lobby => (
                    <div key={lobby.id} className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        {lobby.host.image
                          ? <Image src={lobby.host.image} alt="" width={20} height={20} className="rounded-full shrink-0" />
                          : <div className="w-5 h-5 rounded-full bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954] text-[0.55rem] font-bold">{lobby.host.name?.[0] ?? "?"}</div>
                        }
                        <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate flex-1">
                          {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
                        </span>
                        {lobby.hasPassword && <Lock size={10} className="text-[var(--text-muted)] shrink-0" />}
                        <span className="text-[0.6rem] text-[var(--text-muted)] flex items-center gap-0.5 shrink-0">
                          <Users size={9} />{lobby.memberCount}
                        </span>
                      </div>

                      {lobby.trackName && (
                        <p className="text-[0.65rem] text-[var(--text-muted)] truncate mb-1.5">
                          {lobby.isPlaying ? "▶ " : "⏸ "}{lobby.trackName}
                          {lobby.trackArtist ? ` · ${lobby.trackArtist}` : ""}
                        </p>
                      )}

                      {lobby.hasPassword && typeof joinPass[lobby.id] === "string" && (
                        <input
                          type="password"
                          placeholder="Password"
                          value={joinPass[lobby.id]}
                          onChange={e => setJoinPass(p => ({ ...p, [lobby.id]: e.target.value }))}
                          className="w-full mb-1.5 px-2 py-1 rounded-md text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#1DB954]/50"
                        />
                      )}

                      <button
                        onClick={() => joinLobby(lobby.id, lobby.hasPassword)}
                        disabled={joining === lobby.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[0.65rem] font-display font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#1DB954] hover:border-[#1DB954]/40 transition-colors disabled:opacity-50"
                      >
                        {joining === lobby.id ? <Loader2 size={9} className="animate-spin" /> : <ExternalLink size={9} />}
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CREATE VIEW ─────────────────────────────────────────────────── */}
          {view === "create" && (
            <div className="p-3 flex flex-col gap-3">
              <div>
                <label className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Lobby Name (optional)
                </label>
                <input
                  value={lobbyName}
                  onChange={e => setLobbyName(e.target.value)}
                  placeholder="My chill session"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#1DB954]/50"
                />
              </div>
              <div>
                <label className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Password (optional)
                </label>
                <input
                  type="password"
                  value={lobbyPass}
                  onChange={e => setLobbyPass(e.target.value)}
                  placeholder="Leave blank for public"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#1DB954]/50"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("lobbies")}
                  className="flex-1 py-2 rounded-xl text-sm font-display font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Cancel
                </button>
                <button onClick={createLobby} disabled={creating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-display font-bold bg-[#1DB954] text-black hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Create
                </button>
              </div>
              <p className="text-[0.6rem] text-[var(--text-muted)] text-center">
                Lobby link can be shared in{" "}
                <Link href="/chat" className="text-[#1DB954] hover:underline">global chat</Link>
              </p>
            </div>
          )}

        </div>
      )}

      {/* Resize handle */}
      {!minimized && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          style={{
            background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.08) 50%)",
          }}
        />
      )}
    </div>
  );
}
