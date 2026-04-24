"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Wifi, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type RoomItem = {
  id: string;
  difficulty: string;
  guestId: string | null;
  createdAt: string;
  host: { id: string; name: string | null; image: string | null };
};

const DIFF_LABEL: Record<string, string> = {
  easy: "Легко · 9×9",
  medium: "Средне · 16×16",
  hard: "Сложно · 30×16",
};

export default function OnlineLobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/ms-rooms");
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
        alert(error ?? "Ошибка");
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
        alert(error ?? "Ошибка");
        fetchRooms();
      }
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games/minesweeper" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Сапёр
        </Link>
      </div>
      <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)] mb-1">
        Online Сапёр
      </h1>
      <p className="text-[var(--text-muted)] mb-8">Играй против другого игрока в реальном времени</p>

      {/* Create room */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Создать комнату</p>
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
          Создать комнату
        </button>
      </div>

      {/* Room list */}
      <div className="flex items-center gap-2 mb-3">
        <Wifi size={14} className="text-green-400" />
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
          Открытые комнаты ({rooms.length})
        </span>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Users size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">Пока нет открытых комнат. Создай первую!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map(room => (
            <div
              key={room.id}
              className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3"
            >
              {room.host.image ? (
                <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-sm">
                  {room.host.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                  {room.host.name ?? "Аноним"}
                </p>
                <p className="text-[var(--text-muted)] text-xs">{DIFF_LABEL[room.difficulty] ?? room.difficulty}</p>
              </div>
              <button
                onClick={() => joinRoom(room.id)}
                disabled={joiningId === room.id}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {joiningId === room.id ? <Loader2 size={12} className="animate-spin" /> : null}
                Войти
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
