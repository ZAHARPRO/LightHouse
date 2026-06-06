"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Eye, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRank } from "@/lib/elo";
import MatchHistoryButton from "@/components/MatchHistory";
import MatchmakingCard from "@/components/MatchmakingCard";
import { useMatchmakingQueue } from "@/lib/useMatchmakingQueue";
import { playSound } from "@/lib/gameSounds";
import { useEffect } from "react";

type RoomItem = {
  id: string;
  timeControl: string;
  spectatorCount: number;
  host:  { id: string; name: string | null; image: string | null; chessElo: number };
  guest?: { id: string; name: string | null; image: string | null; chessElo: number } | null;
};

const TC_LABELS: Record<string, string> = {
  "300": "🔥 5 min",
  "600": "⏱ 10 min",
  "1500": "🕐 25 min",
};

const TIME_OPTIONS = [
  { value: "300",  label: "5 min",  icon: "🔥" },
  { value: "600",  label: "10 min", icon: "⏱" },
  { value: "1500", label: "25 min", icon: "🕐" },
];

const pill = (active: boolean) =>
  ["flex-1 px-3 py-2 rounded-lg text-sm font-display font-semibold border transition-all",
    active
      ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ].join(" ");

export default function RatedChessLobby() {
  const t  = useTranslations("matchmaking");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [timeControl, setTimeControl] = useState("600");
  const [playing, setPlaying] = useState<RoomItem[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      const res = await fetch("/api/chess-rooms?rated=true");
      if (res.ok) { const d = await res.json(); setPlaying(d.playing ?? []); }
    };
    fetch_();
    const id = setInterval(fetch_, 4000);
    return () => clearInterval(id);
  }, []);

  const queue = useMatchmakingQueue({
    gameKey: "chess",
    returning: searchParams.get("returning") === "1",
    startSearch: async () => {
      const res = await fetch("/api/chess-rooms/matchmake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl }),
      });
      if (!res.ok) return null;
      const { roomId, matched } = await res.json() as { roomId: string; matched: boolean };
      if (matched) { playSound("opponent_found"); router.push(`/games/chess/online/${roomId}`); return null; }
      return roomId;
    },
    cancelSearch: async () => { await fetch("/api/chess-rooms/matchmake", { method: "DELETE" }); },
    checkMatch: async (roomId) => {
      const r = await fetch(`/api/chess-rooms/${roomId}`);
      if (!r.ok) return null;
      const room = await r.json();
      if (room.guestId) { playSound("opponent_found"); return `/games/chess/online/${roomId}`; }
      return null;
    },
    onNavigate: (route) => router.push(route),
    pollIntervalMs: 1500,
  });

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
        ← Games
      </Link>

      <div className="flex items-center gap-2 mt-3 mb-1">
        <Star size={20} className="text-yellow-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Rated Chess</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-6">{t("winToGain")}</p>
      {session?.user?.id && <div className="mb-6"><MatchHistoryButton userId={session.user.id} label={t("myHistory")} /></div>}

      <MatchmakingCard
        searching={queue.searching}
        elapsed={queue.elapsed}
        mutedSecs={queue.mutedSecs}
        onFindMatch={queue.findMatch}
        onCancel={queue.cancel}
        disabled={!session?.user?.id}
        accentColor="pink"
        searchingLabel={TC_LABELS[timeControl]}
      >
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Time Control</p>
        <div className="flex gap-2 mb-5">
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTimeControl(opt.value)} disabled={queue.searching}
              className={pill(timeControl === opt.value)}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </MatchmakingCard>

      {playing.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-yellow-400" />
            <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
              {t("liveGames")} ({playing.length})
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {playing.map(room => {
              const hostRank  = getRank(room.host.chessElo);
              const guestRank = room.guest ? getRank(room.guest.chessElo) : null;
              return (
                <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {room.host.image
                      ? <Image src={room.host.image} alt="" width={28} height={28} className="rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{room.host.name?.[0] ?? "?"}</div>}
                    <span className="text-[0.65rem] text-[var(--text-muted)]">vs</span>
                    {room.guest?.image
                      ? <Image src={room.guest.image} alt="" width={28} height={28} className="rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{room.guest?.name?.[0] ?? "?"}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                      {room.host.name ?? "?"} vs {room.guest?.name ?? "?"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">{TC_LABELS[room.timeControl] ?? room.timeControl}</span>
                      {hostRank && <span className="text-[0.6rem] font-bold px-1 py-[0.1rem] rounded-full" style={{ background: `${hostRank.color}22`, color: hostRank.color, border: `1px solid ${hostRank.color}44` }}>{hostRank.label}</span>}
                      {guestRank && <span className="text-[0.6rem] font-bold px-1 py-[0.1rem] rounded-full" style={{ background: `${guestRank.color}22`, color: guestRank.color, border: `1px solid ${guestRank.color}44` }}>{guestRank.label}</span>}
                    </div>
                  </div>
                  <Link href={`/games/chess/online/${room.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-display font-bold text-xs hover:bg-yellow-500/20 transition-colors no-underline">
                    <Eye size={12} /> Watch
                    {room.spectatorCount > 0 && <span className="ml-0.5 text-[0.6rem] opacity-80">{room.spectatorCount}</span>}
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
