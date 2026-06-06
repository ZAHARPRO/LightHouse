"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import MatchmakingCard from "@/components/MatchmakingCard";
import { useMatchmakingQueue } from "@/lib/useMatchmakingQueue";
import MatchHistoryButton from "@/components/MatchHistory";

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

const BTN_ACTIVE = "bg-yellow-500/15 border-yellow-500/40 text-yellow-400";
const BTN_IDLE   = "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
const pill = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all ${active ? BTN_ACTIVE : BTN_IDLE}`;

export default function DurakRatedQueue() {
  const t = useTranslations("durak");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";

  const [variant, setVariant]       = useState<"podkidnoy" | "perevodnoy">("podkidnoy");
  const [deckSize, setDeckSize]     = useState<36 | 52>(36);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [queueRooms, setQueueRooms] = useState<RoomItem[]>([]);

  const queue = useMatchmakingQueue({
    gameKey: "durak",
    muteStatusApi: "/api/durak-rooms/mute-status",
    returning: searchParams.get("returning") === "1",

    startSearch: async () => {
      if (!myId) return null;

      // Try to join existing matching room
      const res = await fetch("/api/durak-rooms?rated=true");
      if (res.ok) {
        const d = await res.json();
        const rooms: RoomItem[] = d.waiting ?? [];
        setQueueRooms(rooms);

        const match = rooms.find(r =>
          r.variant === variant &&
          r.deckSize === deckSize &&
          r.maxPlayers === maxPlayers &&
          r.host.id !== myId &&
          r.playerCount < r.maxPlayers
        );

        if (match) {
          const joinRes = await fetch(`/api/durak-rooms/${match.id}/join`, { method: "POST" });
          if (joinRes.ok) {
            // Navigate to room immediately — confirmation modal is shown there
            router.push(`/games/durak/online/${match.id}`);
            return null;
          }
        }
      }

      // Create new room and wait for opponent
      const createRes = await fetch("/api/durak-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant, deckSize, maxPlayers,
          timeControl: "30",
          throwRule: "all",
          rated: true,
          fairPlay: true,
        }),
      });
      if (!createRes.ok) return null;
      const { id } = await createRes.json() as { id: string };
      return id;
    },

    cancelSearch: async (roomId) => {
      if (roomId) await fetch(`/api/durak-rooms/${roomId}`, { method: "DELETE" }).catch(() => {});
    },

    checkMatch: async (roomId) => {
      const res = await fetch(`/api/durak-rooms/${roomId}`);
      if (!res.ok) return null;
      const d = await res.json();
      // Navigate as soon as confirmation starts (confirmingAt set) or game started
      if (d.status !== "WAITING" || d.confirmingAt) return `/games/durak/online/${roomId}`;

      // Also refresh queue count while polling
      const listRes = await fetch("/api/durak-rooms?rated=true");
      if (listRes.ok) {
        const ld = await listRes.json();
        setQueueRooms(ld.waiting ?? []);
      }
      return null;
    },

    onNavigate: (route) => router.push(route),
    pollIntervalMs: 2000,
  });

  // Players currently queuing with same settings
  const sameQueue = queueRooms.filter(
    r => r.variant === variant && r.deckSize === deckSize && r.maxPlayers === maxPlayers
  );
  const queueCount = sameQueue.reduce((s, r) => s + r.playerCount, 0);

  const searchingLabel = `${variant === "perevodnoy" ? t("perevodnoy") : t("podkidnoy")} · ${deckSize} · ${maxPlayers}P`;

  return (
    <main className="max-w-xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games/durak/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← {t("onlineTitle")}
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Star size={20} className="text-yellow-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">{t("ratedTitle")}</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">{t("ratedSubtitle")}</p>
      {session?.user?.id && <div className="mb-6"><MatchHistoryButton userId={session.user.id} label={t("myHistory")} /></div>}
      <MatchmakingCard
        searching={queue.searching}
        elapsed={queue.elapsed}
        mutedSecs={queue.mutedSecs}
        onFindMatch={queue.findMatch}
        onCancel={queue.cancel}
        disabled={!myId}
        accentColor="yellow"
        searchingLabel={searchingLabel}
        queueCount={queueCount}
      >
        {/* Fixed time control badge */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t("timePerMove")}</p>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-xs font-display font-semibold">
            ⏱ 30 {t("sec")}
          </span>
        </div>

        {/* Deck + Players */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("deck")}</p>
            <div className="flex gap-2">
              <button className={pill(deckSize === 36)} onClick={() => setDeckSize(36)} disabled={queue.searching}>36</button>
              <button className={pill(deckSize === 52)} onClick={() => setDeckSize(52)} disabled={queue.searching}>52</button>
            </div>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{t("players")}</p>
            <div className="flex gap-1.5 flex-wrap">
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} className={pill(maxPlayers === n)} onClick={() => setMaxPlayers(n)} disabled={queue.searching}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Variant */}
        <div className="mb-5">
          <button
            disabled={queue.searching}
            onClick={() => setVariant(v => v === "perevodnoy" ? "podkidnoy" : "perevodnoy")}
            className={["flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all w-fit",
              variant === "perevodnoy" ? BTN_ACTIVE : BTN_IDLE,
              queue.searching ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <span className={["w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[0.55rem] shrink-0",
              variant === "perevodnoy" ? "bg-yellow-400 border-yellow-400 text-[var(--bg-primary)]" : "border-current opacity-50",
            ].join(" ")}>
              {variant === "perevodnoy" && "✓"}
            </span>
            {t("perevodnoy")}
          </button>
        </div>
      </MatchmakingCard>

      {/* Active same-queue rooms (visible while host is waiting) */}
      {queue.searching && sameQueue.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          {sameQueue.map(room => (
            <div key={room.id} className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-yellow-500/20 rounded-xl px-4 py-2.5">
              <div className="flex -space-x-1.5">
                {room.players.map((p, i) =>
                  p.image
                    ? <Image key={i} src={p.image} alt="" width={24} height={24} className="rounded-full border border-[var(--bg-elevated)]" />
                    : <div key={i} className="w-6 h-6 rounded-full bg-yellow-500/20 border border-[var(--bg-elevated)] flex items-center justify-center text-yellow-400 font-bold text-[0.55rem]">{p.name?.[0] ?? "?"}</div>
                )}
              </div>
              <div className="flex-1 text-xs text-[var(--text-muted)]">
                {room.playerCount}/{room.maxPlayers} {t("playersLabel")}
                {room.host.id === myId && <span className="ml-2 text-yellow-400 font-semibold">{t("yourRoom")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
