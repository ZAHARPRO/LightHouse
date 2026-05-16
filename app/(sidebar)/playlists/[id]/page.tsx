"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMusicContext } from "@/contexts/MusicContext";
import Image from "next/image";
import Link from "next/link";
import {
  ListMusic, Play, Loader2, Copy, Check, Music2, Plus,
} from "lucide-react";

type YTItem = { videoId: string; title: string; channel: string; thumbnail: string };
type PlaylistData = { id: string; name: string; ownerName: string | null; tracks: YTItem[] };

function displayName(raw: string) {
  return raw.startsWith("[Q] ") ? raw.slice(4) : raw;
}
function isQueue(raw: string) {
  return raw.startsWith("[Q] ");
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const music = useMusicContext();

  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [queuedId, setQueuedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/playlists/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: PlaylistData) => setPlaylist(d))
      .catch(() => setError("Playlist not found."))
      .finally(() => setLoading(false));
  }, [id]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function addToQueue(t: YTItem) {
    music.addToQueue(t);
    setQueuedId(t.videoId);
    setTimeout(() => setQueuedId(null), 1200);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
    </div>
  );

  if (error || !playlist) return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center">
      <ListMusic size={36} className="mx-auto mb-4 text-[var(--text-muted)] opacity-40" />
      <p className="text-[var(--text-primary)] font-display font-bold text-lg mb-2">{error ?? "Not found"}</p>
      <Link href="/feed" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-primary)]">← Back to feed</Link>
    </main>
  );

  const name = displayName(playlist.name);
  const queue = isQueue(playlist.name);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/feed" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← Feed</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            {queue
              ? <ListMusic size={22} className="text-red-400" />
              : <Music2 size={22} className="text-red-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] leading-tight">{name}</h1>
            {playlist.ownerName && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">by {playlist.ownerName}</p>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {queue && <span className="text-red-400 font-bold mr-1.5">Saved Queue ·</span>}
              {playlist.tracks.length} track{playlist.tracks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => music.playPlaylist({ id: playlist.id, name: playlist.name, tracks: playlist.tracks })}
            disabled={playlist.tracks.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-display font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Play size={13} /> Play all
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm font-display font-semibold hover:text-[var(--text-primary)] transition-colors"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {/* Track list */}
      {playlist.tracks.length === 0 ? (
        <div className="text-center py-16">
          <ListMusic size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
          <p className="text-[var(--text-muted)] text-sm">This playlist is empty</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {playlist.tracks.map((t, i) => (
            <div key={`${t.videoId}-${i}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors group">
              <span className="text-xs text-[var(--text-muted)] w-5 shrink-0 text-right">{i + 1}</span>
              <Image src={t.thumbnail} alt="" width={48} height={36} className="rounded-lg shrink-0 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate leading-tight">{t.title}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{t.channel}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => addToQueue(t)}
                  title="Add to queue"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-bold hover:text-red-400 hover:border-red-500/30 transition-colors"
                >
                  {queuedId === t.videoId ? <Check size={10} className="text-green-400" /> : <Plus size={10} />}
                  Queue
                </button>
                <button
                  onClick={() => music.playPlaylist({ id: playlist.id, name: playlist.name, tracks: playlist.tracks.slice(i) })}
                  title="Play from here"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-colors"
                >
                  <Play size={10} /> Play
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
