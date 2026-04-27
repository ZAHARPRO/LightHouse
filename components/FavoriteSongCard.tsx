"use client";

import { useMusicContext } from "@/contexts/MusicContext";
import { Play, Music2 } from "lucide-react";
import Image from "next/image";

type YTItem = { videoId: string; title: string; channel: string; thumbnail: string };

export default function FavoriteSongCard({ song }: { song: YTItem }) {
  const music = useMusicContext();

  return (
    <button
      onClick={() => music.play(song)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-red-500/40 hover:bg-red-500/5 transition-all group text-left"
    >
      <div className="relative shrink-0">
        <Image
          src={song.thumbnail}
          alt=""
          width={52}
          height={39}
          className="rounded-lg object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
          <Play size={15} fill="white" className="text-white ml-0.5" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate leading-tight">
          {song.title}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{song.channel}</p>
      </div>
      <div className="shrink-0 w-8 h-8 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 group-hover:bg-red-500 group-hover:text-white flex items-center justify-center transition-all">
        <Play size={12} fill="currentColor" className="ml-0.5" />
      </div>
    </button>
  );
}

export function FavoriteSongPlaceholder() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--border-subtle)] opacity-40">
      <div className="w-[52px] h-[39px] rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
        <Music2 size={16} className="text-[var(--text-muted)]" />
      </div>
      <div>
        <p className="text-xs font-display font-semibold text-[var(--text-muted)]">No profile song</p>
        <p className="text-[0.65rem] text-[var(--text-muted)]">Not set by user</p>
      </div>
    </div>
  );
}
