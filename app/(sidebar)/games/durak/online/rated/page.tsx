"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Star, Users, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type RoomItem = {
  id: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  timeControl: string;
  fairPlay: boolean;
  playerCount: number;
  host: { id: string; name: string | null; image: string | null; durakElo: number };
};

const TC_LABELS: Record<string, string> = { none: "∞", "15": "⚡ 15s", "30": "⏱ 30s", "60": "🕐 60s" };

export default function DurakRatedLobby() {
  const t = useTranslations("durak");
  const router = useRouter();
  const [waiting, setWaiting] = useState<RoomItem[]>([]);
  const [variant, setVariant] = useState<"podkidnoy" | "perevodnoy">("podkidnoy");
  const [deckSize, setDeckSize] = useState<36 | 52>(36);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [timeControl, setTimeControl] = useState("30");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/durak-rooms?rated=true");
    if (res.ok) {
      const d = await res.json();
      setWaiting(d.waiting ?? []);
    }
  }

  useEffect(() => {
    fetchRooms();
    const i = setInterval(fetchRooms, 3000);
    return () => clearInterval(i);
  }, []);

  async function createRoom() {
    setCreating(true);
    try {
      const res = await fetch("/api/durak-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Rated games are always fair-play.
        body: JSON.stringify({ variant, deckSize, maxPlayers, timeControl, rated: true, fairPlay: true }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/games/durak/online/${id}`);
      } else alert((await res.json()).error ?? "Error");
    } finally {
      setCreating(false);
    }
  }

  async function joinRoom(roomId: string) {
    setJoiningId(roomId);
    try {
      const res = await fetch(`/api/durak-rooms/${roomId}/join`, { method: "POST" });
      if (res.ok) router.push(`/games/durak/online/${roomId}`);
      else {
        alert((await res.json()).error ?? "Error");
        fetchRooms();
      }
    } finally {
      setJoiningId(null);
    }
  }

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all",
        active
          ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
          : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
      ].join(" ")}
    >
      {children}
    </button>
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games/durak" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← {t("title")}
        </Link>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Star size={20} className="text-yellow-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">{t("ratedTitle")}</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">{t("ratedSubtitle")}</p>

      {/* Create rated room */}
      <div className="bg-[var(--bg-elevated)] border border-yellow-500/25 rounded-2xl p-5 mb-6 flex flex-col gap-4">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm">{t("createRatedRoom")}</p>

        <div>
          <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("variant")}</p>
          <div className="flex gap-2">
            <Pill active={variant === "podkidnoy"} onClick={() => setVariant("podkidnoy")}>{t("podkidnoy")}</Pill>
            <Pill active={variant === "perevodnoy"} onClick={() => setVariant("perevodnoy")}>{t("perevodnoy")}</Pill>
          </div>
        </div>

        <div>
          <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("deck")}</p>
          <div className="flex gap-2">
            <Pill active={deckSize === 36} onClick={() => setDeckSize(36)}>36</Pill>
            <Pill active={deckSize === 52} onClick={() => setDeckSize(52)}>52</Pill>
          </div>
        </div>

        <div>
          <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("players")}</p>
          <div className="flex gap-2 flex-wrap">
            {[2, 3, 4, 5, 6].map((n) => (
              <Pill key={n} active={maxPlayers === n} onClick={() => setMaxPlayers(n)}>{n}</Pill>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("timePerMove")}</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TC_LABELS).map(([v, lbl]) => (
              <Pill key={v} active={timeControl === v} onClick={() => setTimeControl(v)}>{lbl}</Pill>
            ))}
          </div>
        </div>

        <button
          onClick={createRoom}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity w-fit"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t("createRatedRoom")}
        </button>
      </div>

      {/* Waiting rated rooms */}
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
          {t("openRooms")} ({waiting.length})
        </span>
      </div>
      {waiting.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Users size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">{t("noRooms")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {waiting.map((room) => (
            <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.host.image ? (
                <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
                  {room.host.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">{room.host.name ?? "Anonymous"}</p>
                <p className="text-[var(--text-muted)] text-xs">
                  {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize} · {TC_LABELS[room.timeControl]} ·{" "}
                  {room.playerCount}/{room.maxPlayers} · ELO {room.host.durakElo}
                </p>
              </div>
              <button
                onClick={() => joinRoom(room.id)}
                disabled={joiningId === room.id || room.playerCount >= room.maxPlayers}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {joiningId === room.id && <Loader2 size={12} className="animate-spin" />} {t("join")}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
