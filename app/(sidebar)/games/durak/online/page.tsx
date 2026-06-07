"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Users, Plus, Loader2, Clock, Eye, Spade } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DurakAdPanel from "@/components/DurakAdPanel";

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
  players: { userId: string; name: string | null; image: string | null }[];
};

const TC_OPTIONS = [
  { value: "none", icon: "∞", label: "Infinite" },
  { value: "15",   icon: "⚡", label: "15 sec" },
  { value: "30",   icon: "⏱",  label: "30 sec" },
  { value: "60",   icon: "🕐", label: "60 sec" },
];
const TC_LABEL: Record<string, string> = { none: "∞", "15": "⚡ 15s", "30": "⏱ 30s", "60": "🕐 60s" };

const BTN_ACTIVE = "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]";
const BTN_IDLE   = "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
const pill = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all ${active ? BTN_ACTIVE : BTN_IDLE}`;

export default function DurakLobby() {
  const t = useTranslations("durak");
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";

  const [waiting, setWaiting]       = useState<RoomItem[]>([]);
  const [playing, setPlaying]       = useState<RoomItem[]>([]);
  const [variant, setVariant]       = useState<"podkidnoy" | "perevodnoy">("podkidnoy");
  const [deckSize, setDeckSize]     = useState<36 | 52>(36);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeControl, setTC]        = useState("none");
  const [throwRule, setThrowRule]   = useState<"all" | "neighbors">("all");
  const [fairPlay, setFairPlay]     = useState(true);
  const [creating, setCreating]     = useState(false);
  const [joiningId, setJoiningId]   = useState<string | null>(null);
  const [myCoins, setMyCoins]       = useState<number | null>(null);
  const [showAdPanel, setShowAdPanel] = useState(false);

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
    const id = setInterval(fetchRooms, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/durak-coins")
      .then(r => r.ok ? r.json() : null)
      .then((d: { durakCoins: number } | null) => { if (d) setMyCoins(d.durakCoins); })
      .catch(() => {});
  }, [session?.user?.id]); // eslint-disable-line

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
      } else {
        alert((await res.json()).error ?? "Error");
      }
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
    <>
    <main className="max-w-2xl mx-auto px-4 py-12">
      {/* ── Header ── */}
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

      {/* ── Create room ── */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-6">
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-4">{t("createRoom")}</p>

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

        {/* Play mode + Variant */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("playMode")}</p>
            <div className="flex gap-2">
              <button className={pill(fairPlay)} onClick={() => setFairPlay(true)}>{t("fairPlay")}</button>
              <button className={pill(!fairPlay)} onClick={() => setFairPlay(false)}>{t("unfairPlay")}</button>
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={() => setVariant(variant === "perevodnoy" ? "podkidnoy" : "perevodnoy")}
              className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all w-fit",
                variant === "perevodnoy" ? BTN_ACTIVE : BTN_IDLE,
              ].join(" ")}
            >
              <span className={[
                "w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[0.55rem] transition-all shrink-0",
                variant === "perevodnoy"
                  ? "bg-[var(--accent-orange)] border-[var(--accent-orange)] text-white"
                  : "border-current opacity-50",
              ].join(" ")}>
                {variant === "perevodnoy" && "✓"}
              </span>
              {t("perevodnoy")}
            </button>
          </div>
        </div>

        {/* Throw rule */}
        {maxPlayers >= 4 && (
          <div className="mb-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("throwRule")}</p>
            <div className="flex gap-2">
              <button className={pill(throwRule === "all")} onClick={() => setThrowRule("all")}>{t("throwAll")}</button>
              <button className={pill(throwRule === "neighbors")} onClick={() => setThrowRule("neighbors")}>{t("throwNeighbors")}</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={createRoom}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t("createRoom")}
          </button>
          {myCoins !== null && session?.user?.id && (
            <button
              onClick={() => setShowAdPanel(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-amber-500/30 text-amber-400 text-xs font-display font-semibold hover:bg-amber-500/10 transition-colors"
            >
              🪙 {myCoins} · {t("earnCoins")}
            </button>
          )}
        </div>
      </div>

      {/* ── Waiting rooms ── */}
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
          {waiting.map(room => (
            <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              {room.host.image
                ? <Image src={room.host.image} alt="" width={36} height={36} className="rounded-full shrink-0" />
                : <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-sm shrink-0">{room.host.name?.[0] ?? "?"}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">{room.host.name ?? "Anonymous"}</p>
                <p className="text-[var(--text-muted)] text-xs">
                  {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize} · {TC_LABEL[room.timeControl]} · {room.playerCount}/{room.maxPlayers} · {room.fairPlay ? t("fairPlay") : t("unfairPlay")}
                </p>
              </div>
              {myId && (room.host.id === myId || room.players.some(p => p.userId === myId)) ? (
                <Link
                  href={`/games/durak/online/${room.id}`}
                  className="shrink-0 px-4 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-xs hover:opacity-90 transition-opacity no-underline"
                >
                  {t("returnToGame")}
                </Link>
              ) : (
                <button
                  onClick={() => joinRoom(room.id)}
                  disabled={joiningId === room.id || room.playerCount >= room.maxPlayers}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-display font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {joiningId === room.id && <Loader2 size={12} className="animate-spin" />}
                  {t("join")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Live games ── */}
      {playing.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-indigo-400" />
            <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
              {t("liveGames")} ({playing.length})
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {playing.map(room => (
              <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                <div className="flex -space-x-2 shrink-0">
                  {room.players.slice(0, 4).map((p, i) =>
                    p.image
                      ? <Image key={i} src={p.image} alt="" width={26} height={26} className="rounded-full border border-[var(--bg-elevated)]" />
                      : <div key={i} className="w-[26px] h-[26px] rounded-full bg-indigo-500/20 border border-[var(--bg-elevated)] flex items-center justify-center text-indigo-400 font-bold text-[0.6rem]">{p.name?.[0] ?? "?"}</div>
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
                  className={[
                    "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-bold text-xs transition-colors no-underline",
                    myId && room.players.some(p => p.userId === myId)
                      ? "bg-[var(--accent-orange)] text-white hover:opacity-90"
                      : "border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20",
                  ].join(" ")}
                >
                  {myId && room.players.some(p => p.userId === myId)
                    ? t("returnToGame")
                    : <><Eye size={12} /> {t("watch")}{room.spectatorCount > 0 && <span className="ml-0.5 text-[0.6rem] opacity-80">{room.spectatorCount}</span>}</>
                  }
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </main>

    {showAdPanel && (
      <DurakAdPanel
        mode="coins"
        side="right"
        onClose={() => setShowAdPanel(false)}
        onCoinsEarned={(n) => { setMyCoins(n); setShowAdPanel(false); }}
      />
    )}
  </>
  );
}
