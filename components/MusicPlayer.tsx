"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Music2, X, Minus, ChevronDown, Play, Pause, SkipBack, SkipForward,
  Volume2, Search, Plus, Lock, Users, Loader2, ExternalLink, Check, Copy,
  History, ListMusic, Trash2, Download, ChevronRight, Youtube, Heart,
  Shuffle, Sparkles, MonitorPlay, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
  ListOrdered, Save,
} from "lucide-react";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import Image from "next/image";
import Link from "next/link";
import { useMusicContext } from "@/contexts/MusicContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type LobbyListItem = {
  id: string; name: string | null; memberCount: number; hasPassword: boolean;
  trackName: string | null; isPlaying: boolean;
  host: { id: string; name: string | null };
};
type Member = { id: string; name: string | null; image: string | null; at: number };
type HistoryItem = { videoId: string; title: string; channel: string; thumbnail: string; at: number };
type YTItem = { videoId: string; title: string; channel: string; thumbnail: string };
type Playlist = { id: string; name: string; tracks: YTItem[]; isFavorites?: boolean };
type ActiveLobby = {
  id: string; name: string | null; hasPassword: boolean;
  host: { id: string; name: string | null; image: string | null };
  members: Member[];
  history: HistoryItem[];
  queue: YTItem[];
  trackUri: string | null; trackName: string | null; trackArtist: string | null; trackImage: string | null;
  isPlaying: boolean; positionMs: number; syncedAt: string;
};

type LobbyTab = "player" | "listeners" | "history" | "playlists" | "queue";

