"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Users, Plus, Loader2, Clock, Eye, Spade } from "lucide-react";
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
  spectatorCount: number;
  host: { id: string; name: string | null; image: string | null; durakElo: number };
  players: { name: string | null; image: string | null }[];
};

const TC_LABELS: Record<string, string> = { none: "∞", "15": "⚡ 15s", "30": "⏱ 30s", "60": "🕐 60s" };

export default function DurakLobby() {
  const t = useTranslations("durak");
  const router = useRouter();
  const [waiting, setWaiting] = useState<RoomItem[]>([]);
  const [playing, setPlaying] = useState<RoomItem[]>([]);
  const [variant, setVariant] = useState<"podkidnoy" | "perevodnoy">("podkidnoy");
  const [deckSize, setDeckSize] = useState<36 | 52>(36);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeControl, setTimeControl] = useState("none");
  const [throwRule, setThrowRule] = useState<"all" | "neighbors">("all");
  const [fairPlay, setFairPlay] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchRooms() {
    const res = await fetch("/api/durak-rooms");
    if (res.ok) {
      const d = await res.json();
      setWaiting(d.waiting ?? []);
      setPlaying(d.playing ?? []);
    }
  }

  useEffect(() => {
    fetchRooms();
    const t2 = setInterval(fetchRooms, 3000);
    return () => clearInterval(t2);
  }, []);

  async function createRoom() {
    setCreating(true);
    try {
      const res = await fetch("/api/durak-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, deckSize, maxPlayers, timeControl, throwRule, rated: false, fairPlay }),
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
          ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
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
        <Spade size={20} className="text-[var(--accent-orange)]" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">{t("onlineTitle")}</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">
        {t("onlineSubtitle")} ·{" "}
        <Link href="/games/durak/online/rated" className="text-pink-400 hover:opacity-80">
          {t("ratedQueue")} →
        </Link>
      </p>

      {/* Create room */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6 flex flex-col gap-4">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm">{t("createRoom")}</p>

        <div>
          <Pill
            active={variant === "perevodnoy"}
            onClick={() => setVariant(variant === "perevodnoy" ? "podkidnoy" : "perevodnoy")}
          >
            <span className="flex items-center gap-1.5">
              <span className={[
                "w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[0.55rem] transition-all",
                variant === "perevodnoy"
                  ? "bg-[var(--accent-orange)] border-[var(--accent-orange)] text-white"
                  : "border-current opacity-50",
              ].join(" ")}>
                {variant === "perevodnoy" && "✓"}
              </span>
              {t("perevodnoy")}
            </span>
          </Pill>
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

        {maxPlayers >= 4 && (
          <div>
            <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("throwRule")}</p>
            <div className="flex gap-2">
              <Pill active={throwRule === "all"} onClick={() => setThrowRule("all")}>{t("throwAll")}</Pill>
              <Pill active={throwRule === "neighbors"} onClick={() => setThrowRule("neighbors")}>{t("throwNeighbors")}</Pill>
            </div>
          </div>
        )}

        <div>
          <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("timePerMove")}</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TC_LABELS).map(([v, lbl]) => (
              <Pill key={v} active={timeControl === v} onClick={() => setTimeControl(v)}>{lbl}</Pill>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.7rem] text-[var(--text-muted)] mb-1.5">{t("playMode")}</p>
          <div className="flex gap-2">
            <Pill active={fairPlay} onClick={() => setFairPlay(true)}>{t("fairPlay")}</Pill>
            <Pill active={!fairPlay} onClick={() => setFairPlay(false)}>{t("unfairPlay")}</Pill>
          </div>
        </div>

        <button
          onClick={createRoom}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity w-fit"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t("createRoom")}
        </button>
      </div>

      {/* Waiting */}
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
          {t("openRooms")} ({waiting.length})
        </span>
      </div>
      {waiting.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] mb-6">
          <Users size={32} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)] text-sm">{t("noRooms")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {waiting.map((room) => (
            <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.host.image ? (
                <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-sm">
                  {room.host.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">{room.host.name ?? "Anonymous"}</p>
                <p className="text-[var(--text-muted)] text-xs">
                  {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize} · {TC_LABELS[room.timeControl]} ·{" "}
                  {room.playerCount}/{room.maxPlayers} · {room.fairPlay ? t("fairPlay") : t("unfairPlay")}
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

      {/* Live games */}
      {playing.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-indigo-400" />
            <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
              {t("liveGames")} ({playing.length})
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {playing.map((room) => (
              <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                <div className="flex -space-x-2">
                  {room.players.slice(0, 4).map((p, i) =>
                    p.image ? (
                      <Image key={i} src={p.image} alt="" width={26} height={26} className="rounded-full border border-[var(--bg-elevated)]" />
                    ) : (
                      <div key={i} className="w-[26px] h-[26px] rounded-full bg-indigo-500/20 border border-[var(--bg-elevated)] flex items-center justify-center text-indigo-400 font-bold text-[0.6rem]">
                        {p.name?.[0] ?? "?"}
                      </div>
                    ),
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                    {room.playerCount} {t("playersLabel")}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize}
                  </p>
                </div>
                <Link
                  href={`/games/durak/online/${room.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-display font-bold text-xs hover:bg-indigo-500/20 transition-colors no-underline"
                >
                  <Eye size={12} /> {t("watch")}
                  {room.spectatorCount > 0 && <span className="ml-0.5 text-[0.6rem] opacity-80">{room.spectatorCount}</span>}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
