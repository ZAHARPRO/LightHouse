"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Star, X } from "lucide-react";
import Link from "next/link";

const TIME_OPTIONS = [
  { value: "300",  label: "5 min",  icon: "🔥" },
  { value: "600",  label: "10 min", icon: "⏱" },
  { value: "1500", label: "25 min", icon: "🕐" },
];

const TC_LABELS: Record<string, string> = {
  "300": "🔥 5 min",
  "600": "⏱ 10 min",
  "1500": "🕐 25 min",
};

type Phase = "idle" | "searching";

export default function CheckersRatedPage() {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("600");
  const [phase, setPhase]   = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt  = useRef(0);
  const roomIdRef  = useRef<string | null>(null);

  function stopTimers() {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startSearch() {
    setStarting(true);
    try {
      const res = await fetch("/api/checkers-rooms/matchmake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl }),
      });
      if (!res.ok) return;
      const { roomId, matched } = await res.json() as { roomId: string; matched: boolean };

      if (matched) { router.push(`/games/checkers/online/${roomId}`); return; }

      roomIdRef.current = roomId;
      startedAt.current = Date.now();
      setElapsed(0);
      setPhase("searching");

      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/checkers-rooms/${roomId}`);
        if (!r.ok) return;
        const room = await r.json();
        if (room.guestId) { stopTimers(); router.push(`/games/checkers/online/${roomId}`); }
        else if (room.status === "FINISHED") { stopTimers(); setPhase("idle"); }
      }, 2000);

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
    if (roomIdRef.current) {
      await fetch("/api/checkers-rooms/matchmake", { method: "DELETE" }).catch(() => {});
      roomIdRef.current = null;
    }
  }

  useEffect(() => () => { stopTimers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Rated Checkers</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">Win to gain ELO · Lose to drop ELO</p>

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
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <button onClick={startSearch} disabled={starting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {starting ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Find Match
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-elevated)] border border-pink-500/25 rounded-2xl p-6 mb-8 flex flex-col items-center gap-4">
          {/* Pulsing ring */}
          <div className="relative flex items-center justify-center w-20 h-20">
            <span className="absolute inset-0 rounded-full bg-pink-500/10 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-pink-500/15 animate-ping [animation-delay:0.3s]" />
            <Search size={28} className="text-pink-400 relative z-10" />
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
    </main>
  );
}
