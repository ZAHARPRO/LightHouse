"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import Link from "next/link";
import MatchHistoryButton from "@/components/MatchHistory";
import MatchmakingCard from "@/components/MatchmakingCard";
import { useMatchmakingQueue } from "@/lib/useMatchmakingQueue";

const TIME_OPTIONS = [
  { value: "300",  label: "5 min",  icon: "🔥" },
  { value: "600",  label: "10 min", icon: "⏱" },
  { value: "1500", label: "25 min", icon: "🕐" },
];

const TC_LABELS: Record<string, string> = {
  "300": "🔥 5 min", "600": "⏱ 10 min", "1500": "🕐 25 min",
};

const pill = (active: boolean) =>
  ["flex-1 px-3 py-2 rounded-lg text-sm font-display font-semibold border transition-all",
    active
      ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ].join(" ");

export default function BattleshipRatedPage() {
  const t = useTranslations("matchmaking");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [timeControl, setTimeControl] = useState("600");

  const queue = useMatchmakingQueue({
    gameKey: "battleship",
    returning: searchParams.get("returning") === "1",
    startSearch: async () => {
      const res = await fetch("/api/battleship-rooms/matchmake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl }),
      });
      if (!res.ok) return null;
      const { roomId, matched } = await res.json() as { roomId: string; matched: boolean };
      if (matched) { router.push(`/games/battleship/online/${roomId}`); return null; }
      return roomId;
    },
    cancelSearch: async () => { await fetch("/api/battleship-rooms/matchmake", { method: "DELETE" }).catch(() => {}); },
    checkMatch: async (roomId) => {
      const r = await fetch(`/api/battleship-rooms/${roomId}`);
      if (!r.ok) return null;
      const json = await r.json();
      const data = json.room ?? json;
      if (data.guestId) return `/games/battleship/online/${roomId}`;
      return null;
    },
    onNavigate: (route) => router.push(route),
    pollIntervalMs: 2000,
  });

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
        ← Games
      </Link>

      <div className="flex items-center gap-2 mt-3 mb-1">
        <Star size={20} className="text-yellow-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Rated Battleship</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-6">{t("winToGain")}</p>
      {session?.user?.id && <div className="mb-6"><MatchHistoryButton userId={session.user.id} label={t("myHistory")} /></div>}

      <MatchmakingCard
        searching={queue.searching}
        elapsed={queue.elapsed}
        mutedSecs={queue.mutedSecs}
        onFindMatch={queue.findMatch}
        onCancel={queue.cancel}
        disabled={!session?.user?.id}
        accentColor="orange"
        searchingLabel={TC_LABELS[timeControl]}
      >
        <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Time Control</p>
        <div className="flex gap-2 mb-5">
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTimeControl(opt.value)} disabled={queue.searching}
              className={pill(timeControl === opt.value)}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </MatchmakingCard>
    </main>
  );
}
