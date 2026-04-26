"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Loader2, Star, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRank } from "@/lib/elo";

type RoomItem = {
  id: string;
  difficulty: string;
  guestId: string | null;
  spectatorCount: number;
  host: { id: string; name: string | null; image: string | null; minesweeperElo: number };
  guest?: { id: string; name: string | null; image: string | null; minesweeperElo: number } | null;
};

const DIFF_LABEL: Record<string, string> = {
  easy: "🟢 Easy",
  medium: "🟡 Medium",
  hard: "🔴 Hard",
};

const DIFF_OPTIONS = [
  { value: "easy",   label: "Easy",   icon: "🟢" },
  { value: "medium", label: "Medium", icon: "🟡" },
  { value: "hard",   label: "Hard",   icon: "🔴" },
];

export default function RatedMinesweeperLobby() {
  const router = useRouter();
  const [waiting, setWaiting] = useState<RoomItem[]>([]);
  const [playing, setPlaying] = useState<RoomItem[]>([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/ms-rooms?rated=true");
    if (res.ok) {
      const data = await res.json();
      setWaiting(data.waiting ?? []);
      setPlaying(data.playing ?? []);
    }
  }

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 3000);
    return () => clearInterval(t);
  }, []);

  async function createRoom() {
    setCreating(true);
    try {
      const res = await fetch("/api/ms-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, rated: true }),
      });
      if (res.ok) router.push(`/games/minesweeper/online/${(await res.json()).id}`);
    } finally { setCreating(false); }
  }

  async function joinRoom(roomId: string) {
    setJoiningId(roomId);
    try {
      const res = await fetch(`/api/ms-rooms/${roomId}/join`, { method: "POST" });
      if (res.ok) router.push(`/games/minesweeper/online/${roomId}`);
      else fetchRooms();
    } finally { setJoiningId(null); }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Games
        </Link>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Star size={20} className="text-yellow-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Rated Minesweeper</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">Win to gain ELO · Lose to drop ELO</p>

      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Difficulty</p>
        <div className="flex gap-2 mb-4">
          {DIFF_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDifficulty(opt.value)}
              className={["flex-1 px-3 py-2 rounded-lg text-sm font-display font-semibold border transition-all",
                difficulty === opt.value
                  ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
                  : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              ].join(" ")}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
        <button onClick={createRoom} disabled={creating}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-yellow-500 text-black font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Create Rated Room
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">Open Rooms ({waiting.length})</span>
      </div>

      {waiting.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] mb-6">
          <Star size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">No rated rooms. Be the first!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {waiting.map(room => {
            const rank = getRank(room.host.minesweeperElo);
            return (
              <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                {room.host.image
                  ? <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
                  : <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">{room.host.name?.[0] ?? "?"}</div>
                }
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.host.name ?? "Anonymous"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--text-muted)]">{room.host.minesweeperElo} ELO</span>
                    {rank && (
                      <span className="text-[0.65rem] font-bold px-1.5 py-[0.1rem] rounded-full"
                        style={{ background: `${rank.color}22`, color: rank.color, border: `1px solid ${rank.color}44` }}>
                        {rank.label}
                      </span>
                    )}
                    <span className="text-[0.65rem] text-[var(--text-muted)] capitalize">{room.difficulty}</span>
                  </div>
                </div>
                <button onClick={() => joinRoom(room.id)} disabled={joiningId === room.id}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-yellow-500 text-black font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {joiningId === room.id && <Loader2 size={12} className="animate-spin" />}
                  Join
                </button>
              </div>
            );
          })}
        </div>
      )}

      {playing.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-yellow-400" />
            <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
              Live Games ({playing.length})
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {playing.map(room => {
              const hostRank = getRank(room.host.minesweeperElo);
              const guestRank = room.guest ? getRank(room.guest.minesweeperElo) : null;
              return (
                <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {room.host.image
                      ? <Image src={room.host.image} alt="" width={28} height={28} className="rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{room.host.name?.[0] ?? "?"}</div>
                    }
                    <span className="text-[0.65rem] text-[var(--text-muted)]">vs</span>
                    {room.guest?.image
                      ? <Image src={room.guest.image} alt="" width={28} height={28} className="rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{room.guest?.name?.[0] ?? "?"}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                      {room.host.name ?? "?"} vs {room.guest?.name ?? "?"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">{DIFF_LABEL[room.difficulty] ?? room.difficulty}</span>
                      {hostRank && (
                        <span className="text-[0.6rem] font-bold px-1 py-[0.1rem] rounded-full"
                          style={{ background: `${hostRank.color}22`, color: hostRank.color, border: `1px solid ${hostRank.color}44` }}>
                          {hostRank.label}
                        </span>
                      )}
                      {guestRank && (
                        <span className="text-[0.6rem] font-bold px-1 py-[0.1rem] rounded-full"
                          style={{ background: `${guestRank.color}22`, color: guestRank.color, border: `1px solid ${guestRank.color}44` }}>
                          {guestRank.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/games/minesweeper/online/${room.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-display font-bold text-xs hover:bg-yellow-500/20 transition-colors no-underline">
                    <Eye size={12} />
                    Watch
                    {room.spectatorCount > 0 && (
                      <span className="ml-0.5 text-[0.6rem] opacity-80">{room.spectatorCount}</span>
                    )}
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
