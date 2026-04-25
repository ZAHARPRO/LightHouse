"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Loader2, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRank } from "@/lib/elo";

type RoomItem = {
  id: string;
  timeControl: string;
  guestId: string | null;
  hostEloSnapshot: number | null;
  host: { id: string; name: string | null; image: string | null; chessElo: number };
};

const TIME_OPTIONS = [
  { value: "300",  label: "5 min",  icon: "🔥" },
  { value: "600",  label: "10 min", icon: "⏱" },
  { value: "1500", label: "25 min", icon: "🕐" },
];

export default function RatedChessLobby() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [timeControl, setTimeControl] = useState("600");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/chess-rooms?rated=true");
    if (res.ok) setRooms(await res.json());
  }

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 3000);
    return () => clearInterval(t);
  }, []);

  async function createRoom() {
    setCreating(true);
    try {
      const res = await fetch("/api/chess-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl, rated: true }),
      });
      if (res.ok) router.push(`/games/chess/online/${(await res.json()).id}`);
    } finally { setCreating(false); }
  }

  async function joinRoom(roomId: string) {
    setJoiningId(roomId);
    try {
      const res = await fetch(`/api/chess-rooms/${roomId}/join`, { method: "POST" });
      if (res.ok) router.push(`/games/chess/online/${roomId}`);
      else { fetchRooms(); }
    } finally { setJoiningId(null); }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
    <div className="flex items-center gap-3 mb-2">
        <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Games
        </Link>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Star size={20} className="text-yellow-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Rated Chess</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">Win to gain ELO · Lose to drop ELO</p>

      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Time Control</p>
        <div className="flex gap-2 mb-4">
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTimeControl(opt.value)}
              className={["flex-1 px-3 py-2 rounded-lg text-sm font-display font-semibold border transition-all",
                timeControl === opt.value
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
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
          Open Rooms ({rooms.length})
        </span>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Star size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">No rated rooms open. Create the first one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map(room => {
            const rank = getRank(room.host.chessElo);
            return (
              <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                {room.host.image
                  ? <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
                  : <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">{room.host.name?.[0] ?? "?"}</div>
                }
                <div className="flex-1">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.host.name ?? "Anonymous"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--text-muted)]">{room.host.chessElo} ELO</span>
                    {rank && (
                      <span className="text-[0.65rem] font-bold px-1.5 py-[0.1rem] rounded-full"
                        style={{ background: `${rank.color}22`, color: rank.color, border: `1px solid ${rank.color}44` }}>
                        {rank.label}
                      </span>
                    )}
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
    </main>
  );
}
