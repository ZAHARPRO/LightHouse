"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Wifi, Loader2, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type RoomItem = {
  id: string;
  difficulty: string;
  guestId: string | null;
  createdAt: string;
  spectatorCount: number;
  host:  { id: string; name: string | null; image: string | null };
  guest?: { id: string; name: string | null; image: string | null } | null;
};

const DIFF_LABEL: Record<string, string> = {
  easy: "Легко · 9×9",
  medium: "Средне · 16×16",
  hard: "Сложно · 30×16",
};

export default function OnlineLobbyPage() {
  const router = useRouter();
  const [waiting, setWaiting] = useState<RoomItem[]>([]);
  const [playing, setPlaying] = useState<RoomItem[]>([]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/ms-rooms");
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
        body: JSON.stringify({ difficulty }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/games/minesweeper/online/${id}`);
      } else {
        const { error } = await res.json();
        alert(error ?? "Error");
      }
    } finally {
      setCreating(false);
    }
  }

  async function joinRoom(roomId: string) {
    setJoiningId(roomId);
    try {
      const res = await fetch(`/api/ms-rooms/${roomId}/join`, { method: "POST" });
      if (res.ok) {
        router.push(`/games/minesweeper/online/${roomId}`);
      } else {
        const { error } = await res.json();
        alert(error ?? "Error");
        fetchRooms();
      }
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Games
        </Link>
      </div>
      <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)] mb-1">
        Online Minesweeper
      </h1>
      <p className="text-[var(--text-muted)] mb-8">Play against another player in real-time</p>
 <p className="text-[var(--text-muted)] mb-8">1 vs 1 in real-time · <Link href="/games/minesweeper/online/rated" className="text-pink-400 hover:opacity-80">Rated queue →</Link></p>
      {/* Create room */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Create Room</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(["easy", "medium", "hard"] as const).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-display font-semibold border transition-all",
                difficulty === d
                  ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                  : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
        <button
          onClick={createRoom}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Create Room
        </button>
      </div>

      {/* Waiting rooms */}
      <div className="flex items-center gap-2 mb-3">
        <Wifi size={14} className="text-green-400" />
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
          Open Rooms ({waiting.length})
        </span>
      </div>

      {waiting.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] mb-6">
          <Users size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">No open rooms available. Create the first one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {waiting.map(room => (
            <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.host.image ? (
                <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-sm">
                  {room.host.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                  {room.host.name ?? "Anonymous"}
                </p>
                <p className="text-[var(--text-muted)] text-xs">{DIFF_LABEL[room.difficulty] ?? room.difficulty}</p>
              </div>
              <button onClick={() => joinRoom(room.id)} disabled={joiningId === room.id}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity">
                {joiningId === room.id ? <Loader2 size={12} className="animate-spin" /> : null}
                Join
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Playing rooms — spectate */}
      {playing.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-green-400" />
            <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
              Live Games ({playing.length})
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {playing.map(room => (
              <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {room.host.image
                    ? <Image src={room.host.image} alt="" width={28} height={28} className="rounded-full" />
                    : <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-xs">{room.host.name?.[0]??"?"}</div>
                  }
                  <span className="text-[0.65rem] text-[var(--text-muted)]">vs</span>
                  {room.guest?.image
                    ? <Image src={room.guest.image} alt="" width={28} height={28} className="rounded-full" />
                    : <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-xs">{room.guest?.name?.[0]??"?"}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                    {room.host.name ?? "?"} vs {room.guest?.name ?? "?"}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs">{DIFF_LABEL[room.difficulty] ?? room.difficulty}</p>
                </div>
                <Link href={`/games/minesweeper/online/${room.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 font-display font-bold text-xs hover:bg-green-500/20 transition-colors no-underline">
                  <Eye size={12} />
                  Watch
                  {room.spectatorCount > 0 && (
                    <span className="ml-0.5 text-[0.6rem] opacity-80">{room.spectatorCount}</span>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
