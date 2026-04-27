"use client";

import { useState } from "react";
import { ListMusic, Heart, Loader2, Pin, PinOff, X, Play, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useMusicContext } from "@/contexts/MusicContext";

type YTItem = { videoId: string; title: string; channel: string; thumbnail: string };
type Playlist = { id: string; name: string; tracks: YTItem[] };

export default function ProfilePlaylists({
  initialFavSong,
}: {
  initialFavSong: YTItem | null;
}) {
  const music = useMusicContext();
  const [open, setOpen] = useState(false);
  const [favTracks, setFavTracks] = useState<YTItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [favSong, setFavSong] = useState<YTItem | null>(initialFavSong);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const [favRes, plRes] = await Promise.all([
        fetch("/api/favorites"),
        fetch("/api/playlists"),
      ]);
      if (favRes.ok) { const d = await favRes.json(); setFavTracks(d.tracks ?? []); }
      if (plRes.ok) { const d = await plRes.json(); setPlaylists(d); }
      setLoaded(true);
    } finally { setLoading(false); }
  }

  function handleOpen() { setOpen(true); load(); }

  async function setProfileSong(item: YTItem | null) {
    const key = item?.videoId ?? "__clear__";
    setSaving(key);
    try {
      const res = await fetch("/api/user/favorite-song", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) setFavSong(item);
    } finally { setSaving(null); }
  }

  const totalCount = (favTracks.length > 0 ? 1 : 0) + playlists.length;

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 no-underline text-[0.8125rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] py-[0.25rem] px-[0.75rem] rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-colors"
      >
        <ListMusic size={13} />
        Playlists
        {totalCount > 0 && <span className="text-[0.7rem]">({totalCount})</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
            style={{ maxHeight: "82vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
              <ListMusic size={15} className="text-red-400" />
              <span className="flex-1 font-display font-bold text-[var(--text-primary)]">My Playlists</span>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Profile song section */}
            <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0">
              <p className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Profile Song
              </p>
              {favSong ? (
                <div className="flex items-center gap-3">
                  <Image src={favSong.thumbnail} alt="" width={44} height={33} className="rounded-lg shrink-0 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">{favSong.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{favSong.channel}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => music.playNow(favSong)}
                      className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                      title="Play"
                    >
                      <Play size={12} />
                    </button>
                    <button
                      onClick={() => setProfileSong(null)}
                      disabled={saving === "__clear__"}
                      className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      title="Remove profile song"
                    >
                      {saving === "__clear__" ? <Loader2 size={12} className="animate-spin" /> : <PinOff size={12} />}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[0.75rem] text-[var(--text-muted)]">
                  No profile song set — pin one from your favorites or playlists below.
                </p>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(82vh - 175px)" }}>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : (
                <>
                  {/* Favorites */}
                  {favTracks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--border-subtle)] bg-[rgba(239,68,68,0.04)] sticky top-0">
                        <Heart size={11} className="text-red-400" fill="currentColor" />
                        <span className="text-xs font-display font-bold text-[var(--text-primary)]">Favorites</span>
                        <span className="text-[0.62rem] text-[var(--text-muted)]">{favTracks.length} tracks</span>
                      </div>
                      {favTracks.map(t => (
                        <TrackRow
                          key={t.videoId} item={t}
                          isProfileSong={favSong?.videoId === t.videoId}
                          saving={saving === t.videoId}
                          onPlay={() => music.playNow(t)}
                          onPin={() => setProfileSong(favSong?.videoId === t.videoId ? null : t)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Regular playlists */}
                  {playlists.map(pl => (
                    <div key={pl.id}>
                      <button
                        onClick={() => setExpanded(expanded === pl.id ? null : pl.id)}
                        className="w-full flex items-center gap-2 px-5 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)] transition-colors text-left sticky top-0"
                      >
                        <ChevronRight size={11} className={`text-[var(--text-muted)] transition-transform ${expanded === pl.id ? "rotate-90" : ""}`} />
                        <ListMusic size={11} className="text-[var(--text-muted)]" />
                        <span className="text-xs font-display font-bold text-[var(--text-primary)] flex-1 truncate">{pl.name}</span>
                        <span className="text-[0.62rem] text-[var(--text-muted)]">{pl.tracks.length}</span>
                      </button>
                      {expanded === pl.id && pl.tracks.map(t => (
                        <TrackRow
                          key={t.videoId} item={t}
                          isProfileSong={favSong?.videoId === t.videoId}
                          saving={saving === t.videoId}
                          onPlay={() => music.playNow(t)}
                          onPin={() => setProfileSong(favSong?.videoId === t.videoId ? null : t)}
                        />
                      ))}
                    </div>
                  ))}

                  {!favTracks.length && !playlists.length && (
                    <div className="text-center py-12">
                      <ListMusic size={28} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
                      <p className="text-[var(--text-muted)] text-sm">No playlists or favorites yet.</p>
                      <p className="text-[0.75rem] text-[var(--text-muted)] mt-1 opacity-70">
                        Like tracks in the music player to add them to favorites.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TrackRow({ item, isProfileSong, saving, onPlay, onPin }: {
  item: YTItem;
  isProfileSong: boolean;
  saving: boolean;
  onPlay: () => void;
  onPin: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition-colors group">
      <Image src={item.thumbnail} alt="" width={38} height={28} className="rounded shrink-0 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-display font-semibold text-[var(--text-primary)] truncate">{item.title}</p>
        <p className="text-[0.62rem] text-[var(--text-muted)] truncate">{item.channel}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Pin indicator (always visible when pinned) */}
        {isProfileSong && !saving && (
          <Pin size={9} className="text-amber-400 group-hover:hidden shrink-0" />
        )}
        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={onPlay}
            title="Play"
            className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
          >
            <Play size={11} />
          </button>
          <button
            onClick={onPin}
            disabled={saving}
            title={isProfileSong ? "Remove from profile" : "Set as profile song"}
            className={[
              "p-1.5 rounded-lg border transition-colors",
              isProfileSong
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-500/30",
            ].join(" ")}
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Pin size={11} />}
          </button>
        </div>
      </div>
    </div>
  );
}
