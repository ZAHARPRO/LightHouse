"use client";

import Link from "next/link";
import { Bomb, Wifi, Crown, Star, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getRank } from "@/lib/elo";

const GAMES = [
  { href: "/games/minesweeper",              title: "Minesweeper",        description: "Click cells, avoid mines",      icon: Bomb,  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20"  },
  { href: "/games/minesweeper/online",       title: "MS Online",          description: "1 vs 1",                        icon: Wifi,  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20"    },
  { href: "/games/minesweeper/online/rated", title: "MS Rated",           description: "Earn ELO",                      icon: Star,  color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20"  },
  { href: "/games/chess",                    title: "Chess vs Bot",       description: "3 difficulty levels",           icon: Crown, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20"  },
  { href: "/games/chess/online",             title: "Chess Online",       description: "1 vs 1 with timer",             icon: Wifi,  color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20"  },
  { href: "/games/chess/online/rated",       title: "Chess Rated",        description: "Earn ELO",                      icon: Star,  color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20"  },
];

type LeaderEntry = {
  id: string;
  name: string | null;
  image: string | null;
  chessElo: number;
  minesweeperElo: number;
  wins: number;
  maxStreak: number;
};

const LEADERBOARDS = [
  { key: "chess",       label: "♟ Chess",        eloField: "chessElo"       as const },
  { key: "minesweeper", label: "💣 Minesweeper",  eloField: "minesweeperElo" as const },
];

const PLACE_COLOR = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function GamesPage() {
  const [lbIndex, setLbIndex] = useState(0);
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const prevIndex = useRef(lbIndex);

  const current = LEADERBOARDS[lbIndex];

  useEffect(() => {
    function load() {
      fetch(`/api/leaderboard?game=${current.key}&limit=10`, { cache: "no-store" })
        .then(r => r.json())
        .then(d => { setEntries(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
    setLoading(true);
    load();
    const t = setInterval(load, 30000);
    prevIndex.current = lbIndex;
    return () => clearInterval(t);
  }, [lbIndex, current.key]);

  function prev() { setLbIndex(i => (i - 1 + LEADERBOARDS.length) % LEADERBOARDS.length); setExpanded(false); }
  function next() { setLbIndex(i => (i + 1) % LEADERBOARDS.length); setExpanded(false); }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)] mb-1">Mini Games</h1>
      <p className="text-[var(--text-muted)] mb-8">Choose a game</p>

      {/* ── Leaderboard ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl mb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Star size={16} className="text-yellow-400" />
          <h2 className="font-display font-extrabold text-base text-[var(--text-primary)]">Leaderboard</h2>
          <Link href="/games/leaderboard"
            className="text-[0.7rem] font-display font-semibold text-[var(--accent-orange)] hover:opacity-80 transition-opacity no-underline whitespace-nowrap">
            View all →
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={prev}
              className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center hover:border-[var(--accent-orange)] transition-colors">
              <ChevronLeft size={13} className="text-[var(--text-muted)]" />
            </button>
            <span className="text-sm font-display font-semibold text-[var(--text-secondary)] px-2 min-w-[120px] text-center">
              {current.label}
            </span>
            <button onClick={next}
              className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center hover:border-[var(--accent-orange)] transition-colors">
              <ChevronRight size={13} className="text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
          {/* Column headers */}
          <div className="grid items-center px-4 py-2 border-b border-[var(--border-subtle)]"
            style={{ gridTemplateColumns: "28px 36px 1fr 60px 60px 60px" }}>
            <span />
            <span />
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">Player</span>
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">ELO</span>
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">Wins</span>
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center flex items-center justify-center gap-0.5">
              <Flame size={10} className="text-orange-400" /> Best
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">No ranked players yet — be the first!</div>
          ) : (
            (expanded ? entries : entries.slice(0, 3)).map((u, i) => {
              const elo  = u[current.eloField];
              const rank = getRank(elo);
              return (
                <Link key={u.id} href={`/profile/${u.id}`}
                  className="grid items-center px-4 py-2 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border-subtle)] last:border-0 no-underline"
                  style={{ gridTemplateColumns: "28px 36px 1fr 60px 60px 60px" }}>

                  {/* Place */}
                  <span className="font-mono font-bold text-sm text-center"
                    style={{ color: PLACE_COLOR[i] ?? "var(--text-muted)" }}>
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  {u.image
                    ? <Image src={u.image} alt="" width={28} height={28} className="rounded-full" />
                    : <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-xs">
                        {u.name?.[0] ?? "?"}
                      </div>
                  }

                  {/* Name + rank */}
                  <div className="min-w-0 pl-2">
                    <p className="font-display font-semibold text-sm text-[var(--text-primary)] truncate leading-tight">{u.name ?? "Anonymous"}</p>
                    {rank && (
                      <span className="text-[0.6rem] font-bold leading-tight" style={{ color: rank.color }}>
                        {rank.emoji} {rank.label}
                      </span>
                    )}
                  </div>

                  {/* ELO */}
                  <span className="font-mono font-bold text-sm text-[var(--text-primary)] text-center">{elo}</span>

                  {/* Wins */}
                  <span className="font-mono text-sm text-[var(--text-secondary)] text-center">{u.wins}</span>

                  {/* Max streak */}
                  <span className="font-mono text-sm text-center flex items-center justify-center gap-0.5"
                    style={{ color: u.maxStreak >= 5 ? "#f97316" : "var(--text-muted)" }}>
                    {u.maxStreak >= 3 && <Flame size={11} className="shrink-0" style={{ color: u.maxStreak >= 5 ? "#f97316" : "#888" }} />}
                    {u.maxStreak}
                  </span>
                </Link>
              );
            })
          )}
          {!loading && entries.length > 3 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full py-2 text-[0.75rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors border-t border-[var(--border-subtle)] bg-transparent"
            >
              {expanded ? "Show less ▲" : `Show all ${entries.length} ▼`}
            </button>
          )}
        </div>
      </div>

      {/* ── Game cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {GAMES.map(({ href, title, description, icon: Icon, color, bg }) => (
          <Link key={href} href={href}
            className={["flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border no-underline",
              "transition-all duration-150 hover:scale-[1.03] hover:shadow-lg", bg].join(" ")}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-black/20 ${color}`}>
              <Icon size={22} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-[var(--text-primary)] text-xs leading-tight">{title}</p>
              <p className="text-[0.68rem] text-[var(--text-muted)] mt-0.5 leading-tight">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
