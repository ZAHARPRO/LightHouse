"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Swords } from "lucide-react";
import Link from "next/link";

const TIME_OPTIONS = [
  { value: "300",  label: "5 min",  icon: "🔥" },
  { value: "600",  label: "10 min", icon: "⏱" },
  { value: "1500", label: "25 min", icon: "🕐" },
];

export default function CheckersRatedPage() {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("600");
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomIdRef = useRef<string | null>(null);

  function stopSearch() {
    setSearching(false); setElapsed(0);
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (roomIdRef.current) {
      fetch("/api/checkers-rooms/matchmake", { method: "DELETE" }).catch(() => {});
      roomIdRef.current = null;
    }
  }

  async function startSearch() {
    setSearching(true); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    const res = await fetch("/api/checkers-rooms/matchmake", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeControl }),
    });
    const data = await res.json() as { roomId: string; matched: boolean };
    roomIdRef.current = data.roomId;

    if (data.matched) { stopSearch(); router.push(`/games/checkers/online/${data.roomId}`); return; }

    // Poll until a guest joins
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/checkers-rooms/${data.roomId}`).then(x => x.json());
      if (r.guestId) { stopSearch(); router.push(`/games/checkers/online/${data.roomId}`); }
      else if (r.status === "FINISHED") stopSearch();
    }, 2000);
  }

  useEffect(() => () => stopSearch(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center">
      <Link href="/games/checkers/online" className="self-start text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm mb-8 transition-colors">← Lobby</Link>
      <Swords size={40} className="text-orange-400 mb-4" />
      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">Rated Checkers</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Win to gain ELO · Lose to drop ELO</p>

      {!searching ? (
        <>
          <div className="flex gap-2 mb-6">
            {TIME_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setTimeControl(opt.value)}
                className={["px-4 py-2 rounded-xl text-sm font-display font-semibold border transition-all",
                  timeControl === opt.value
                    ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <button onClick={startSearch}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 transition-opacity">
            <Swords size={16} /> Find Match
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-orange-400 animate-spin" />
          <p className="text-[var(--text-primary)] font-display font-bold text-lg">{mins}:{secs}</p>
          <p className="text-[var(--text-muted)] text-sm">Searching for an opponent…</p>
          <button onClick={stopSearch}
            className="mt-2 px-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-semibold text-sm hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
        </div>
      )}
    </main>
  );
}
