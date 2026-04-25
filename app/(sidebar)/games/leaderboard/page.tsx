"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Flame, X, ArrowLeft } from "lucide-react";
import { getRank } from "@/lib/elo";

type LeaderEntry = {
  id: string;
  name: string | null;
  image: string | null;
  chessElo: number;
  minesweeperElo: number;
  wins: number;
  maxStreak: number;
};

const GAMES = [
  { key: "chess",       label: "♟ Chess" },
  { key: "minesweeper", label: "💣 Minesweeper" },
] as const;

type GameKey = typeof GAMES[number]["key"];

const PLACE_COLOR = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function LeaderboardPage() {
  const [game, setGame] = useState<GameKey>("chess");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const eloField = game === "chess" ? "chessElo" : "minesweeperElo";

  const fetchEntries = useCallback((g: GameKey, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ game: g, limit: "100" });
    if (q) params.set("search", q);
    fetch(`/api/leaderboard?${params}`)
      .then(r => r.json())
      .then(d => { setEntries(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Fetch on game change immediately
  useEffect(() => {
    fetchEntries(game, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Debounce search input
  function handleSearch(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchEntries(game, val), 300);
  }

  function clearSearch() {
    setQuery("");
    fetchEntries(game, "");
    inputRef.current?.focus();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Back */}
      <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6 no-underline">
        <ArrowLeft size={14} /> Games
      </Link>

      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-6">Leaderboard</h1>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Game switcher */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {GAMES.map(g => (
            <button key={g.key} onClick={() => { setGame(g.key); setQuery(""); }}
              className={[
                "flex-1 px-4 py-1.5 rounded-lg text-sm font-display font-semibold transition-all",
                game === g.key
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              ].join(" ")}>
              {g.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/4 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search player…"
            className="w-full pl-8 pr-8 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
          />
          {query && (
            <button onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-none cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
        {/* Column headers */}
        <div className="grid items-center px-4 py-2 border-b border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: "32px 36px 1fr 64px 56px 56px" }}>
          <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">#</span>
          <span />
          <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider pl-2">Player</span>
          <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">ELO</span>
          <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">Wins</span>
          <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center flex items-center justify-center gap-0.5">
            <Flame size={9} className="text-orange-400" /> Best
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[var(--text-muted)] text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[var(--text-muted)] text-sm mb-1">
              {query ? `No players found for "${query}"` : "No ranked players yet"}
            </p>
            {query && (
              <button onClick={clearSearch}
                className="text-[var(--accent-orange)] text-xs font-display font-semibold bg-transparent border-none cursor-pointer hover:opacity-80">
                Clear search
              </button>
            )}
          </div>
        ) : (
          entries.map((u, i) => {
            const elo  = u[eloField];
            const rank = getRank(elo);
            const placeColor = PLACE_COLOR[i] ?? undefined;
            return (
              <Link key={u.id} href={`/profile/${u.id}`}
                className="grid items-center px-4 py-2 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border-subtle)] last:border-0 no-underline"
                style={{ gridTemplateColumns: "32px 36px 1fr 64px 56px 56px" }}>

                {/* Place */}
                <span className="font-mono font-bold text-sm text-center"
                  style={{ color: placeColor ?? "var(--text-muted)" }}>
                  {i + 1}
                </span>

                {/* Avatar */}
                {u.image
                  ? <Image src={u.image} alt="" width={28} height={28} className="rounded-full" />
                  : <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-[0.65rem]">
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
                  {u.maxStreak >= 3 && <Flame size={10} className="shrink-0" style={{ color: u.maxStreak >= 5 ? "#f97316" : "#888" }} />}
                  {u.maxStreak}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {!loading && entries.length > 0 && (
        <p className="text-center text-[0.72rem] text-[var(--text-muted)] mt-3">
          {query ? `${entries.length} result${entries.length !== 1 ? "s" : ""}` : `Top ${entries.length} players`}
        </p>
      )}
    </main>
  );
}
