"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  playerCount: number;
  host: { id: string; name: string | null; image: string | null; durakElo: number };
  players: { userId: string; name: string | null; image: string | null }[];
};

const TC_OPTIONS = [
  { value: "none", icon: "∞", label: "Infinite" },
  { value: "15",   icon: "⚡", label: "15 sec" },
  { value: "30",   icon: "⏱",  label: "30 sec" },
  { value: "60",   icon: "🕐", label: "60 sec" },
];
const TC_LABEL: Record<string, string> = { none: "∞", "15": "⚡ 15s", "30": "⏱ 30s", "60": "🕐 60s" };

const BTN_ACTIVE = "bg-yellow-500/15 border-yellow-500/40 text-yellow-400";
const BTN_IDLE   = "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
const pill = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all ${active ? BTN_ACTIVE : BTN_IDLE}`;

export default function DurakRatedLobby() {
  const t = useTranslations("durak");
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";

  const [waiting, setWaiting]       = useState<RoomItem[]>([]);
  const [variant, setVariant]       = useState<"podkidnoy" | "perevodnoy">("podkidnoy");
  const [deckSize, setDeckSize]     = useState<36 | 52>(36);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [timeControl, setTC]        = useState("30");
  const [throwRule, setThrowRule]   = useState<"all" | "neighbors">("all");
  const [creating, setCreating]     = useState(false);
  const [joiningId, setJoiningId]   = useState<string | null>(null);

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
        body: JSON.stringify({ variant, deckSize, maxPlayers, timeControl, throwRule, rated: true, fairPlay: true }),
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
      else { alert((await res.json()).error ?? "Error"); fetchRooms(); }
    } finally {
      setJoiningId(null);
    }
  }

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

      {/* ── Create rated room ── */}
      <div className="bg-[var(--bg-elevated)] border border-yellow-500/25 rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-4">{t("createRatedRoom")}</p>

        {/* Time per move grid */}
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("timePerMove")}</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {TC_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTC(opt.value)}
              className={[
                "py-2 px-2 rounded-lg text-sm font-display font-semibold border transition-all text-center",
                timeControl === opt.value ? BTN_ACTIVE : BTN_IDLE,
              ].join(" ")}
            >
              <span className="block text-base leading-tight">{opt.icon}</span>
              <span className="text-[0.7rem]">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Deck + Players */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("deck")}</p>
            <div className="flex gap-2">
              <button className={pill(deckSize === 36)} onClick={() => setDeckSize(36)}>36</button>
              <button className={pill(deckSize === 52)} onClick={() => setDeckSize(52)}>52</button>
            </div>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("players")}</p>
            <div className="flex gap-1.5 flex-wrap">
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} className={pill(maxPlayers === n)} onClick={() => setMaxPlayers(n)}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Variant */}
        <div className="mb-5">
          <button
            onClick={() => setVariant(variant === "perevodnoy" ? "podkidnoy" : "perevodnoy")}
            className={[
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all w-fit",
              variant === "perevodnoy" ? BTN_ACTIVE : BTN_IDLE,
            ].join(" ")}
          >
            <span className={[
              "w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[0.55rem] shrink-0",
              variant === "perevodnoy"
                ? "bg-yellow-400 border-yellow-400 text-[var(--bg-primary)]"
                : "border-current opacity-50",
            ].join(" ")}>
              {variant === "perevodnoy" && "✓"}
            </span>
            {t("perevodnoy")}
          </button>
        </div>

        {/* Throw rule (4+ players) */}
        {maxPlayers >= 4 && (
          <div className="mb-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("throwRule")}</p>
            <div className="flex gap-2">
              <button className={pill(throwRule === "all")} onClick={() => setThrowRule("all")}>{t("throwAll")}</button>
              <button className={pill(throwRule === "neighbors")} onClick={() => setThrowRule("neighbors")}>{t("throwNeighbors")}</button>
            </div>
          </div>
        )}

        <button
          onClick={createRoom}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-yellow-400 text-[var(--bg-primary)] font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {t("createRatedRoom")}
        </button>
      </div>

      {/* ── Waiting rooms ── */}
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
          {waiting.map(room => (
            <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.host.image
                ? <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full shrink-0" />
                : <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm shrink-0">{room.host.name?.[0] ?? "?"}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">{room.host.name ?? "Anonymous"}</p>
                  <span className="text-[0.65rem] text-yellow-400 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded">ELO {room.host.durakElo}</span>
                </div>
                <p className="text-[var(--text-muted)] text-xs">
                  {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize} · {TC_LABEL[room.timeControl]} · {room.playerCount}/{room.maxPlayers}
                </p>
              </div>
              {myId && (room.host.id === myId || room.players?.some(p => p.userId === myId)) ? (
                <Link
                  href={`/games/durak/online/${room.id}`}
                  className="shrink-0 px-4 py-1.5 rounded-lg bg-yellow-400 text-[var(--bg-primary)] font-display font-bold text-xs hover:opacity-90 transition-opacity no-underline"
                >
                  {t("returnToGame")}
                </Link>
              ) : (
                <button
                  onClick={() => joinRoom(room.id)}
                  disabled={joiningId === room.id || room.playerCount >= room.maxPlayers}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-yellow-400 text-[var(--bg-primary)] font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {joiningId === room.id && <Loader2 size={12} className="animate-spin" />}
                  {t("join")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
