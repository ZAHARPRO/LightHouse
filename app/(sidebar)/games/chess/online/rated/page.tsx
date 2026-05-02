"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Eye, Loader2, Search, Star, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRank } from "@/lib/elo";
import MatchHistoryButton from "@/components/MatchHistory";
import { preloadSounds, playSound } from "@/lib/gameSounds";

type RoomItem = {
  id: string;
  timeControl: string;
  spectatorCount: number;
  host:  { id: string; name: string | null; image: string | null; chessElo: number };
  guest?: { id: string; name: string | null; image: string | null; chessElo: number } | null;
};

const TC_LABELS: Record<string, string> = {
  "300": "🔥 5 min",
  "600": "⏱ 10 min",
  "1500": "🕐 25 min",
};

const TIME_OPTIONS = [
  { value: "300",  label: "5 min",  icon: "🔥" },
  { value: "600",  label: "10 min", icon: "⏱" },
  { value: "1500", label: "25 min", icon: "🕐" },
];

type Phase = "idle" | "searching";

export default function RatedChessLobby() {
  const router = useRouter();
  const { data: session } = useSession();
  const [playing, setPlaying]       = useState<RoomItem[]>([]);
  const [timeControl, setTimeControl] = useState("600");
  const [phase, setPhase]           = useState<Phase>("idle");
  const [elapsed, setElapsed]       = useState(0);
  const [starting, setStarting]     = useState(false);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt  = useRef(0);
  const roomIdRef  = useRef<string | null>(null);

  function stopTimers() {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function fetchLiveGames() {
    const res = await fetch("/api/chess-rooms?rated=true");
    if (res.ok) {
      const data = await res.json();
      setPlaying(data.playing ?? []);
    }
  }

  useEffect(() => {
    fetchLiveGames();
    const t = setInterval(fetchLiveGames, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => stopTimers(), []);
  useEffect(() => { preloadSounds(); }, []);

  async function startSearch() {
    setStarting(true);
    try {
      const res = await fetch("/api/chess-rooms/matchmake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl }),
      });
      if (!res.ok) return;
      const { roomId, matched } = await res.json() as { roomId: string; matched: boolean };

      if (matched) {
        playSound("opponent_found");
        router.push(`/games/chess/online/${roomId}`);
        return;
      }

      roomIdRef.current = roomId;
      startedAt.current = Date.now();
      setElapsed(0);
      setPhase("searching");

      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/chess-rooms/${roomId}`);
        if (!r.ok) return;
        const room = await r.json();
        if (room.guestId) {
          stopTimers();
          playSound("opponent_found");
          router.push(`/games/chess/online/${roomId}`);
        }
      }, 1500);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }, 1000);
    } finally {
      setStarting(false);
    }
  }

  async function cancelSearch() {
    stopTimers();
    setPhase("idle");
    setElapsed(0);
    roomIdRef.current = null;
    await fetch("/api/chess-rooms/matchmake", { method: "DELETE" });
  }

  function fmtElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
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
      <p className="text-[var(--text-muted)] mb-6">Win to gain ELO · Lose to drop ELO</p>
      {session?.user?.id && <div className="mb-6"><MatchHistoryButton userId={session.user.id} label="My History" /></div>}

      {/* ── Matchmaking card ── */}
      {phase === "idle" ? (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-8">
          <p className="text-[var(--text-secondary)] font-display font-semibold text-sm mb-3">Time Control</p>
          <div className="flex gap-2 mb-5">
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
          <button onClick={startSearch} disabled={starting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-yellow-500 text-black font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {starting ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Find Match
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-elevated)] border border-yellow-500/25 rounded-2xl p-6 mb-8 flex flex-col items-center gap-4">
          {/* Pulsing ring */}
          <div className="relative flex items-center justify-center w-20 h-20">
            <span className="absolute inset-0 rounded-full bg-yellow-500/10 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-yellow-500/15 animate-ping [animation-delay:0.3s]" />
            <Search size={28} className="text-yellow-400 relative z-10" />
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-[var(--text-primary)] text-base">Searching for opponent…</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">
              {TC_LABELS[timeControl]} · {fmtElapsed(elapsed)}
            </p>
          </div>
          <button onClick={cancelSearch}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-display font-semibold hover:text-red-400 transition-colors">
            <X size={14} /> Cancel
          </button>
        </div>
      )}

      {/* ── Live games ── */}
      {playing.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-yellow-400" />
            <span className="text-[var(--text-muted)] text-sm font-display font-semibold">
              Live Games ({playing.length})
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {playing.map(room => {
              const hostRank  = getRank(room.host.chessElo);
              const guestRank = room.guest ? getRank(room.guest.chessElo) : null;
              return (
                <div key={room.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {room.host.image
                      ? <Image src={room.host.image} alt="" width={28} height={28} className="rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{room.host.name?.[0] ?? "?"}</div>
                    }
                    <span className="text-[0.65rem] text-[var(--text-muted)]">vs</span>
                    {room.guest?.image
                      ? <Image src={room.guest.image} alt="" width={28} height={28} className="rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{room.guest?.name?.[0] ?? "?"}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                      {room.host.name ?? "?"} vs {room.guest?.name ?? "?"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">{TC_LABELS[room.timeControl] ?? room.timeControl}</span>
                      {hostRank && (
                        <span className="text-[0.6rem] font-bold px-1 py-[0.1rem] rounded-full"
                          style={{ background: `${hostRank.color}22`, color: hostRank.color, border: `1px solid ${hostRank.color}44` }}>
                          {hostRank.label}
                        </span>
                      )}
                      {guestRank && (
                        <span className="text-[0.6rem] font-bold px-1 py-[0.1rem] rounded-full"
                          style={{ background: `${guestRank.color}22`, color: guestRank.color, border: `1px solid ${guestRank.color}44` }}>
                          {guestRank.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/games/chess/online/${room.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-display font-bold text-xs hover:bg-yellow-500/20 transition-colors no-underline">
                    <Eye size={12} />
                    Watch
                    {room.spectatorCount > 0 && (
                      <span className="ml-0.5 text-[0.6rem] opacity-80">{room.spectatorCount}</span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
