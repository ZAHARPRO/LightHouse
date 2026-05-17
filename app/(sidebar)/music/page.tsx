"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Music2, Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Plus, Lock, Users, Loader2, ExternalLink, Check, Copy,
  History, ListMusic, Trash2, Download, ChevronRight, Youtube,
  Heart, Shuffle, Sparkles, MonitorPlay, ArrowUp, ArrowDown,
  ChevronsUp, ChevronsDown, ListOrdered, Save, X, Minus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMusicContext } from "@/contexts/MusicContext";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/YouTubePlayer";

// ─── Local types ──────────────────────────────────────────────────────────────
type YTItem    = { videoId: string; title: string; channel: string; thumbnail: string };
type Playlist  = { id: string; name: string; tracks: YTItem[]; isFavorites?: boolean };
type Member    = { id: string; name: string | null; image: string | null; at: number };
type HistItem  = { videoId: string; title: string; channel: string; thumbnail: string; at: number };
type LobbyListItem = {
  id: string; name: string | null; memberCount: number; hasPassword: boolean;
  trackName: string | null; isPlaying: boolean;
  host: { id: string; name: string | null };
};
type ActiveLobby = {
  id: string; name: string | null; hasPassword: boolean;
  host: { id: string; name: string | null; image: string | null };
  members: Member[];
  history: HistItem[];
  queue: YTItem[];
  trackUri: string | null; trackName: string | null; trackArtist: string | null; trackImage: string | null;
  isPlaying: boolean; positionMs: number; syncedAt: string;
};

type RightTab = "queue" | "playlists" | "lobbies" | "history" | "people";

