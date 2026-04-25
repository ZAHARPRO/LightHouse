"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Loader2, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type RoomItem = {
  id: string;
  timeControl: string;
  guestId: string | null;
  createdAt: string;
  host: { id: string; name: string | null; image: string | null };
};

const TC_LABELS: Record<string, string> = {
  none: "∞ Infinite",
  "60": "⚡ 1 min",
  "300": "🔥 5 min",
  "600": "⏱ 10 min",
  "1500": "🕐 25 min",
  "3600": "🕐 1 hour",
};

const TIME_OPTIONS = [
  { value: "none",  label: "Infinite", icon: "∞" },
  { value: "60",    label: "1 minute",    icon: "⚡" },
  { value: "300",   label: "5 minutes",     icon: "🔥" },
  { value: "600",   label: "10 minutes",    icon: "⏱" },
  { value: "1500",  label: "25 minutes",    icon: "🕐" },
  { value: "3600",  label: "1 hour",       icon: "🕐" },
];

export default function ChessOnlineLobby() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [timeControl, setTimeControl] = useState("600");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/chess-rooms");
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
        body: JSON.stringify({ timeControl }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/games/chess/online/${id}`);
      } else {
        alert((await res.json()).error ?? "Error creating room");
      }
    } finally {
      setCreating(false);
    }
  }

  async function joinRoom(roomId: string) {
    setJoiningId(roomId);
    try {
      const res = await fetch(`/api/chess-rooms/${roomId}/join`, { method: "POST" });
      if (res.ok) router.push(`/games/chess/online/${roomId}`);
      else { alert((await res.json()).error ?? "Error joining room"); fetchRooms(); }
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
    <div className="flex items-center gap-3 mb-2">
        <Link href="/games/games" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Games
        </Link>
      </div>
      <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)] mb-1">Online Chess</h1>
      <p className="text-[var(--text-muted)] mb-8">1 vs 1 in real-time</p>

      {/* Create room */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Create Room</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTimeControl(opt.value)}
              className={["px-3 py-2 rounded-lg text-sm font-display font-semibold border transition-all text-left",
                timeControl === opt.value
                  ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                  : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              ].join(" ")}
            >
              <span className="mr-1">{opt.icon}</span>{opt.label}
            </button>
          ))}
        </div>
        <button onClick={createRoom} disabled={creating}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Create Room
        </button>
      </div>

      {/* Room list */}
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
          Open Rooms ({rooms.length})
        </span>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Users size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">No open rooms. Create the first one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map(room => (
            <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.host.image
                ? <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
                : <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-sm">{room.host.name?.[0]??"?"}</div>
              }
              <div className="flex-1">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{room.host.name ?? "Anonymous"}</p>
                <p className="text-[var(--text-muted)] text-xs">{TC_LABELS[room.timeControl] ?? room.timeControl}</p>
              </div>
              <button onClick={() => joinRoom(room.id)} disabled={joiningId === room.id}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity">
                {joiningId === room.id && <Loader2 size={12} className="animate-spin" />}
                Join
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