function fmtMs(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/(?:embed|shorts|v|live)\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}
function timeAgo(at: number) {
  const d = Math.floor((Date.now() - at) / 1000);
  if (d < 60) return `${d}s ago`; if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MusicPlayer({ onClose, isOpen = true }: { onClose: () => void; isOpen?: boolean }) {
  const { data: session } = useSession();
  const music = useMusicContext();

  // Layout — start with a fixed SSR-safe position; update after mount to avoid hydration mismatch
  const [pos, setPos] = useState({ x: 16, y: 16 });
  useEffect(() => {
    setPos({ x: window.innerWidth - 376, y: window.innerHeight - 420 });
  }, []);
  const [size, setSize]       = useState({ w: 350 });
  const [minimized, setMin]   = useState(false);
  const [view, setView]       = useState<"player" | "lobbies" | "create" | "lobby">("player");
  const [showVideo, setShowVideo]   = useState(false);
  const [videoStartSec, setVideoStartSec] = useState(0);
  const ytVideoRef = useRef<YouTubePlayerHandle>(null);
  const [volume, setVol]    = useState(70);
  useEffect(() => {
    const saved = localStorage.getItem("music_vol");
    if (saved !== null) setVol(Number(saved));
  }, []);

  // Lobby list
  const [lobbies, setLobbies]   = useState<LobbyListItem[]>([]);
  const [lobbyName, setLName]   = useState("");
  const [lobbyPass, setLPass]   = useState("");
  const [creating, setCreating] = useState(false);
  const [joinPass, setJoinPass] = useState<Record<string, string>>({});
  const [joining, setJoining]   = useState<string | null>(null);
  const [joinError, setJoinError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active lobby
  const [activeLobby, setActiveLobby] = useState<ActiveLobby | null>(null);
  const [lobbyTab, setLobbyTab]       = useState<LobbyTab>("player");
  const heartbeatRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekSyncRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef        = useRef<EventSource | null>(null);

  // Search
  const [searchQ, setSearchQ]       = useState("");
  const [results, setResults]       = useState<YTItem[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchErr, setSearchErr]   = useState<string | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Playlists
  const [playlists, setPlaylists]     = useState<Playlist[]>([]);
  const [plLoaded, setPlLoaded]       = useState(false);
  const [showCreatePl, setShowCreate] = useState(false);
  const [newPlName, setNewPlName]     = useState("");
  const [ytUrl, setYtUrl]             = useState("");
  const [importing, setImporting]     = useState(false);
  const [importErr, setImportErr]     = useState<string | null>(null);
  const [creatingPl, setCreatingPl]   = useState(false);
  const [expandedPl, setExpandedPl]   = useState<string | null>(null);
  // Queue / playlist / shuffle state lives in MusicContext (playerEngine)
  // Queue tab — save-as-playlist flow
  const [saveQueueName, setSaveQueueName] = useState("");
  const [savingQueue, setSavingQueue]     = useState(false);
  const [showSaveQueue, setShowSaveQueue] = useState(false);

  // Standalone player — "player" | "queue" mini-tab
  const [playerSubTab, setPlayerSubTab] = useState<"player" | "queue">("player");

  // Favorites
  const [favIds, setFavIds]         = useState<Set<string>>(new Set());
  const [favTracks, setFavTracks]   = useState<YTItem[]>([]);
  const [favLoading, setFavLoading] = useState<Set<string>>(new Set());

  // Add-to-playlist modal
  const [addToPlItem, setAddToPlItem]     = useState<YTItem | null>(null);
  const [addingToPlId, setAddingToPlId]   = useState<string | null>(null);
  const [addPlLoading, setAddPlLoading]   = useState(false);
  const [copiedPlId, setCopiedPlId]       = useState<string | null>(null);

  const syncedTrackRef         = useRef<string | null>(null);
  const prevIsPlayingRef       = useRef<boolean | null>(null);
  const lastLocalActionRef     = useRef<number>(0);
  const lastSyncRef            = useRef<{ playing: boolean | null; pos: number }>({ playing: null, pos: 0 });
  // Track changes arriving from SSE so the track/queue-change effects don't echo them back
  const incomingSyncTrackRef   = useRef<string | null>(null);
  const incomingSyncQueueRef   = useRef<string | null>(null);
  // Current session user ID (kept in a ref so applyLobbySync stale closure can read it)
  const sessionIdRef           = useRef<string | undefined>(undefined);
  sessionIdRef.current         = session?.user?.id;

  const isHost = activeLobby?.host.id === session?.user?.id;
  // Ref so applyLobbySync (useCallback with [] deps) always sees fresh isHost value
  const isHostRef = useRef(false);
  isHostRef.current = isHost;

  const {
    track, isPlaying, positionMs, playerReady,
    pause, resume, seek, setVolume: setMusicVol, prev, next,
    queue: activeQueue, activePlId, activePlName, isShuffled,
    smartShuffle, smartLoading,
    toggleShuffle, setSmartShuffle,
    removeFromQueue, reorderQueue,
  } = music;
  const duration = (music.playerRef.current?.getDuration?.() ?? 0) * 1000;
  const pct = duration > 0 ? Math.min(100, (positionMs / duration) * 100) : 0;
  // Live streams report duration=0; confirm by waiting until position actually advances
  const isLive = playerReady && duration === 0 && positionMs > 2000;

  // Apply saved volume as soon as the YouTube player becomes ready
  useEffect(() => {
    if (playerReady) setMusicVol(volume);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerReady]);

  function handleVol(v: number) { setVol(v); setMusicVol(v); localStorage.setItem("music_vol", String(v)); }

  // ── Restore lobby view on mount if already in a lobby ─────────────────────
  useEffect(() => {
    if (!music.activeLobbyId) return;
    fetch(`/api/music-lobbies/${music.activeLobbyId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: ActiveLobby | null) => {
        if (d && (d as ActiveLobby & { status?: string }).status !== "CLOSED") {
          setActiveLobby(d as ActiveLobby);
          setSize({ w: 360 });
          setView("lobby");
          applyLobbySync(d);
        } else {
          music.setActiveLobbyId(null);
        }
      }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch favorites on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/favorites")
      .then(r => r.json())
      .then((d: { tracks: YTItem[] }) => {
        setFavIds(new Set(d.tracks.map(t => t.videoId)));
        setFavTracks(d.tracks);
      }).catch(() => {});
  }, [session?.user?.id]);

  // ── Video mode: reset when track changes ─────────────────────────────────
  useEffect(() => { setShowVideo(false); }, [track?.videoId]);

  function openVideo() {
    if (!track) return;
    setVideoStartSec(Math.floor(positionMs / 1000));
    setShowVideo(true);
  }

  function closeVideo() { setShowVideo(false); }

  // ── Keep muted video in sync with audio (drift correction) ───────────────
  const positionMsRef = useRef(positionMs);
  positionMsRef.current = positionMs;

  useEffect(() => {
    if (!showVideo || !isPlaying || isLive) return;
    const t = setInterval(() => {
      const videoSec = ytVideoRef.current?.getCurrentTime() ?? 0;
      const audioSec = positionMsRef.current / 1000;
      if (Math.abs(videoSec - audioSec) > 1.5) {
        ytVideoRef.current?.seekTo(audioSec);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [showVideo, isPlaying, isLive]);

  // ── Apply a lobby sync payload (from SSE or initial fetch) ───────────────
  const applyLobbySync = useCallback((d: Partial<ActiveLobby> & { sourceId?: string }, fromLocalAction = false) => {
    // Ignore our own SSE echoes (server stamps sourceId = sender's userId)
    if (!fromLocalAction && d.sourceId && d.sourceId === sessionIdRef.current) return;

    if (!d.trackUri) {
      if (syncedTrackRef.current) {
        syncedTrackRef.current = null;
        prevIsPlayingRef.current = null;
        music.pause();
        music.clearQueue();
      }
      return;
    }

    const serverPos = () =>
      (d.positionMs ?? 0) + (d.isPlaying ? Date.now() - new Date(d.syncedAt!).getTime() : 0);

    if (d.trackUri !== syncedTrackRef.current) {
      syncedTrackRef.current = d.trackUri;
      prevIsPlayingRef.current = d.isPlaying ?? null;
      // Mark as incoming so the track-change effect doesn't echo it back
      incomingSyncTrackRef.current = d.trackUri;
      music.play(
        { videoId: d.trackUri, title: d.trackName ?? "", channel: d.trackArtist ?? "", thumbnail: d.trackImage ?? "" },
        serverPos()
      );
    } else {
      // Sync play/pause state and drift-correct position
      const locallyPlaying = music.playerRef.current
        ? (music.playerRef.current as { getPlayerState?: () => number }).getPlayerState?.() === 1
        : prevIsPlayingRef.current === true;

      if (!d.isPlaying && locallyPlaying) {
        prevIsPlayingRef.current = false;
        music.pause();
      } else if (d.isPlaying && !locallyPlaying) {
        prevIsPlayingRef.current = true;
        const localPos = music.playerRef.current
          ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0;
        if (Math.abs(serverPos() - localPos) > 1500) music.seek(serverPos());
        music.resume();
      } else if (d.isPlaying) {
        const localPos = music.playerRef.current
          ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0;
        const drift = Math.abs(serverPos() - localPos);
        if (drift > 1500 && drift < 60000) music.seek(serverPos());
      }
    }

    if (Array.isArray(d.queue)) {
      incomingSyncQueueRef.current = JSON.stringify(d.queue);
      music.reorderQueue(d.queue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SSE connection — real-time sync ────────────────────────────────────────
  useEffect(() => {
    if (view !== "lobby" || !activeLobby) return;
    const lobbyId = activeLobby.id;

    const es = new EventSource(`/api/music-lobbies/${lobbyId}/sse`);
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string) as Partial<ActiveLobby> & { closed?: boolean };
        if (d.closed) {
          es.close();
          music.pause(); music.setActiveLobbyId(null);
          setActiveLobby(null); setView("lobbies");
          return;
        }
        setActiveLobby(prev => prev ? { ...prev, ...d } : prev);
        applyLobbySync(d);
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing extra needed
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [view, activeLobby?.id, applyLobbySync]);

  // ── Slow poll (30s) to refresh member list & detect closed lobby ──────────
  const refreshLobby = useCallback(async () => {
    if (!activeLobby) return;
    const res = await fetch(`/api/music-lobbies/${activeLobby.id}`);
    if (!res.ok) { setActiveLobby(null); music.setActiveLobbyId(null); setView("lobbies"); return; }
    const d = await res.json() as ActiveLobby;
    // Only update non-sync fields (members, history) — SSE handles track/play state
    setActiveLobby(prev => prev ? { ...prev, members: d.members, history: d.history } : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLobby?.id]);

  useEffect(() => {
    if (view !== "lobby" || !activeLobby) return;
    const t = setInterval(refreshLobby, 30_000);
    return () => clearInterval(t);
  }, [view, refreshLobby, activeLobby]);

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "lobby" || !activeLobby || !session?.user?.id) return;
    const beat = () => fetch(`/api/music-lobbies/${activeLobby.id}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).catch(() => {});
    beat();
    heartbeatRef.current = setInterval(beat, 15_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [view, activeLobby?.id, session?.user?.id]);

  // Host syncs only on events (pause/resume/seek/new track) — no polling interval

  // Any member can sync a new track to the lobby; incoming SSE changes are skipped
  const prevTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeLobby || !track) return;
    if (track.videoId === prevTrackIdRef.current) return;
    prevTrackIdRef.current = track.videoId;
    if (incomingSyncTrackRef.current === track.videoId) {
      incomingSyncTrackRef.current = null;
      return; // track was applied from incoming SSE — don't echo back
    }
    hostSync(track, 0, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.videoId]);

  // Any member can sync queue changes to the lobby; incoming SSE changes are skipped
  const prevQueueRef = useRef<string>("");
  useEffect(() => {
    if (!activeLobby || !track) return;
    const serialized = JSON.stringify(activeQueue);
    if (serialized === prevQueueRef.current) return;
    prevQueueRef.current = serialized;
    if (incomingSyncQueueRef.current === serialized) {
      incomingSyncQueueRef.current = null;
      return; // queue was applied from incoming SSE — don't echo back
    }
    hostSync(track, music.playerRef.current ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0, isPlaying, activeQueue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQueue]);

  // ── Lobby list ─────────────────────────────────────────────────────────────
  const fetchLobbies = useCallback(async () => {
    const res = await fetch("/api/music-lobbies");
    if (res.ok) setLobbies(await res.json());
  }, []);

  useEffect(() => {
    if (view !== "lobbies") return;
    fetchLobbies();
    const t = setInterval(fetchLobbies, 5000);
    return () => clearInterval(t);
  }, [view, fetchLobbies]);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setResults([]); setSearchOpen(false); setSearchErr(null); return; }
    setSearching(true); setSearchErr(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const ytId = getYouTubeId(searchQ.trim());
        if (ytId) {
          const fallback: YTItem = { videoId: ytId, title: "YouTube Video", channel: "", thumbnail: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` };
          try {
            const oRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`);
            if (oRes.ok) {
              const o = await oRes.json() as { title: string; author_name: string; thumbnail_url: string };
              setResults([{ videoId: ytId, title: o.title, channel: o.author_name, thumbnail: o.thumbnail_url }]);
            } else {
              setResults([fallback]);
            }
          } catch { setResults([fallback]); }
          setSearchOpen(true);
          return;
        }
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQ.trim())}`);
        if (res.ok) {
          const d = await res.json() as { items: YTItem[] };
          setResults(d.items ?? []); setSearchOpen(true);
          if ((d.items ?? []).length === 0) setSearchErr("No results.");
        } else {
          const d = await res.json().catch(() => ({})) as { error?: string };
          setSearchErr(d.error === "No API key" ? "API key not configured." : "Search failed.");
          setResults([]); setSearchOpen(true);
        }
      } catch { setSearchErr("Network error."); setSearchOpen(true); }
      finally { setSearching(false); }
    }, 350);
  }, [searchQ]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener("mousedown", fn); return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Playlists ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (lobbyTab !== "playlists" || plLoaded) return;
    fetch("/api/playlists").then(r => r.json()).then((d: Playlist[]) => { setPlaylists(d); setPlLoaded(true); }).catch(() => {});
  }, [lobbyTab, plLoaded]);

  // ── Queue helpers ──────────────────────────────────────────────────────────
  function moveQueueItem(from: number, to: number) {
    if (to < 0 || to >= activeQueue.length) return;
    const q = [...activeQueue];
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    reorderQueue(q);
  }

  function openSaveQueue() {
    if (!showSaveQueue) {
      const d = new Date();
      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
      const lobbyLabel = activeLobby?.name
        ? activeLobby.name
        : activeLobby?.host?.name
          ? `${activeLobby.host.name}'s Lobby`
          : null;
      setSaveQueueName(lobbyLabel ? `${lobbyLabel} · ${dateStr}` : `Queue · ${dateStr}`);
    }
    setShowSaveQueue(s => !s);
  }

  async function saveQueueAsPlaylist() {
    const rawName = saveQueueName.trim();
    if (!rawName || activeQueue.length === 0) return;
    // Prefix with [Q] so saved queues appear in their own section in the Playlists tab
    const name = `[Q] ${rawName}`;
    setSavingQueue(true);
    try {
      const tracks = track ? [track, ...activeQueue] : activeQueue;
      const res = await fetch("/api/playlists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tracks }),
      });
      if (res.ok) {
        const pl = await res.json() as Playlist;
        setPlaylists(p => [pl, ...p]);
        setSaveQueueName("");
        setShowSaveQueue(false);
        setPlLoaded(true);
      }
    } finally { setSavingQueue(false); }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function hostSync(item: YTItem | null, posMs = 0, playing = true, queue?: YTItem[]) {
    if (!activeLobby) return;
    const q = queue ?? activeQueue;
    const sourceId = session?.user?.id;
    fetch(`/api/music-lobbies/${activeLobby.id}/sync`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item
        ? { trackUri: item.videoId, trackName: item.title, trackArtist: item.channel, trackImage: item.thumbnail, positionMs: posMs, isPlaying: playing, queue: q, sourceId }
        : { trackUri: null, isPlaying: false, positionMs: 0, queue: [], sourceId }
      ),
    }).catch(() => {});
  }

  function playTrack(item: YTItem) {
    setSearchOpen(false); setSearchQ("");
    music.playNow(item);
    if (activeLobby) hostSync(item, 0, true);
  }

  function startPlaylist(pl: Playlist) {
    if (!pl.tracks.length) return;
    music.playPlaylist({ id: pl.id, name: pl.name, tracks: pl.tracks });
    if (activeLobby) hostSync(pl.tracks[0], 0, true);
  }

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/music/${id}`);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
  }

  function copyPlaylistLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/playlists/${id}`);
    setCopiedPlId(id); setTimeout(() => setCopiedPlId(null), 1500);
  }

  async function toggleFav(item: YTItem) {
    if (favLoading.has(item.videoId)) return;
    setFavLoading(s => { const n = new Set(s); n.add(item.videoId); return n; });
    try {
      const res = await fetch("/api/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const d = await res.json() as { favorited: boolean };
        setFavIds(prev => {
          const n = new Set(prev);
          if (d.favorited) n.add(item.videoId); else n.delete(item.videoId);
          return n;
        });
        setFavTracks(prev => d.favorited
          ? [item, ...prev.filter(t => t.videoId !== item.videoId)]
          : prev.filter(t => t.videoId !== item.videoId)
        );
      }
    } finally {
      setFavLoading(s => { const n = new Set(s); n.delete(item.videoId); return n; });
    }
  }

  async function openAddToPl(item: YTItem) {
    setAddToPlItem(item);
    if (!plLoaded) {
      setAddPlLoading(true);
      try {
        const res = await fetch("/api/playlists");
        if (res.ok) { const d = await res.json() as Playlist[]; setPlaylists(d); setPlLoaded(true); }
      } finally { setAddPlLoading(false); }
    }
  }

  async function doAddToPlaylist(plId: string, item: YTItem) {
    setAddingToPlId(plId);
    await addToPlaylist(plId, item);
    setAddingToPlId(null);
    setAddToPlItem(null);
  }

  async function enterLobby(id: string) {
    const lobbyRes = await fetch(`/api/music-lobbies/${id}`);
    if (!lobbyRes.ok) return;
    const d = await lobbyRes.json() as ActiveLobby;
    music.setActiveLobbyId(id);
    setActiveLobby(d);
    setSize({ w: 360 });
    setView("lobby"); setLobbyTab("player");
    // Apply current track immediately so guest doesn't wait for first SSE event
    applyLobbySync(d);
  }

  async function createLobby() {
    setCreating(true);
    try {
      const res = await fetch("/api/music-lobbies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lobbyName, password: lobbyPass || undefined }),
      });
      if (res.ok) {
        const { id } = await res.json() as { id: string };
        setLName(""); setLPass("");
        await enterLobby(id);
      }
    } finally { setCreating(false); }
  }

  async function joinLobby(lobbyId: string, hasPass: boolean) {
    const pass = joinPass[lobbyId];
    if (hasPass && typeof pass !== "string") { setJoinPass(p => ({ ...p, [lobbyId]: "" })); return; }
    setJoining(lobbyId);
    try {
      const res = await fetch(`/api/music-lobbies/${lobbyId}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass || undefined }),
      });
      if (res.ok) await enterLobby(lobbyId);
      else { const d = await res.json(); setJoinError(p => ({ ...p, [lobbyId]: d.error ?? "Error" })); }
    } finally { setJoining(null); }
  }

  async function leaveLobby() {
    if (!activeLobby) return;
    await fetch(`/api/music-lobbies/${activeLobby.id}`, { method: "DELETE" }).catch(() => {});
    music.setActiveLobbyId(null); music.pause();
    setActiveLobby(null);
    music.clearQueue();
    setView("lobbies");
  }

  function pushSync(playing: boolean, overridePosMs?: number) {
    if (!track) return;
    const pos = overridePosMs ?? (music.playerRef.current
      ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0);
    // Skip if nothing meaningful changed
    if (
      lastSyncRef.current.playing === playing &&
      Math.abs(lastSyncRef.current.pos - pos) < 500
    ) return;
    lastSyncRef.current = { playing, pos };
    hostSync(track, pos, playing);
  }

  async function closeSong() {
    if (!activeLobby) return;
    music.pause();
    music.clearQueue();
    hostSync(null);
  }

  async function addToPlaylist(plId: string, item: YTItem) {
    const pl = playlists.find(p => p.id === plId); if (!pl) return;
    const updated = [...pl.tracks, item];
    await fetch(`/api/playlists/${plId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks: updated }) });
    setPlaylists(prev => prev.map(p => p.id === plId ? { ...p, tracks: updated } : p));
  }

  async function removeFromPlaylist(plId: string, videoId: string) {
    const pl = playlists.find(p => p.id === plId); if (!pl) return;
    const updated = pl.tracks.filter(t => t.videoId !== videoId);
    await fetch(`/api/playlists/${plId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks: updated }) });
    setPlaylists(prev => prev.map(p => p.id === plId ? { ...p, tracks: updated } : p));
  }

  async function deletePlaylist(id: string) {
    await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    setPlaylists(p => p.filter(pl => pl.id !== id));
    if (activePlId === id) music.clearQueue();
  }

  async function importYtPlaylist() {
    if (!ytUrl.trim()) return;
    setImporting(true); setImportErr(null);
    try {
      const res = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(ytUrl.trim())}`);
      const d = await res.json() as { tracks?: YTItem[]; error?: string };
      if (!res.ok || !d.tracks) { setImportErr(d.error ?? "Import failed."); return; }
      if (!d.tracks.length) { setImportErr("Playlist is empty or private."); return; }
      const name = newPlName.trim() || `YouTube Playlist (${d.tracks.length})`;
      const cr = await fetch("/api/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, tracks: d.tracks }) });
      if (cr.ok) { const pl = await cr.json() as Playlist; setPlaylists(p => [pl, ...p]); setYtUrl(""); setNewPlName(""); setShowCreate(false); }
    } finally { setImporting(false); }
  }

  async function createEmptyPlaylist() {
    if (!newPlName.trim()) return;
    setCreatingPl(true);
    const res = await fetch("/api/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newPlName.trim(), tracks: [] }) });
    if (res.ok) { const pl = await res.json() as Playlist; setPlaylists(p => [pl, ...p]); setNewPlName(""); setShowCreate(false); }
    setCreatingPl(false);
  }

  // ── Drag / Resize ──────────────────────────────────────────────────────────
  const handleDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return; e.preventDefault();
    const ox = e.clientX - pos.x, oy = e.clientY - pos.y;
    const onMove = (ev: MouseEvent) => setPos({ x: Math.max(0, Math.min(window.innerWidth - size.w, ev.clientX - ox)), y: Math.max(0, Math.min(window.innerHeight - 48, ev.clientY - oy)) });
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const sx = e.clientX, sw = size.w;
    const onMove = (ev: MouseEvent) => setSize({ w: Math.max(300, Math.min(600, sw + ev.clientX - sx)) });
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  if (!session?.user) return null;

  // ── Heart button helper ────────────────────────────────────────────────────
  const FavBtn = ({ item, size: sz = 9 }: { item: YTItem; size?: number }) => (
    <button
      onClick={(e) => { e.stopPropagation(); toggleFav(item); }}
      disabled={favLoading.has(item.videoId)}
      title={favIds.has(item.videoId) ? "Remove from favorites" : "Add to favorites"}
      className={[
        "shrink-0 transition-colors p-0.5 rounded",
        favIds.has(item.videoId) ? "text-red-400" : "text-[var(--text-muted)] hover:text-red-400",
        favLoading.has(item.videoId) ? "opacity-50" : "",
      ].join(" ")}
    >
      <Heart size={sz} fill={favIds.has(item.videoId) ? "currentColor" : "none"} />
    </button>
  );

  // ── Add-to-playlist button helper ─────────────────────────────────────────
  const AddPlBtn = ({ item, sz = 9 }: { item: YTItem; sz?: number }) => (
    <button
      onClick={(e) => { e.stopPropagation(); openAddToPl(item); }}
      title="Add to playlist"
      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 rounded"
    >
      <ListMusic size={sz} />
    </button>
  );

  // ── Shared UI pieces ───────────────────────────────────────────────────────
  const SearchBar = (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          onFocus={() => results.length > 0 && setSearchOpen(true)}
          placeholder={activeLobby ? "Search & play for everyone…" : "Search YouTube…"}
          className="w-full h-7 pl-7 pr-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs outline-none focus:border-red-500/40 placeholder:text-[var(--text-muted)]"
        />
        {searching && <Loader2 size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />}
      </div>
      {searchOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+3px)] z-50 rounded-xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.99)] backdrop-blur-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {searchErr ? (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">{searchErr}</p>
          ) : results.map(r => (
            <div key={r.videoId} className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors group">
              <Image src={r.thumbnail} alt="" width={36} height={27} className="rounded shrink-0 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{r.title}</p>
                <p className="text-[0.58rem] text-[var(--text-muted)] truncate">{r.channel}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); music.addToQueue(r); setSearchOpen(false); setSearchQ(""); }}
                  title="Add to queue"
                  className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[0.58rem] font-bold flex items-center gap-0.5 hover:bg-red-500/25">
                  <Plus size={8} />Queue
                </button>
                <button
                  onClick={() => playTrack(r)}
                  title="Replace current track"
                  className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] text-[0.58rem] font-bold flex items-center gap-0.5 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors">
                  <Play size={8} />Replace
                </button>
                <FavBtn item={r} size={10} />
                <AddPlBtn item={r} sz={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const PlayerControls = (
    <div className="flex flex-col gap-2">
      {track ? (
        <>
          {/* ── Video panel ── */}
          {showVideo && (
            <YouTubePlayer
              ref={ytVideoRef}
              videoId={track.videoId}
              title={track.title}
              startSeconds={videoStartSec}
              muted
              externalPlaying={isPlaying}
              onSeek={sec => {
                seek(sec * 1000);
                if (activeLobby) {
                  lastLocalActionRef.current = Date.now();
                  if (seekSyncRef.current) clearTimeout(seekSyncRef.current);
                  seekSyncRef.current = setTimeout(() => pushSync(isPlaying, sec * 1000), 120);
                }
              }}
              onPlayPause={playing => {
                lastLocalActionRef.current = Date.now();
                if (playing) { resume(); if (activeLobby) pushSync(true); }
                else          { pause();  if (activeLobby) pushSync(false); }
              }}
              onClose={closeVideo}
              className="rounded-xl"
            />
          )}

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => showVideo ? closeVideo() : openVideo()}
              title={showVideo ? "Hide video" : "Watch video"}
              className="relative shrink-0 group rounded-lg overflow-hidden shadow"
            >
              <Image src={track.thumbnail} alt="" width={44} height={44} className="rounded-lg object-cover block" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <MonitorPlay size={14} className="text-white" />
              </div>
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-[var(--text-primary)] text-xs truncate leading-tight">{track.title}</p>
              <p className="text-[var(--text-muted)] text-[0.6rem] truncate">{track.channel}</p>
              {activePlId && (
                <p className="text-[0.58rem] text-red-400 flex items-center gap-0.5 mt-0.5 truncate">
                  <ListMusic size={8} className="shrink-0" />
                  <span className="truncate max-w-[100px]">{activePlName ?? "Playlist"}</span>
                  <span className="shrink-0">· {activeQueue.length} left</span>
                  {isShuffled && <Shuffle size={7} className="shrink-0 ml-0.5" />}
                </p>
              )}
              {/* Favorite + add-to-playlist buttons for current track */}
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => toggleFav(track)}
                  disabled={favLoading.has(track.videoId)}
                  className={[
                    "flex items-center gap-0.5 px-1.5 py-[2px] rounded text-[0.58rem] font-bold border transition-colors",
                    favIds.has(track.videoId)
                      ? "bg-red-500/15 border-red-500/30 text-red-400"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30",
                  ].join(" ")}
                >
                  <Heart size={7} fill={favIds.has(track.videoId) ? "currentColor" : "none"} />
                  {favIds.has(track.videoId) ? "Saved" : "Like"}
                </button>
                <button
                  onClick={() => openAddToPl(track)}
                  className="flex items-center gap-0.5 px-1.5 py-[2px] rounded text-[0.58rem] font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-colors"
                >
                  <Plus size={7} /> Playlist
                </button>
              </div>
            </div>
          </div>
          {/* Progress */}
          <div>
            {isLive ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-[0.6rem] font-bold text-red-400 uppercase tracking-wide">Live</span>
                </div>
                <div className="flex-1 h-1 rounded-full bg-red-500/30" />
              </div>
            ) : (
              <>
                <div className="w-full h-1 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ms = Math.floor(((e.clientX - rect.left) / rect.width) * duration);
                    seek(ms);
                    ytVideoRef.current?.seekTo(ms / 1000);
                    if (activeLobby) {
                      lastLocalActionRef.current = Date.now();
                      if (seekSyncRef.current) clearTimeout(seekSyncRef.current);
                      seekSyncRef.current = setTimeout(() => pushSync(isPlaying, ms), 120);
                    }
                  }}>
                  <div className="h-full bg-red-500 rounded-full group-hover:bg-red-400 transition-colors" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[0.55rem] text-[var(--text-muted)]">{fmtMs(positionMs)}</span>
                  <span className="text-[0.55rem] text-[var(--text-muted)]">{fmtMs(duration)}</span>
                </div>
              </>
            )}
          </div>
          {/* Close song */}
          {activeLobby && (
            <div className="flex justify-end">
              <button onClick={closeSong}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6rem] font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors">
                <X size={9} /> Close song
              </button>
            </div>
          )}
          {/* Controls */}
          <>
            <div className="flex items-center justify-center gap-4">
                <button onClick={prev} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipBack size={16} /></button>
                <button
                  onClick={() => {
                    lastLocalActionRef.current = Date.now();
                    if (isPlaying) { pause(); if (activeLobby) pushSync(false); }
                    else { resume(); if (activeLobby) pushSync(true); }
                  }}
                  className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-105 transition-transform">
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button onClick={next} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipForward size={16} /></button>
              </div>
              {/* Playback mode toggles */}
              <div className="flex items-center justify-center gap-2">
                {activeQueue.length > 0 && (
                  <button
                    onClick={toggleShuffle}
                    title={isShuffled ? "Shuffle on — click to restore order" : "Shuffle playlist"}
                    className={[
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[0.6rem] font-display font-bold border transition-colors",
                      isShuffled
                        ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                    ].join(" ")}
                  >
                    <Shuffle size={9} />
                    Shuffle
                  </button>
                )}
                {/* Smart shuffle — always visible; auto-fetches YouTube recs when queue is empty */}
                <button
                  onClick={() => setSmartShuffle(!smartShuffle)}
                  title={smartShuffle ? "Smart: ON — auto-plays YouTube recommendations when queue ends" : "Smart: OFF — enable to auto-play recommendations"}
                  className={[
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.65rem] font-display font-bold border transition-all",
                    smartShuffle
                      ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.25)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-purple-500/30 hover:text-purple-400",
                  ].join(" ")}
                >
                  {smartLoading
                    ? <Loader2 size={10} className="animate-spin" />
                    : <Sparkles size={10} className={smartShuffle ? "text-purple-300" : ""} />}
                  {smartShuffle ? "Smart ON" : "Smart"}
                </button>
              </div>
            </>
          {/* Live indicator */}
          {activeLobby && (
            <div className="flex items-center gap-1.5 text-[0.6rem] text-[var(--text-muted)]">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeLobby.isPlaying ? "bg-red-500 animate-pulse" : "bg-[var(--text-muted)]"}`} />
              {activeLobby.isPlaying ? "Live" : "Paused"}
            </div>
          )}
          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 size={10} className="text-[var(--text-muted)] shrink-0" />
            <input type="range" min={0} max={100} value={volume}
              onChange={e => handleVol(Number(e.target.value))}
              className="flex-1 h-1 accent-red-500 cursor-pointer" />
            <span className="text-[0.55rem] text-[var(--text-muted)] w-5 text-right">{volume}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1.5 py-3 text-center">
          <Music2 size={20} className="text-[var(--text-muted)] opacity-30" />
          <p className="text-[var(--text-muted)] text-xs">
            Search a track to play
          </p>
          {!playerReady && <p className="text-[0.58rem] text-[var(--text-muted)] opacity-60">Loading player…</p>}
        </div>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed z-[980] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.97)] backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y, width: size.w, userSelect: "none", display: isOpen ? undefined : "none" }}>

      {/* Header */}
      <div onMouseDown={handleDrag}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing select-none shrink-0">
        <Music2 size={13} className="text-red-500 shrink-0" />
        <span className="flex-1 text-[0.7rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
          {view === "player" ? "Music" : view === "lobbies" ? "Lobbies" : view === "create" ? "Create Lobby"
            : (activeLobby?.name || `${activeLobby?.host.name ?? "?"}'s Lobby`)}
        </span>
        {activeLobby && (
          <Link href={`/music/${activeLobby.id}`}
            className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5" title="Open full lobby page">
            <ExternalLink size={12} />
          </Link>
        )}
        {view !== "lobby" && (
          <button onClick={() => {
            if (music.activeLobbyId && activeLobby) { setView("lobby"); setLobbyTab("player"); }
            else setView(view === "player" ? "lobbies" : "player");
          }} className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5" title="Lobbies">
            <Users size={13} />
          </button>
        )}
        <button onClick={() => setMin(m => !m)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
          {minimized ? <ChevronDown size={13} /> : <Minus size={13} />}
        </button>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5">
          <X size={13} />
        </button>
      </div>

      {!minimized && (
        <div style={{ overflowY: "auto", maxHeight: `calc(100vh - ${pos.y + 48}px)` }}>

          {/* ── PLAYER VIEW ─────────────────────────────────────── */}
          {view === "player" && (
            <div className="flex flex-col">
              {/* Mini-tab: Player / Queue */}
              <div className="flex border-b border-[var(--border-subtle)] shrink-0">
                {(["player", "queue"] as const).map(tab => (
                  <button key={tab} onClick={() => setPlayerSubTab(tab)}
                    className={[
                      "flex-1 flex items-center justify-center gap-1 py-1.5 text-[0.55rem] font-display font-bold uppercase tracking-wide transition-colors",
                      playerSubTab === tab ? "text-red-400 border-b-2 border-red-500" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                    ].join(" ")}>
                    {tab === "player" ? <Play size={9} /> : <ListOrdered size={9} />}
                    {tab === "queue"
                      ? <span className="relative">Queue{activeQueue.length > 0 && <span className="absolute -top-1.5 -right-2.5 text-[0.45rem] bg-red-500 text-white rounded-full px-0.5 leading-tight">{activeQueue.length}</span>}</span>
                      : "Player"}
                  </button>
                ))}
              </div>

              {playerSubTab === "player" ? (
                <div className="p-3 flex flex-col gap-3">
                  {SearchBar}
                  {PlayerControls}
                </div>
              ) : (
                /* Standalone queue panel */
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Queue · {activeQueue.length} track{activeQueue.length !== 1 ? "s" : ""}
                    </span>
                    {activeQueue.length > 0 && (
                      <button onClick={openSaveQueue}
                        className={["flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.58rem] font-bold border transition-colors",
                          showSaveQueue ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"].join(" ")}>
                        <Save size={9} /> Save
                      </button>
                    )}
                  </div>
                  {showSaveQueue && (
                    <div className="flex gap-1.5 mb-1">
                      <input value={saveQueueName} onChange={e => setSaveQueueName(e.target.value)}
                        placeholder="Playlist name…" onKeyDown={e => e.key === "Enter" && saveQueueAsPlaylist()}
                        className="flex-1 px-2 py-1 rounded-lg text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
                      <button onClick={saveQueueAsPlaylist} disabled={savingQueue || !saveQueueName.trim()}
                        className="px-2 py-1 rounded-lg text-xs font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1">
                        {savingQueue ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                      </button>
                    </div>
                  )}
                  {activeQueue.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                      <ListOrdered size={20} className="text-[var(--text-muted)] opacity-30" />
                      <p className="text-[var(--text-muted)] text-xs">Queue is empty</p>
                      <p className="text-[0.6rem] text-[var(--text-muted)] opacity-60">Add tracks with the + button</p>
                    </div>
                  ) : activeQueue.map((t, i) => (
                    <div key={`${t.videoId}-${i}`}
                      className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] transition-colors group">
                      <span className="text-[0.5rem] text-[var(--text-muted)] w-3.5 shrink-0 text-center">{i + 1}</span>
                      <Image src={t.thumbnail} alt="" width={24} height={18} className="rounded shrink-0 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.62rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{t.title}</p>
                        <p className="text-[0.52rem] text-[var(--text-muted)] truncate">{t.channel}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveQueueItem(i, 0)} disabled={i === 0} title="To top"
                          className="p-0.5 text-white hover:text-grey-400 disabled:opacity-20 transition-colors"><ChevronsUp size={18} /></button>
                        <button onClick={() => moveQueueItem(i, i - 1)} disabled={i === 0} title="Move up"
                          className="p-0.5 text-white hover:text-grey-400 disabled:opacity-20 transition-colors"><ArrowUp size={18} /></button>
                        <button onClick={() => moveQueueItem(i, i + 1)} disabled={i === activeQueue.length - 1} title="Move down"
                          className="p-0.5 text-white hover:text-grey-400 disabled:opacity-20 transition-colors"><ArrowDown size={18} /></button>
                        <button onClick={() => moveQueueItem(i, activeQueue.length - 1)} disabled={i === activeQueue.length - 1} title="To bottom"
                          className="p-0.5 text-white hover:text-grey-400 disabled:opacity-20 transition-colors"><ChevronsDown size={18} /></button>
                        <button onClick={() => removeFromQueue(i)} title="Remove"
                          className="p-0.5 text-white hover:text-red-400 transition-colors"><X size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LOBBIES VIEW ────────────────────────────────────── */}
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
              ) : lobbies.map(lobby => (
                <div key={lobby.id} className="px-3 py-2.5 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate flex-1">
                      {lobby.name || `${lobby.host.name ?? "?"}'s lobby`}
                    </span>
                    {lobby.hasPassword && <Lock size={10} className="text-[var(--text-muted)] shrink-0" />}
                    <span className="text-[0.6rem] text-[var(--text-muted)] flex items-center gap-0.5 shrink-0"><Users size={9} />{lobby.memberCount}</span>
                    <button onClick={() => copyLink(lobby.id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                      {copiedId === lobby.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                    </button>
                  </div>
                  {lobby.trackName && (
                    <p className="text-[0.62rem] text-[var(--text-muted)] truncate mb-1.5">{lobby.isPlaying ? "▶ " : "⏸ "}{lobby.trackName}</p>
                  )}
                  {lobby.hasPassword && typeof joinPass[lobby.id] === "string" && (
                    <input type="password" placeholder="Password" value={joinPass[lobby.id]}
                      onChange={e => setJoinPass(p => ({ ...p, [lobby.id]: e.target.value }))}
                      className="w-full mb-1.5 px-2 py-1 rounded-md text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none" />
                  )}
                  <button onClick={() => { setJoinError(p => ({ ...p, [lobby.id]: "" })); joinLobby(lobby.id, lobby.hasPassword); }} disabled={joining === lobby.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.62rem] font-display font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50">
                    {joining === lobby.id ? <Loader2 size={9} className="animate-spin" /> : <ExternalLink size={9} />} Join
                  </button>
                  {joinError[lobby.id] && <p className="text-[0.58rem] text-red-400 mt-1">{joinError[lobby.id]}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── CREATE VIEW ─────────────────────────────────────── */}
          {view === "create" && (
            <div className="p-3 flex flex-col gap-3">
              <div>
                <label className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Name (optional)</label>
                <input value={lobbyName} onChange={e => setLName(e.target.value)} placeholder="My session"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
              </div>
              <div>
                <label className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Password (optional)</label>
                <input type="password" value={lobbyPass} onChange={e => setLPass(e.target.value)} placeholder="Leave blank for public"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("lobbies")}
                  className="flex-1 py-2 rounded-xl text-sm font-display font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                <button onClick={createLobby} disabled={creating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-display font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
                </button>
              </div>
            </div>
          )}

          {/* ── LOBBY VIEW ──────────────────────────────────────── */}
          {view === "lobby" && activeLobby && (
            <div className="flex flex-col">
              {/* Lobby header bar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {activeLobby.hasPassword && <Lock size={9} className="text-[var(--text-muted)] shrink-0" />}
                  <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">
                    {activeLobby.name || `${activeLobby.host.name ?? "?"}'s lobby`}
                  </span>
                  <span className="text-[0.58rem] text-[var(--text-muted)] shrink-0 flex items-center gap-0.5">
                    <Users size={8} />{activeLobby.members.length}
                  </span>
                </div>
                <button onClick={() => copyLink(activeLobby.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6rem] font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                  {copiedId === activeLobby.id ? <Check size={8} className="text-green-400" /> : <Copy size={8} />}
                  {copiedId === activeLobby.id ? "Copied" : "Share"}
                </button>
                <button onClick={leaveLobby}
                  className="shrink-0 px-2 py-0.5 rounded-md text-[0.6rem] font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
                  {isHost ? "Close" : "Leave"}
                </button>
              </div>

              {/* Lobby tab bar */}
              <div className="flex border-b border-[var(--border-subtle)] shrink-0">
                {([
                  { key: "player",    icon: Play,         label: "Player" },
                  { key: "listeners", icon: Users,        label: "People" },
                  { key: "history",   icon: History,      label: "History" },
                  { key: "queue",     icon: ListOrdered,  label: "Queue" },
                  { key: "playlists", icon: ListMusic,    label: "Lists" },
                ] as { key: LobbyTab; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
                  <button key={key} onClick={() => setLobbyTab(key)}
                    className={[
                      "flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[0.55rem] font-display font-bold uppercase tracking-wide transition-colors",
                      lobbyTab === key ? "text-red-400 border-b-2 border-red-500" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                    ].join(" ")}>
                    <Icon size={11} />
                    {key === "queue" && activeQueue.length > 0
                      ? <span className="relative">{label}<span className="absolute -top-1.5 -right-2.5 text-[0.45rem] bg-red-500 text-white rounded-full px-0.5 leading-tight">{activeQueue.length}</span></span>
                      : label}
                  </button>
                ))}
              </div>

              {/* Lobby tab content */}
              <div className="overflow-y-auto" style={{ maxHeight: `calc(100vh - ${pos.y + 160}px)` }}>

                {/* Player tab */}
                {lobbyTab === "player" && (
                  <div className="p-3 flex flex-col gap-3">
                    {SearchBar}
                    {PlayerControls}
                  </div>
                )}

                {/* Listeners tab */}
                {lobbyTab === "listeners" && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)]">
                      {activeLobby.host.image
                        ? <Image src={activeLobby.host.image} alt="" width={22} height={22} className="rounded-full shrink-0" />
                        : <div className="w-[22px] h-[22px] rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-[0.55rem] font-bold">{activeLobby.host.name?.[0] ?? "?"}</div>
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{activeLobby.host.name ?? "Host"}</p>
                      </div>
                      <span className="text-[0.55rem] text-red-400 font-bold">host</span>
                    </div>
                    {activeLobby.members.filter(m => m.id !== activeLobby.host.id).map(m => (
                      <div key={m.id} className="flex items-center gap-2 mb-2">
                        {m.image
                          ? <Image src={m.image} alt="" width={18} height={18} className="rounded-full shrink-0" />
                          : <div className="w-[18px] h-[18px] rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] text-[0.5rem] font-bold">{m.name?.[0] ?? "?"}</div>
                        }
                        <p className="text-xs text-[var(--text-secondary)] truncate">{m.name ?? "Anonymous"}</p>
                      </div>
                    ))}
                    {activeLobby.members.length === 0 && <p className="text-[0.65rem] text-[var(--text-muted)] text-center py-4">No listeners yet</p>}
                  </div>
                )}

                {/* History tab */}
                {lobbyTab === "history" && (
                  <div className="p-3">
                    {(!activeLobby.history || activeLobby.history.length === 0) ? (
                      <div className="text-center py-6">
                        <History size={20} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
                        <p className="text-[0.65rem] text-[var(--text-muted)]">No tracks played yet</p>
                      </div>
                    ) : activeLobby.history.map((item, i) => (
                      <div key={`${item.videoId}-${i}`}
                        className="flex items-center gap-2 p-1.5 rounded-lg mb-1">
                        <button
                          onClick={() => playTrack(item)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <Image src={item.thumbnail} alt="" width={32} height={24} className="rounded shrink-0 object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.65rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{item.title}</p>
                            <p className="text-[0.55rem] text-[var(--text-muted)]">{timeAgo(item.at)}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <FavBtn item={item} size={10} />
                          <AddPlBtn item={item} sz={10} />
                          <button onClick={e => { e.stopPropagation(); music.addToQueue(item); }}
                            title="Add to queue"
                            className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5">
                            <Plus size={9} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Queue tab */}
                {lobbyTab === "queue" && (
                  <div className="p-3 flex flex-col gap-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Queue · {activeQueue.length} track{activeQueue.length !== 1 ? "s" : ""}
                      </span>
                      {activeQueue.length > 0 && (
                        <button onClick={openSaveQueue}
                          className={["flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.58rem] font-bold border transition-colors",
                            showSaveQueue ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"].join(" ")}>
                          <Save size={9} /> Save
                        </button>
                      )}
                    </div>

                    {/* Save-as-playlist form */}
                    {showSaveQueue && (
                      <div className="flex gap-1.5 mb-1">
                        <input value={saveQueueName} onChange={e => setSaveQueueName(e.target.value)}
                          placeholder="Playlist name…" onKeyDown={e => e.key === "Enter" && saveQueueAsPlaylist()}
                          className="flex-1 px-2 py-1 rounded-lg text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
                        <button onClick={saveQueueAsPlaylist} disabled={savingQueue || !saveQueueName.trim()}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1">
                          {savingQueue ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                        </button>
                      </div>
                    )}

                    {/* Empty state */}
                    {activeQueue.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                        <ListOrdered size={20} className="text-[var(--text-muted)] opacity-30" />
                        <p className="text-[var(--text-muted)] text-xs">Queue is empty</p>
                        <p className="text-[0.6rem] text-[var(--text-muted)] opacity-60">Add tracks with the + button</p>
                      </div>
                    ) : activeQueue.map((t, i) => (
                      <div key={`${t.videoId}-${i}`}
                        className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] transition-colors group">
                        <span className="text-[0.5rem] text-[var(--text-muted)] w-3.5 shrink-0 text-center">{i + 1}</span>
                        <Image src={t.thumbnail} alt="" width={24} height={18} className="rounded shrink-0 object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.62rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{t.title}</p>
                          <p className="text-[0.52rem] text-[var(--text-muted)] truncate">{t.channel}</p>
                        </div>
                        {/* Reorder + remove buttons */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveQueueItem(i, 0)} disabled={i === 0} title="To top"
                            className="p-0.5 text-[var(--text-orange)] hover:text-[var(--text-primary)] disabled:opacity-20 transition-colors">
                            <ChevronsUp size={9} />
                          </button>
                          <button onClick={() => moveQueueItem(i, i - 1)} disabled={i === 0} title="Move up"
                            className="p-0.5 text-[var(--text-orange)] hover:text-[var(--text-primary)] disabled:opacity-20 transition-colors">
                            <ArrowUp size={9} />
                          </button>
                          <button onClick={() => moveQueueItem(i, i + 1)} disabled={i === activeQueue.length - 1} title="Move down"
                            className="p-0.5 text-[var(--text-orange)] hover:text-[var(--text-primary)] disabled:opacity-20 transition-colors">
                            <ArrowDown size={9} />
                          </button>
                          <button onClick={() => moveQueueItem(i, activeQueue.length - 1)} disabled={i === activeQueue.length - 1} title="To bottom"
                            className="p-0.5 text-[var(--text-orange)] hover:text-[var(--text-primary)] disabled:opacity-20 transition-colors">
                            <ChevronsDown size={9} />
                          </button>
                          <button onClick={() => removeFromQueue(i)} title="Remove"
                            className="p-0.5 text-[var(--text-orange)] hover:text-red-400 transition-colors">
                            <X size={9} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Playlists tab */}
                {lobbyTab === "playlists" && (
                  <div className="p-3">
                    {!showCreatePl ? (
                      <button onClick={() => setShowCreate(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:border-red-500/40 hover:text-red-400 transition-colors">
                        <Plus size={11} /> New playlist / Import YouTube
                      </button>
                    ) : (
                      <div className="mb-3 p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col gap-2">
                        <input value={newPlName} onChange={e => setNewPlName(e.target.value)} placeholder="Playlist name"
                          className="w-full px-2 py-1.5 rounded-lg text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
                        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5">
                          <Youtube size={10} className="text-red-500 shrink-0" />
                          <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube playlist URL (optional)"
                            className="flex-1 text-xs bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
                        </div>
                        {importErr && <p className="text-[0.58rem] text-red-400">{importErr}</p>}
                        <div className="flex gap-1.5">
                          <button onClick={() => { setShowCreate(false); setImportErr(null); setNewPlName(""); setYtUrl(""); }}
                            className="flex-1 py-1 rounded-lg text-xs font-display font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                          <button onClick={ytUrl.trim() ? importYtPlaylist : createEmptyPlaylist}
                            disabled={importing || creatingPl || (!newPlName.trim() && !ytUrl.trim())}
                            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-display font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                            {(importing || creatingPl) ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                            {ytUrl.trim() ? "Import" : "Create"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Pinned: Favorites ──────────────────────────── */}
                    {favTracks.length > 0 && (
                      <div className="mb-2 rounded-xl border border-red-500/20 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-2.5 py-2 bg-red-500/5">
                          <button onClick={() => setExpandedPl(expandedPl === "__fav__" ? null : "__fav__")}
                            className="flex items-center gap-1 flex-1 min-w-0 text-left">
                            <ChevronRight size={10} className={`text-red-400 shrink-0 transition-transform ${expandedPl === "__fav__" ? "rotate-90" : ""}`} />
                            <Heart size={9} className="text-red-400 shrink-0" fill="currentColor" />
                            <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">Favorites</span>
                            <span className="text-[0.55rem] text-[var(--text-muted)] shrink-0">{favTracks.length}</span>
                          </button>
                          <button onClick={() => { music.playPlaylist({ id: "__fav__", name: "Favorites", tracks: favTracks }); if (activeLobby) hostSync(favTracks[0], 0, true); }}
                            className={["shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.58rem] font-bold transition-colors",
                              activePlId === "__fav__" ? "bg-red-500 text-white" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"].join(" ")}>
                            <Play size={7} />{activePlId === "__fav__" ? "Playing" : "Play all"}
                          </button>
                        </div>
                        {expandedPl === "__fav__" && (
                          <div className="max-h-44 overflow-y-auto">
                            {favTracks.map((t, i) => (
                              <div key={t.videoId}
                                className={["flex items-center gap-1.5 px-2.5 py-1.5 border-t border-[var(--border-subtle)]", track?.videoId === t.videoId ? "bg-red-500/10" : ""].join(" ")}>
                                <span className="text-[0.5rem] text-[var(--text-muted)] w-3 shrink-0">{i + 1}</span>
                                <Image src={t.thumbnail} alt="" width={24} height={18} className="rounded shrink-0 object-cover" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[0.62rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{t.title}</p>
                                  <p className="text-[0.52rem] text-[var(--text-muted)] truncate">{t.channel}</p>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <FavBtn item={t} size={9} />
                                  <button onClick={() => music.addToQueue(t)} title="Add to queue"
                                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5"><Plus size={9} /></button>
                                  <button onClick={() => {
                                    music.playPlaylist({ id: "__fav__", name: "Favorites", tracks: favTracks.slice(i) });
                                    if (activeLobby) hostSync(t, 0, true);
                                  }} className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5"><Play size={9} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!plLoaded ? (
                      <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-[var(--text-muted)]" /></div>
                    ) : (() => {
                      const queuePls  = playlists.filter(p => p.name.startsWith("[Q] "));
                      const regularPls = playlists.filter(p => !p.name.startsWith("[Q] "));

                      const PlaylistRow = (pl: Playlist, displayName: string) => (
                        <div key={pl.id} className="mb-2 rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                          <div className="flex items-center gap-1.5 px-2.5 py-2 bg-[var(--bg-secondary)]">
                            <button onClick={() => setExpandedPl(expandedPl === pl.id ? null : pl.id)}
                              className="flex items-center gap-1 flex-1 min-w-0 text-left">
                              <ChevronRight size={10} className={`text-[var(--text-muted)] shrink-0 transition-transform ${expandedPl === pl.id ? "rotate-90" : ""}`} />
                              <span className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{displayName}</span>
                              <span className="text-[0.55rem] text-[var(--text-muted)] shrink-0">{pl.tracks.length}</span>
                            </button>
                            <button onClick={() => copyPlaylistLink(pl.id)} title="Copy link"
                              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
                              {copiedPlId === pl.id ? <Check size={9} className="text-green-400" /> : <Copy size={9} />}
                            </button>
                            <button onClick={() => startPlaylist(pl)}
                              className={["shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.58rem] font-bold transition-colors",
                                activePlId === pl.id ? "bg-red-500 text-white" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"].join(" ")}>
                              <Play size={7} />{activePlId === pl.id ? "Playing" : "Play"}
                            </button>
                            <button onClick={() => deletePlaylist(pl.id)} className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                              <Trash2 size={10} />
                            </button>
                          </div>
                          {expandedPl === pl.id && (
                            <div className="max-h-44 overflow-y-auto">
                              {pl.tracks.length === 0 ? (
                                <p className="text-[0.62rem] text-[var(--text-muted)] text-center py-2">Empty</p>
                              ) : pl.tracks.map((t, i) => (
                                <div key={`${t.videoId}-${i}`}
                                  className={["flex items-center gap-1.5 px-2.5 py-1.5 border-t border-[var(--border-subtle)]", track?.videoId === t.videoId ? "bg-red-500/10" : ""].join(" ")}>
                                  <span className="text-[0.5rem] text-[var(--text-muted)] w-3 shrink-0">{i + 1}</span>
                                  <Image src={t.thumbnail} alt="" width={24} height={18} className="rounded shrink-0 object-cover" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[0.62rem] font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{t.title}</p>
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <FavBtn item={t} size={9} />
                                    <button onClick={() => music.addToQueue(t)} title="Add to queue"
                                      className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5"><Plus size={9} /></button>
                                    <button onClick={() => {
                                      music.playPlaylist({ id: pl.id, name: pl.name, tracks: pl.tracks.slice(i) });
                                      if (activeLobby) hostSync(t, 0, true);
                                    }} className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5"><Play size={9} /></button>
                                    <button onClick={() => removeFromPlaylist(pl.id, t.videoId)}
                                      className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-0.5"><X size={9} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );

                      return (
                        <>
                          {/* ── Saved Queues section ── */}
                          {queuePls.length > 0 && (
                            <>
                              <p className="text-[0.58rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <ListOrdered size={9} /> Saved Queues
                              </p>
                              {queuePls.map(pl => PlaylistRow(pl, pl.name.slice(4)))}
                              {regularPls.length > 0 && <div className="border-t border-[var(--border-subtle)] my-2" />}
                            </>
                          )}

                          {/* ── Regular playlists ── */}
                          {regularPls.length === 0 && queuePls.length === 0 ? (
                            <div className="text-center py-5">
                              <ListMusic size={20} className="mx-auto mb-1.5 text-[var(--text-muted)] opacity-30" />
                              <p className="text-[0.65rem] text-[var(--text-muted)]">No playlists yet</p>
                            </div>
                          ) : regularPls.map(pl => PlaylistRow(pl, pl.name))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add-to-playlist modal */}
      {addToPlItem && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 rounded-2xl">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3 w-[85%] shadow-2xl">
            <p className="text-xs font-display font-bold text-[var(--text-primary)] mb-1">Add to playlist</p>
            <p className="text-[0.6rem] text-[var(--text-muted)] mb-2.5 truncate">{addToPlItem.title}</p>
            {(addPlLoading && !plLoaded) ? (
              <div className="flex justify-center py-3"><Loader2 size={14} className="animate-spin text-[var(--text-muted)]" /></div>
            ) : playlists.length === 0 ? (
              <p className="text-[0.62rem] text-[var(--text-muted)] text-center py-2 mb-2">No playlists yet. Create one first.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 mb-2.5">
                {playlists.map(pl => (
                  <button key={pl.id} onClick={() => doAddToPlaylist(pl.id, addToPlItem!)}
                    disabled={addingToPlId === pl.id || pl.tracks.some(t => t.videoId === addToPlItem.videoId)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5 disabled:opacity-40">
                    {addingToPlId === pl.id
                      ? <Loader2 size={9} className="animate-spin shrink-0" />
                      : pl.tracks.some(t => t.videoId === addToPlItem.videoId)
                        ? <Check size={9} className="text-green-400 shrink-0" />
                        : <ListMusic size={9} className="shrink-0" />
                    }
                    <span className="truncate flex-1">{pl.name}</span>
                    <span className="text-[0.55rem] text-[var(--text-muted)] shrink-0">{pl.tracks.length}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setAddToPlItem(null)}
              className="w-full py-1 rounded-lg text-xs font-display font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!minimized && (
        <div onMouseDown={handleResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          style={{ background: "linear-gradient(135deg,transparent 50%,rgba(255,255,255,0.07) 50%)" }} />
      )}
    </div>
  );
}