function fmtMs(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function timeAgo(at: number) {
  const d = Math.floor((Date.now() - at) / 1000);
  if (d < 60)   return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MusicPage() {
  const { data: session } = useSession();
  const t = useTranslations("musicPage");
  const music = useMusicContext();

  // ── Right panel tab ──────────────────────────────────────────────────────────
  const [rightTab, setRightTab] = useState<RightTab>("queue");

  // ── Volume ───────────────────────────────────────────────────────────────────
  const [volume, setVol] = useState(() =>
    typeof window !== "undefined" ? Number(localStorage.getItem("music_vol") ?? 70) : 70
  );
  useEffect(() => { if (music.playerReady) music.setVolume(volume); }, [music.playerReady]); // eslint-disable-line
  function handleVol(v: number) { setVol(v); music.setVolume(v); localStorage.setItem("music_vol", String(v)); }

  // ── Video mode ───────────────────────────────────────────────────────────────
  const [showVideo, setShowVideo]       = useState(false);
  const [videoStartSec, setVideoStartSec] = useState(0);
  const ytVideoRef = useRef<YouTubePlayerHandle>(null);
  useEffect(() => { setShowVideo(false); }, [music.track?.videoId]);
  const positionMsRef = useRef(music.positionMs);
  positionMsRef.current = music.positionMs;
  useEffect(() => {
    if (!showVideo || !music.isPlaying) return;
    const t = setInterval(() => {
      const videoSec = ytVideoRef.current?.getCurrentTime() ?? 0;
      const audioSec = positionMsRef.current / 1000;
      if (Math.abs(videoSec - audioSec) > 1.5) ytVideoRef.current?.seekTo(audioSec);
    }, 3000);
    return () => clearInterval(t);
  }, [showVideo, music.isPlaying]);

  // ── Search ───────────────────────────────────────────────────────────────────
  const [searchQ, setSearchQ]     = useState("");
  const [results, setResults]     = useState<YTItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            } else setResults([fallback]);
          } catch { setResults([fallback]); }
          setSearchOpen(true); return;
        }
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQ.trim())}`);
        if (res.ok) {
          const d = await res.json() as { items: YTItem[] };
          setResults(d.items ?? []); setSearchOpen(true);
          if (!(d.items ?? []).length) setSearchErr(t("noResults"));
        } else {
          const d = await res.json().catch(() => ({})) as { error?: string };
          setSearchErr(d.error === "No API key" ? t("apiKeyMissing") : t("searchFailed"));
          setResults([]); setSearchOpen(true);
        }
      } catch { setSearchErr(t("networkError")); setSearchOpen(true); }
      finally { setSearching(false); }
    }, 350);
  }, [searchQ]); // eslint-disable-line

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener("mousedown", fn); return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Playlists ────────────────────────────────────────────────────────────────
  const [playlists, setPlaylists]   = useState<Playlist[]>([]);
  const [plLoaded, setPlLoaded]     = useState(false);
  const [showCreatePl, setShowCreate] = useState(false);
  const [newPlName, setNewPlName]   = useState("");
  const [ytUrl, setYtUrl]           = useState("");
  const [importing, setImporting]   = useState(false);
  const [importErr, setImportErr]   = useState<string | null>(null);
  const [creatingPl, setCreatingPl] = useState(false);
  const [expandedPl, setExpandedPl] = useState<string | null>(null);
  const [addToPlItem, setAddToPlItem] = useState<YTItem | null>(null);
  const [addingToPlId, setAddingToPlId] = useState<string | null>(null);
  const [addPlLoading, setAddPlLoading] = useState(false);
  const [copiedPlId, setCopiedPlId] = useState<string | null>(null);

  useEffect(() => {
    if (rightTab !== "playlists" || plLoaded) return;
    fetch("/api/playlists").then(r => r.json()).then((d: Playlist[]) => { setPlaylists(d); setPlLoaded(true); }).catch(() => {});
  }, [rightTab, plLoaded]);

  // ── Favorites ────────────────────────────────────────────────────────────────
  const [favIds, setFavIds]       = useState<Set<string>>(new Set());
  const [favTracks, setFavTracks] = useState<YTItem[]>([]);
  const [favLoading, setFavLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/favorites").then(r => r.json()).then((d: { tracks: YTItem[] }) => {
      setFavIds(new Set(d.tracks.map(t => t.videoId)));
      setFavTracks(d.tracks);
    }).catch(() => {});
  }, [session?.user?.id]);

  // ── Queue helpers ────────────────────────────────────────────────────────────
  const [saveQueueName, setSaveQueueName] = useState("");
  const [savingQueue, setSavingQueue]     = useState(false);
  const [showSaveQueue, setShowSaveQueue] = useState(false);

  function openSaveQueue() {
    if (!showSaveQueue) {
      const d = new Date();
      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
      const lobbyLabel = activeLobby?.name ?? (activeLobby?.host?.name ? `${activeLobby.host.name}'s Lobby` : null);
      setSaveQueueName(lobbyLabel ? `${lobbyLabel} · ${dateStr}` : `Queue · ${dateStr}`);
    }
    setShowSaveQueue(s => !s);
  }

  function moveQueueItem(from: number, to: number) {
    if (to < 0 || to >= music.queue.length) return;
    const q = [...music.queue];
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    music.reorderQueue(q);
  }

  async function saveQueueAsPlaylist() {
    const rawName = saveQueueName.trim();
    if (!rawName || music.queue.length === 0) return;
    const name = `[Q] ${rawName}`;
    setSavingQueue(true);
    try {
      const tracks = music.track ? [music.track, ...music.queue] : music.queue;
      const res = await fetch("/api/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, tracks }) });
      if (res.ok) {
        const pl = await res.json() as Playlist;
        setPlaylists(p => [pl, ...p]);
        setSaveQueueName(""); setShowSaveQueue(false); setPlLoaded(true);
      }
    } finally { setSavingQueue(false); }
  }

  // ── Lobby list ────────────────────────────────────────────────────────────────
  const [lobbies, setLobbies]     = useState<LobbyListItem[]>([]);
  const [lobbyName, setLName]     = useState("");
  const [lobbyPass, setLPass]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [showCreate, setShowCreate2] = useState(false);
  const [joinPass, setJoinPass]   = useState<Record<string, string>>({});
  const [joining, setJoining]     = useState<string | null>(null);
  const [joinError, setJoinError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId]   = useState<string | null>(null);

  const fetchLobbies = useCallback(async () => {
    const res = await fetch("/api/music-lobbies");
    if (res.ok) setLobbies(await res.json());
  }, []);

  useEffect(() => {
    if (rightTab !== "lobbies") return;
    fetchLobbies();
    const t = setInterval(fetchLobbies, 5000);
    return () => clearInterval(t);
  }, [rightTab, fetchLobbies]);

  // ── Active lobby ──────────────────────────────────────────────────────────────
  const [activeLobby, setActiveLobby] = useState<ActiveLobby | null>(null);
  const heartbeatRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekSyncRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef        = useRef<EventSource | null>(null);
  const syncedTrackRef   = useRef<string | null>(null);
  const prevIsPlayingRef = useRef<boolean | null>(null);
  const lastLocalActionRef = useRef<number>(0);
  const lastSyncRef = useRef<{ playing: boolean | null; pos: number }>({ playing: null, pos: 0 });
  const isHostRef = useRef(false);
  const isHost = activeLobby?.host.id === session?.user?.id;
  isHostRef.current = isHost;

  useEffect(() => {
    if (!music.activeLobbyId) return;
    fetch(`/api/music-lobbies/${music.activeLobbyId}`).then(r => r.ok ? r.json() : null)
      .then((d: ActiveLobby | null) => {
        if (d && (d as ActiveLobby & { status?: string }).status !== "CLOSED") {
          setActiveLobby(d);
          applyLobbySync(d);
        } else music.setActiveLobbyId(null);
      }).catch(() => {});
  }, []); // eslint-disable-line

  const applyLobbySync = useCallback((d: Partial<ActiveLobby>, fromLocalAction = false) => {
    if (!fromLocalAction && Date.now() - lastLocalActionRef.current < 800) return;
    const hostReceivingSSE = isHostRef.current && !fromLocalAction;
    if (!d.trackUri) {
      if (syncedTrackRef.current && !hostReceivingSSE) { syncedTrackRef.current = null; prevIsPlayingRef.current = null; music.pause(); music.clearQueue(); }
      return;
    }
    const serverPos = () => (d.positionMs ?? 0) + (d.isPlaying ? Date.now() - new Date(d.syncedAt!).getTime() : 0);
    if (d.trackUri !== syncedTrackRef.current) {
      syncedTrackRef.current = d.trackUri;
      prevIsPlayingRef.current = d.isPlaying ?? null;
      if (!hostReceivingSSE) music.play({ videoId: d.trackUri, title: d.trackName ?? "", channel: d.trackArtist ?? "", thumbnail: d.trackImage ?? "" }, serverPos());
    } else if (!hostReceivingSSE) {
      const locallyPlaying = music.playerRef.current ? (music.playerRef.current as { getPlayerState?: () => number }).getPlayerState?.() === 1 : prevIsPlayingRef.current === true;
      if (!d.isPlaying && locallyPlaying) { prevIsPlayingRef.current = false; music.pause(); }
      else if (d.isPlaying && !locallyPlaying) {
        prevIsPlayingRef.current = true;
        const localPos = music.playerRef.current ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0;
        if (Math.abs(serverPos() - localPos) > 1500) music.seek(serverPos());
        music.resume();
      } else if (d.isPlaying) {
        const localPos = music.playerRef.current ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0;
        const drift = Math.abs(serverPos() - localPos);
        if (drift > 1500 && drift < 60000) music.seek(serverPos());
      }
    }

    if (!hostReceivingSSE && Array.isArray(d.queue)) {
      music.reorderQueue(d.queue);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!activeLobby) return;
    const es = new EventSource(`/api/music-lobbies/${activeLobby.id}/sse`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string) as Partial<ActiveLobby>;
        setActiveLobby(prev => prev ? { ...prev, ...d } : prev);
        applyLobbySync(d);
      } catch {}
    };
    return () => { es.close(); sseRef.current = null; };
  }, [activeLobby?.id, applyLobbySync]);

  useEffect(() => {
    if (!activeLobby || !session?.user?.id) return;
    const beat = () => fetch(`/api/music-lobbies/${activeLobby.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    beat();
    heartbeatRef.current = setInterval(beat, 15_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [activeLobby?.id, session?.user?.id]);

  const prevTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !activeLobby || !music.track) return;
    if (music.track.videoId === prevTrackIdRef.current) return;
    prevTrackIdRef.current = music.track.videoId;
    hostSync(music.track, 0, true);
  }, [music.track?.videoId]); // eslint-disable-line

  function hostSync(item: YTItem | null, posMs = 0, playing = true, queue?: YTItem[]) {
    if (!activeLobby) return;
    const q = queue ?? activeQueue;
    fetch(`/api/music-lobbies/${activeLobby.id}/sync`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item
        ? { trackUri: item.videoId, trackName: item.title, trackArtist: item.channel, trackImage: item.thumbnail, positionMs: posMs, isPlaying: playing, queue: q }
        : { trackUri: null, isPlaying: false, positionMs: 0, queue: [] }
      ),
    }).catch(() => {});
  }

  function pushSync(playing: boolean, overridePosMs?: number) {
    if (!music.track) return;
    const pos = overridePosMs ?? (music.playerRef.current ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0);
    if (lastSyncRef.current.playing === playing && Math.abs(lastSyncRef.current.pos - pos) < 500) return;
    lastSyncRef.current = { playing, pos };
    hostSync(music.track, pos, playing);
  }

  // Host pushes queue to lobby whenever it changes
  const prevQueueRef2 = useRef<string>("");
  useEffect(() => {
    if (!isHost || !activeLobby || !music.track) return;
    const serialized = JSON.stringify(music.queue);
    if (serialized === prevQueueRef2.current) return;
    prevQueueRef2.current = serialized;
    hostSync(music.track, music.playerRef.current ? Math.floor(music.playerRef.current.getCurrentTime() * 1000) : 0, music.isPlaying, music.queue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.queue]);

  async function enterLobby(id: string) {
    const res = await fetch(`/api/music-lobbies/${id}`);
    if (!res.ok) return;
    const d = await res.json() as ActiveLobby;
    music.setActiveLobbyId(id);
    setActiveLobby(d);
    applyLobbySync(d);
    setRightTab("people");
  }

  async function createLobby() {
    setCreating(true);
    try {
      const res = await fetch("/api/music-lobbies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: lobbyName, password: lobbyPass || undefined }) });
      if (res.ok) { const { id } = await res.json() as { id: string }; setLName(""); setLPass(""); setShowCreate2(false); await enterLobby(id); }
    } finally { setCreating(false); }
  }

  async function joinLobby(lobbyId: string, hasPass: boolean) {
    const pass = joinPass[lobbyId];
    if (hasPass && typeof pass !== "string") { setJoinPass(p => ({ ...p, [lobbyId]: "" })); return; }
    setJoining(lobbyId);
    try {
      const res = await fetch(`/api/music-lobbies/${lobbyId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pass || undefined }) });
      if (res.ok) await enterLobby(lobbyId);
      else { const d = await res.json(); setJoinError(p => ({ ...p, [lobbyId]: d.error ?? "Error" })); }
    } finally { setJoining(null); }
  }

  async function leaveLobby() {
    if (!activeLobby) return;
    await fetch(`/api/music-lobbies/${activeLobby.id}`, { method: "DELETE" }).catch(() => {});
    music.setActiveLobbyId(null); music.pause();
    setActiveLobby(null); music.clearQueue();
  }

  function copyLobbyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/music/${id}`);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
  }
  function copyPlaylistLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/playlists/${id}`);
    setCopiedPlId(id); setTimeout(() => setCopiedPlId(null), 1500);
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

  async function toggleFav(item: YTItem) {
    if (favLoading.has(item.videoId)) return;
    setFavLoading(s => { const n = new Set(s); n.add(item.videoId); return n; });
    try {
      const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      if (res.ok) {
        const d = await res.json() as { favorited: boolean };
        setFavIds(prev => { const n = new Set(prev); if (d.favorited) n.add(item.videoId); else n.delete(item.videoId); return n; });
        setFavTracks(prev => d.favorited ? [item, ...prev.filter(x => x.videoId !== item.videoId)] : prev.filter(x => x.videoId !== item.videoId));
      }
    } finally { setFavLoading(s => { const n = new Set(s); n.delete(item.videoId); return n; }); }
  }

  async function openAddToPl(item: YTItem) {
    setAddToPlItem(item);
    if (!plLoaded) { setAddPlLoading(true); try { const r = await fetch("/api/playlists"); if (r.ok) { setPlaylists(await r.json()); setPlLoaded(true); } } finally { setAddPlLoading(false); } }
  }
  async function doAddToPlaylist(plId: string, item: YTItem) {
    setAddingToPlId(plId);
    const pl = playlists.find(p => p.id === plId); if (!pl) return;
    const updated = [...pl.tracks, item];
    await fetch(`/api/playlists/${plId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks: updated }) });
    setPlaylists(prev => prev.map(p => p.id === plId ? { ...p, tracks: updated } : p));
    setAddingToPlId(null); setAddToPlItem(null);
  }
  async function removeFromPlaylist(plId: string, videoId: string) {
    const pl = playlists.find(p => p.id === plId); if (!pl) return;
    const updated = pl.tracks.filter(x => x.videoId !== videoId);
    await fetch(`/api/playlists/${plId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks: updated }) });
    setPlaylists(prev => prev.map(p => p.id === plId ? { ...p, tracks: updated } : p));
  }
  async function deletePlaylist(id: string) {
    await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    setPlaylists(p => p.filter(pl => pl.id !== id));
    if (music.activePlId === id) music.clearQueue();
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

  // ── Derived values ────────────────────────────────────────────────────────────
  const { track, isPlaying, positionMs, playerReady, queue: activeQueue, activePlId, activePlName, isShuffled, smartShuffle, smartLoading, toggleShuffle, setSmartShuffle, removeFromQueue, reorderQueue } = music;
  const duration = (music.playerRef.current?.getDuration?.() ?? 0) * 1000;
  const pct      = duration > 0 ? Math.min(100, (positionMs / duration) * 100) : 0;
  const isLive   = playerReady && duration === 0 && positionMs > 2000;

  if (!session?.user) return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center">
      <Music2 size={40} className="mx-auto mb-4 text-red-500" />
      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-2">{t("title")}</h1>
      <p className="text-[var(--text-muted)] mb-6">{t("signInRequired")}</p>
      <Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500 text-white font-display font-bold hover:opacity-90 no-underline">{t("signInBtn")}</Link>
    </main>
  );

  // ── Reusable sub-components ───────────────────────────────────────────────────
  const FavBtn = ({ item, sz = 13 }: { item: YTItem; sz?: number }) => (
    <button onClick={e => { e.stopPropagation(); toggleFav(item); }} disabled={favLoading.has(item.videoId)}
      className={["shrink-0 transition-colors p-1 rounded-lg", favIds.has(item.videoId) ? "text-red-400" : "text-[var(--text-muted)] hover:text-red-400", favLoading.has(item.videoId) ? "opacity-50" : ""].join(" ")}>
      <Heart size={sz} fill={favIds.has(item.videoId) ? "currentColor" : "none"} />
    </button>
  );

  // ── Queue panel (reused in right panel + mobile) ──────────────────────────────
  const QueuePanel = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">
          {t("tabQueue")} · {activeQueue.length}
        </span>
        {activeQueue.length > 0 && (
          <button onClick={openSaveQueue}
            className={["flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors",
              showSaveQueue ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"].join(" ")}>
            <Save size={11} />{t("queueSaveBtn")}
          </button>
        )}
      </div>
      {showSaveQueue && (
        <div className="flex gap-2">
          <input value={saveQueueName} onChange={e => setSaveQueueName(e.target.value)}
            placeholder={t("queueSavePlaceholder")} onKeyDown={e => e.key === "Enter" && saveQueueAsPlaylist()}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
          <button onClick={saveQueueAsPlaylist} disabled={savingQueue || !saveQueueName.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1">
            {savingQueue ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          </button>
        </div>
      )}
      {activeQueue.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ListOrdered size={28} className="text-[var(--text-muted)] opacity-30" />
          <p className="text-[var(--text-muted)] text-sm">{t("queueEmpty")}</p>
          <p className="text-xs text-[var(--text-muted)] opacity-60">{t("queueEmptyHint")}</p>
        </div>
      ) : activeQueue.map((q, i) => (
        <div key={`${q.videoId}-${i}`}
          className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors group">
          <span className="text-[0.6rem] text-[var(--text-muted)] w-4 shrink-0 text-center">{i + 1}</span>
          <Image src={q.thumbnail} alt="" width={32} height={24} className="rounded shrink-0 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{q.title}</p>
            <p className="text-[0.6rem] text-[var(--text-muted)] truncate">{q.channel}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => moveQueueItem(i, 0)} disabled={i === 0} title={t("toTop")} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronsUp size={11} /></button>
            <button onClick={() => moveQueueItem(i, i - 1)} disabled={i === 0} title={t("moveUp")} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20"><ArrowUp size={11} /></button>
            <button onClick={() => moveQueueItem(i, i + 1)} disabled={i === activeQueue.length - 1} title={t("moveDown")} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20"><ArrowDown size={11} /></button>
            <button onClick={() => moveQueueItem(i, activeQueue.length - 1)} disabled={i === activeQueue.length - 1} title={t("toBottom")} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronsDown size={11} /></button>
            <button onClick={() => removeFromQueue(i)} title={t("remove")} className="p-1 text-[var(--text-muted)] hover:text-red-400"><X size={11} /></button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Playlists panel ───────────────────────────────────────────────────────────
  const queuePls   = playlists.filter(p => p.name.startsWith("[Q] "));
  const regularPls = playlists.filter(p => !p.name.startsWith("[Q] "));

  const PlaylistRow = (pl: Playlist, displayName: string) => (
    <div key={pl.id} className="mb-2 rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]">
        <button onClick={() => setExpandedPl(expandedPl === pl.id ? null : pl.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <ChevronRight size={11} className={`text-[var(--text-muted)] shrink-0 transition-transform ${expandedPl === pl.id ? "rotate-90" : ""}`} />
          <span className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{displayName}</span>
          <span className="text-[0.6rem] text-[var(--text-muted)] shrink-0">{pl.tracks.length}</span>
        </button>
        <button onClick={() => copyPlaylistLink(pl.id)} title="Copy link" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
          {copiedPlId === pl.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
        </button>
        <button onClick={() => startPlaylist(pl)}
          className={["shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors", activePlId === pl.id ? "bg-red-500 text-white" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"].join(" ")}>
          <Play size={9} />{activePlId === pl.id ? t("playing") : t("playAll")}
        </button>
        <button onClick={() => deletePlaylist(pl.id)} className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors p-1"><Trash2 size={12} /></button>
      </div>
      {expandedPl === pl.id && (
        <div className="max-h-48 overflow-y-auto">
          {pl.tracks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-3">{t("emptyPlaylist")}</p>
          ) : pl.tracks.map((q, i) => (
            <div key={`${q.videoId}-${i}`} className={["flex items-center gap-2 px-3 py-2 border-t border-[var(--border-subtle)]", track?.videoId === q.videoId ? "bg-red-500/10" : ""].join(" ")}>
              <span className="text-[0.55rem] text-[var(--text-muted)] w-4 shrink-0">{i + 1}</span>
              <Image src={q.thumbnail} alt="" width={28} height={21} className="rounded shrink-0 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{q.title}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <FavBtn item={q} sz={11} />
                <button onClick={() => music.addToQueue(q)} title={t("addToQueue")} className="p-1 text-[var(--text-muted)] hover:text-red-400"><Plus size={11} /></button>
                <button onClick={() => { music.playPlaylist({ id: pl.id, name: pl.name, tracks: pl.tracks.slice(i) }); if (activeLobby) hostSync(q, 0, true); }} className="p-1 text-[var(--text-muted)] hover:text-red-400"><Play size={11} /></button>
                <button onClick={() => removeFromPlaylist(pl.id, q.videoId)} className="p-1 text-[var(--text-muted)] hover:text-red-400"><X size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const PlaylistsPanel = (
    <div>
      {/* Create / Import */}
      {!showCreatePl ? (
        <button onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-2 mb-3 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-display font-semibold hover:border-red-500/40 hover:text-red-400 transition-colors">
          <Plus size={13} />{t("newPlaylist")}
        </button>
      ) : (
        <div className="mb-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col gap-2">
          <input value={newPlName} onChange={e => setNewPlName(e.target.value)} placeholder={t("playlistNamePlaceholder")}
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
            <Youtube size={12} className="text-red-500 shrink-0" />
            <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder={t("ytUrlPlaceholder")}
              className="flex-1 text-sm bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          </div>
          {importErr && <p className="text-xs text-red-400">{importErr}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(false); setImportErr(null); setNewPlName(""); setYtUrl(""); }}
              className="flex-1 py-1.5 rounded-lg text-sm font-display font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">{t("cancel")}</button>
            <button onClick={ytUrl.trim() ? importYtPlaylist : createEmptyPlaylist}
              disabled={importing || creatingPl || (!newPlName.trim() && !ytUrl.trim())}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-display font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-50">
              {(importing || creatingPl) ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {ytUrl.trim() ? t("importBtn") : t("createBtn")}
            </button>
          </div>
        </div>
      )}

      {/* Favorites */}
      {favTracks.length > 0 && (
        <div className="mb-2 rounded-xl border border-red-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5">
            <button onClick={() => setExpandedPl(expandedPl === "__fav__" ? null : "__fav__")} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
              <ChevronRight size={11} className={`text-red-400 shrink-0 transition-transform ${expandedPl === "__fav__" ? "rotate-90" : ""}`} />
              <Heart size={11} className="text-red-400 shrink-0" fill="currentColor" />
              <span className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{t("favorites")}</span>
              <span className="text-[0.6rem] text-[var(--text-muted)] shrink-0">{favTracks.length}</span>
            </button>
            <button onClick={() => { music.playPlaylist({ id: "__fav__", name: t("favorites"), tracks: favTracks }); if (activeLobby) hostSync(favTracks[0], 0, true); }}
              className={["shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors", activePlId === "__fav__" ? "bg-red-500 text-white" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"].join(" ")}>
              <Play size={9} />{activePlId === "__fav__" ? t("playing") : t("playAll")}
            </button>
          </div>
          {expandedPl === "__fav__" && (
            <div className="max-h-48 overflow-y-auto">
              {favTracks.map((q, i) => (
                <div key={q.videoId} className={["flex items-center gap-2 px-3 py-2 border-t border-[var(--border-subtle)]", track?.videoId === q.videoId ? "bg-red-500/10" : ""].join(" ")}>
                  <span className="text-[0.55rem] text-[var(--text-muted)] w-4 shrink-0">{i + 1}</span>
                  <Image src={q.thumbnail} alt="" width={28} height={21} className="rounded shrink-0 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{q.title}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <FavBtn item={q} sz={11} />
                    <button onClick={() => music.addToQueue(q)} className="p-1 text-[var(--text-muted)] hover:text-red-400"><Plus size={11} /></button>
                    <button onClick={() => { music.playPlaylist({ id: "__fav__", name: t("favorites"), tracks: favTracks.slice(i) }); if (activeLobby) hostSync(q, 0, true); }} className="p-1 text-[var(--text-muted)] hover:text-red-400"><Play size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!plLoaded ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : (
        <>
          {queuePls.length > 0 && (
            <>
              <p className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListOrdered size={11} />{t("savedQueues")}
              </p>
              {queuePls.map(pl => PlaylistRow(pl, pl.name.slice(4)))}
              {regularPls.length > 0 && <div className="border-t border-[var(--border-subtle)] my-3" />}
            </>
          )}
          {regularPls.length === 0 && queuePls.length === 0
            ? <div className="text-center py-8"><ListMusic size={24} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" /><p className="text-sm text-[var(--text-muted)]">{t("noPlaylists")}</p></div>
            : regularPls.map(pl => PlaylistRow(pl, pl.name))}
        </>
      )}
    </div>
  );

  // ── Tab definitions ───────────────────────────────────────────────────────────
  type TabDef = { key: RightTab; icon: React.ElementType; label: string; badge?: number; lobbyOnly?: boolean };
  const tabs: TabDef[] = [
    { key: "queue",     icon: ListOrdered, label: t("tabQueue"),    badge: activeQueue.length },
    { key: "playlists", icon: ListMusic,   label: t("tabPlaylists") },
    { key: "lobbies",   icon: Users,       label: t("tabLobbies") },
    ...(activeLobby ? [
      { key: "people"  as RightTab, icon: Users,    label: t("tabListeners"), lobbyOnly: true },
      { key: "history" as RightTab, icon: History,  label: t("tabHistory"),   lobbyOnly: true },
    ] : []),
  ];

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6">
      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-6 flex items-center gap-2.5">
        <Music2 size={22} className="text-red-500 shrink-0" />{t("title")}
      </h1>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_360px] gap-5">

        {/* ── LEFT: Player ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Search bar */}
          <div ref={searchRef} className="relative">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onFocus={() => results.length > 0 && setSearchOpen(true)}
                placeholder={activeLobby ? t("searchPlaceholderLobby") : t("searchPlaceholder")}
                className="w-full h-11 pl-10 pr-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm outline-none focus:border-red-500/40 placeholder:text-[var(--text-muted)]"
              />
              {searching && <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />}
            </div>
            {searchOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-[var(--border-subtle)] bg-[rgba(12,12,14,0.99)] backdrop-blur-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                {searchErr ? (
                  <p className="px-4 py-3 text-sm text-[var(--text-muted)]">{searchErr}</p>
                ) : results.map(r => (
                  <div key={r.videoId} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors group">
                    <Image src={r.thumbnail} alt="" width={48} height={36} className="rounded-lg shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{r.title}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{r.channel}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                      <button onClick={() => { music.addToQueue(r); setSearchOpen(false); setSearchQ(""); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/25">
                        <Plus size={10} />{t("queueBtn")}
                      </button>
                      <button onClick={() => playTrack(r)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-bold hover:text-[var(--text-primary)] transition-colors">
                        <Play size={10} />{t("replaceBtn")}
                      </button>
                      <FavBtn item={r} sz={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player card */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            {track ? (
              <div className="flex flex-col gap-4">
                {/* Video */}
                {showVideo && (
                  <YouTubePlayer ref={ytVideoRef} videoId={track.videoId} title={track.title} startSeconds={videoStartSec}
                    muted externalPlaying={isPlaying}
                    onSeek={sec => { music.seek(sec * 1000); if (activeLobby) { lastLocalActionRef.current = Date.now(); if (seekSyncRef.current) clearTimeout(seekSyncRef.current); seekSyncRef.current = setTimeout(() => pushSync(isPlaying, sec * 1000), 120); } }}
                    onPlayPause={playing => { lastLocalActionRef.current = Date.now(); if (playing) { music.resume(); if (activeLobby) pushSync(true); } else { music.pause(); if (activeLobby) pushSync(false); } }}
                    onClose={() => setShowVideo(false)} className="rounded-xl" />
                )}

                {/* Track info */}
                <div className="flex items-center gap-4">
                  <button onClick={() => { if (!showVideo) { setVideoStartSec(Math.floor(positionMs / 1000)); setShowVideo(true); } else setShowVideo(false); }}
                    className="relative shrink-0 group rounded-xl overflow-hidden shadow-lg">
                    <Image src={track.thumbnail} alt="" width={72} height={72} className="rounded-xl object-cover block" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <MonitorPlay size={20} className="text-white" />
                    </div>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-extrabold text-[var(--text-primary)] text-base sm:text-lg truncate leading-tight">{track.title}</p>
                    <p className="text-[var(--text-muted)] text-sm truncate">{track.channel}</p>
                    {activePlId && (
                      <p className="text-xs text-red-400 flex items-center gap-1 mt-1 truncate">
                        <ListMusic size={10} className="shrink-0" />
                        <span className="truncate max-w-[160px]">{activePlName ?? "Playlist"}</span>
                        <span className="shrink-0">· {activeQueue.length} left</span>
                        {isShuffled && <Shuffle size={9} className="shrink-0 ml-1" />}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <button onClick={() => toggleFav(track)} disabled={favLoading.has(track.videoId)}
                        className={["flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors",
                          favIds.has(track.videoId) ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30"].join(" ")}>
                        <Heart size={10} fill={favIds.has(track.videoId) ? "currentColor" : "none"} />
                        {favIds.has(track.videoId) ? t("likedBtn") : t("likeBtn")}
                      </button>
                      <button onClick={() => openAddToPl(track)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <Plus size={10} />{t("playlistBtn")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {isLive ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/40">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wide">{t("live")}</span>
                    </div>
                    <div className="flex-1 h-1.5 rounded-full bg-red-500/30" />
                  </div>
                ) : (
                  <>
                    <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ms = Math.floor(((e.clientX - rect.left) / rect.width) * duration);
                        music.seek(ms); ytVideoRef.current?.seekTo(ms / 1000);
                        if (activeLobby) { lastLocalActionRef.current = Date.now(); if (seekSyncRef.current) clearTimeout(seekSyncRef.current); seekSyncRef.current = setTimeout(() => pushSync(isPlaying, ms), 120); }
                      }}>
                      <div className="h-full bg-red-500 rounded-full group-hover:bg-red-400 transition-colors" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between -mt-2">
                      <span className="text-xs text-[var(--text-muted)]">{fmtMs(positionMs)}</span>
                      <span className="text-xs text-[var(--text-muted)]">{fmtMs(duration)}</span>
                    </div>
                  </>
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-6">
                  <button onClick={music.prev} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipBack size={22} /></button>
                  <button onClick={() => { lastLocalActionRef.current = Date.now(); if (isPlaying) { music.pause(); if (activeLobby) pushSync(false); } else { music.resume(); if (activeLobby) pushSync(true); } }}
                    className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-105 transition-transform shadow-lg shadow-red-500/30">
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button onClick={music.next} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><SkipForward size={22} /></button>
                </div>

                {/* Toggles + Volume */}
                <div className="flex flex-wrap items-center gap-2">
                  {activeQueue.length > 0 && (
                    <button onClick={toggleShuffle}
                      className={["flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold border transition-colors",
                        isShuffled ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"].join(" ")}>
                      <Shuffle size={11} />{t("shuffle")}
                    </button>
                  )}
                  <button onClick={() => setSmartShuffle(!smartShuffle)}
                    className={["flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold border transition-all",
                      smartShuffle ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.25)]" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-purple-500/30 hover:text-purple-400"].join(" ")}>
                    {smartLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className={smartShuffle ? "text-purple-300" : ""} />}
                    {smartShuffle ? t("smartOn") : t("smart")}
                  </button>
                  <div className="flex items-center gap-2 ml-auto">
                    <Volume2 size={13} className="text-[var(--text-muted)] shrink-0" />
                    <input type="range" min={0} max={100} value={volume} onChange={e => handleVol(Number(e.target.value))} className="w-20 sm:w-28 h-1.5 accent-red-500 cursor-pointer" />
                    <span className="text-xs text-[var(--text-muted)] w-6 text-right">{volume}</span>
                  </div>
                </div>

                {/* Lobby status */}
                {activeLobby && (
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${activeLobby.isPlaying ? "bg-red-500 animate-pulse" : "bg-[var(--text-muted)]"}`} />
                      {activeLobby.name || `${activeLobby.host.name ?? "?"}'s room`}
                      <span className="text-[0.65rem] text-[var(--text-muted)] flex items-center gap-0.5"><Users size={10} />{activeLobby.members.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/music/${activeLobby.id}`} title={t("openFullPage")}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
                        <ExternalLink size={13} />
                      </Link>
                      {isHost && (
                        <button onClick={() => { music.pause(); music.clearQueue(); hostSync(null); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors">
                          <X size={11} />{t("closeSong")}
                        </button>
                      )}
                      <button onClick={leaveLobby}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
                        <Minus size={11} />{isHost ? t("closeRoom") : t("leaveRoom")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Music2 size={36} className="text-[var(--text-muted)] opacity-30" />
                <p className="text-[var(--text-muted)] text-sm">{t("noTrack")}</p>
                {!playerReady && <p className="text-xs text-[var(--text-muted)] opacity-60">{t("loadingPlayer")}</p>}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Tab panel ───────────────────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden lg:sticky lg:top-[calc(64px+1.5rem)] lg:max-h-[calc(100vh-64px-3rem)]">

          {/* Tab bar */}
          <div className="flex border-b border-[var(--border-subtle)] shrink-0 overflow-x-auto">
            {tabs.map(({ key, icon: Icon, label, badge }) => (
              <button key={key} onClick={() => setRightTab(key)}
                className={["flex-1 min-w-[60px] flex flex-col items-center gap-0.5 py-3 text-[0.6rem] sm:text-xs font-display font-bold uppercase tracking-wide transition-colors whitespace-nowrap px-1",
                  rightTab === key ? "text-red-400 border-b-2 border-red-500" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
                <Icon size={14} />
                {badge != null && badge > 0
                  ? <span className="relative">{label}<span className="absolute -top-1.5 -right-3 text-[0.45rem] bg-red-500 text-white rounded-full px-0.5 leading-tight">{badge}</span></span>
                  : label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">

            {rightTab === "queue" && QueuePanel}

            {rightTab === "playlists" && PlaylistsPanel}

            {rightTab === "lobbies" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">{t("lobbiesTitle")}</span>
                  <button onClick={() => setShowCreate2(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-display font-bold hover:bg-red-500/25 transition-colors">
                    <Plus size={12} />{t("createRoom")}
                  </button>
                </div>

                {showCreate && (
                  <div className="mb-4 p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col gap-3">
                    <p className="text-sm font-display font-bold text-[var(--text-primary)]">{t("createRoomTitle")}</p>
                    <div>
                      <label className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">{t("lobbyNameLabel")}</label>
                      <input value={lobbyName} onChange={e => setLName(e.target.value)} placeholder={t("lobbyNamePlaceholder")}
                        className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
                    </div>
                    <div>
                      <label className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">{t("lobbyPassLabel")}</label>
                      <input type="password" value={lobbyPass} onChange={e => setLPass(e.target.value)} placeholder={t("lobbyPassPlaceholder")}
                        className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-red-500/40" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowCreate2(false)}
                        className="flex-1 py-2 rounded-xl text-sm font-display font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">{t("cancel")}</button>
                      <button onClick={createLobby} disabled={creating}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-display font-bold bg-red-500 text-white hover:opacity-90 disabled:opacity-50">
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{t("createRoom")}
                      </button>
                    </div>
                  </div>
                )}

                {lobbies.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <Users size={28} className="text-[var(--text-muted)] opacity-30" />
                    <p className="text-sm text-[var(--text-muted)]">{t("noLobbies")}</p>
                  </div>
                ) : lobbies.map(lobby => (
                  <div key={lobby.id} className="px-3 py-3 border border-[var(--border-subtle)] rounded-2xl mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-display font-semibold text-[var(--text-primary)] truncate flex-1">
                        {lobby.name || `${lobby.host.name ?? "?"}'s room`}
                      </span>
                      {lobby.hasPassword && <Lock size={11} className="text-[var(--text-muted)] shrink-0" />}
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-0.5 shrink-0"><Users size={10} />{lobby.memberCount}</span>
                      <button onClick={() => copyLobbyLink(lobby.id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
                        {copiedId === lobby.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                    {lobby.trackName && <p className="text-xs text-[var(--text-muted)] truncate mb-2">{lobby.isPlaying ? "▶ " : "⏸ "}{lobby.trackName}</p>}
                    {lobby.hasPassword && typeof joinPass[lobby.id] === "string" && (
                      <input type="password" placeholder="Password" value={joinPass[lobby.id]}
                        onChange={e => setJoinPass(p => ({ ...p, [lobby.id]: e.target.value }))}
                        className="w-full mb-2 px-3 py-1.5 rounded-xl text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none" />
                    )}
                    <button onClick={() => { setJoinError(p => ({ ...p, [lobby.id]: "" })); joinLobby(lobby.id, lobby.hasPassword); }} disabled={joining === lobby.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50">
                      {joining === lobby.id ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}{t("joinBtn")}
                    </button>
                    {joinError[lobby.id] && <p className="text-xs text-red-400 mt-1">{joinError[lobby.id]}</p>}
                  </div>
                ))}
              </div>
            )}

            {rightTab === "people" && activeLobby && (
              <div>
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[var(--border-subtle)]">
                  {activeLobby.host.image
                    ? <Image src={activeLobby.host.image} alt="" width={32} height={32} className="rounded-full shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-sm font-bold">{activeLobby.host.name?.[0] ?? "?"}</div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{activeLobby.host.name ?? "Host"}</p>
                    <p className="text-xs text-red-400">{t("host")}</p>
                  </div>
                </div>
                {activeLobby.members.filter(m => m.id !== activeLobby.host.id).map(m => (
                  <div key={m.id} className="flex items-center gap-3 mb-2">
                    {m.image ? <Image src={m.image} alt="" width={26} height={26} className="rounded-full shrink-0" />
                      : <div className="w-[26px] h-[26px] rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] text-xs font-bold">{m.name?.[0] ?? "?"}</div>}
                    <p className="text-sm text-[var(--text-secondary)] truncate">{m.name ?? "Anonymous"}</p>
                  </div>
                ))}
                {activeLobby.members.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-6">{t("noListeners")}</p>}
              </div>
            )}

            {rightTab === "history" && activeLobby && (
              <div>
                {(!activeLobby.history?.length) ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <History size={28} className="text-[var(--text-muted)] opacity-30" />
                    <p className="text-sm text-[var(--text-muted)]">{t("noHistory")}</p>
                  </div>
                ) : activeLobby.history.map((item, i) => (
                  <div key={`${item.videoId}-${i}`} className="flex items-center gap-3 p-2 rounded-xl mb-1">
                    <button onClick={() => playTrack(item)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <Image src={item.thumbnail} alt="" width={40} height={30} className="rounded-lg shrink-0 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{item.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">{timeAgo(item.at)}</p>
                      </div>
                    </button>
                    <button onClick={() => music.addToQueue(item)} title={t("addToQueue")} className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors p-1">
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add-to-playlist modal ─────────────────────────────────────────────── */}
      {addToPlItem && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 w-80 shadow-2xl">
            <p className="text-sm font-display font-bold text-[var(--text-primary)] mb-1">{t("playlistBtn")}</p>
            <p className="text-xs text-[var(--text-muted)] mb-3 truncate">{addToPlItem.title}</p>
            {addPlLoading && !plLoaded ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>
            ) : playlists.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-2 mb-3">No playlists yet.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto flex flex-col gap-1 mb-3">
                {playlists.map(pl => (
                  <button key={pl.id} onClick={() => doAddToPlaylist(pl.id, addToPlItem!)}
                    disabled={addingToPlId === pl.id || pl.tracks.some(q => q.videoId === addToPlItem.videoId)}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2 disabled:opacity-40">
                    {addingToPlId === pl.id ? <Loader2 size={11} className="animate-spin shrink-0" /> : pl.tracks.some(q => q.videoId === addToPlItem.videoId) ? <Check size={11} className="text-green-400 shrink-0" /> : <ListMusic size={11} className="shrink-0" />}
                    <span className="truncate flex-1">{pl.name.startsWith("[Q] ") ? pl.name.slice(4) : pl.name}</span>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">{pl.tracks.length}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setAddToPlItem(null)}
              className="w-full py-2 rounded-xl text-sm font-display font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
