"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Flame, X, ArrowLeft, Puzzle } from "lucide-react";
import { getRank } from "@/lib/elo";

type LeaderEntry = {
  id: string;
  name: string | null;
  image: string | null;
  chessElo: number;
  minesweeperElo: number;
  checkersElo: number;
  battleshipElo: number;
  billiardsElo: number;
  wins: number;
  maxStreak: number;
};

type PuzzleEntry = {
  id: string;
  name: string | null;
  image: string | null;
  puzzleRating: number;
  solveCount: number;
};

const GAMES = [
  { key: "chess",       label: "♟ Chess" },
  { key: "minesweeper", label: "💣 Minesweeper" },
  { key: "checkers",    label: "⛳ Checkers" },
  { key: "battleship",  label: "⚓ Battleship" },
  { key: "billiards",   label: "🎱 Billiards" },
  { key: "puzzles",     label: "🧩 Puzzles" },
] as const;

type GameKey = typeof GAMES[number]["key"];

const ELO_FIELDS: Record<string, keyof LeaderEntry> = {
  chess:       "chessElo",
  minesweeper: "minesweeperElo",
  checkers:    "checkersElo",
  battleship:  "battleshipElo",
  billiards:   "billiardsElo",
};

const PLACE_COLOR = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function LeaderboardPage() {
  const [game, setGame]           = useState<GameKey>("chess");
  const [query, setQuery]         = useState("");
  const [entries, setEntries]     = useState<LeaderEntry[]>([]);
  const [puzzleEntries, setPuzzleEntries] = useState<PuzzleEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const isPuzzles = game === "puzzles";
  const eloField  = ELO_FIELDS[game] as keyof LeaderEntry | undefined;

  const fetchEntries = useCallback((g: GameKey, q: string) => {
    setLoading(true);
    if (g === "puzzles") {
      const params = new URLSearchParams({ limit: "100" });
      if (q) params.set("search", q);
      fetch(`/api/puzzles/leaderboard?${params}`)
        .then(r => r.json())
        .then(d => { setPuzzleEntries(d); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ game: g, limit: "100" });
      if (q) params.set("search", q);
      fetch(`/api/leaderboard?${params}`)
        .then(r => r.json())
        .then(d => { setEntries(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    fetchEntries(game, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

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

  const noResults = isPuzzles ? puzzleEntries.length === 0 : entries.length === 0;
  const totalShown = isPuzzles ? puzzleEntries.length : entries.length;

  return (
    <main className="max-w-2xl mx-auto px-4">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6 no-underline">
        <ArrowLeft size={14} /> Games
      </Link>

      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-6">Leaderboard</h1>

      {/* Game switcher */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-4">
        {GAMES.map(g => (
          <button key={g.key} onClick={() => { setGame(g.key); setQuery(""); }}
            className={[
              "flex-1 min-w-fit px-3 py-1.5 rounded-lg text-sm font-display font-semibold transition-all",
              game === g.key
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            ].join(" ")}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
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

      {/* Table */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">

        {/* ── Puzzles columns ── */}
        {isPuzzles && (
          <div className="grid items-center px-4 py-2 border-b border-[var(--border-subtle)]"
            style={{ gridTemplateColumns: "32px 36px 1fr 72px 72px" }}>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">#</span>
            <span />
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider pl-2">Player</span>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">Rating</span>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center flex items-center justify-center gap-0.5">
              <Puzzle size={9} className="text-violet-400" /> Solved
            </span>
          </div>
        )}

        {/* ── ELO-game columns ── */}
        {!isPuzzles && (
          <div className="grid items-center px-4 py-2 border-b border-[var(--border-subtle)]"
            style={{ gridTemplateColumns: "32px 36px 1fr 64px 56px 56px" }}>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">#</span>
            <span />
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider pl-2">Player</span>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">ELO</span>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">Wins</span>
            <span className="text-[0.62rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center flex items-center justify-center gap-0.5">
              <Flame size={9} className="text-pink-400" /> Best
            </span>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-[var(--text-muted)] text-sm">Loading…</div>
        ) : noResults ? (
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
        ) : isPuzzles ? (
          /* ── Puzzle rows ── */
          puzzleEntries.map((u, i) => {
            const placeColor = PLACE_COLOR[i] ?? undefined;
            return (
              <Link key={u.id} href={`/profile/${u.id}`}
                className="grid items-center px-4 py-2.5 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border-subtle)] last:border-0 no-underline"
                style={{ gridTemplateColumns: "32px 36px 1fr 72px 72px" }}>

                <span className="font-mono font-bold text-sm text-center"
                  style={{ color: placeColor ?? "var(--text-muted)" }}>
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                </span>

                {u.image
                  ? <Image src={u.image} alt="" width={28} height={28} className="rounded-full" />
                  : <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 font-bold text-[0.65rem]">
                      {u.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                }

                <p className="font-display font-semibold text-sm text-[var(--text-primary)] truncate pl-2">
                  {u.name ?? "Anonymous"}
                </p>

                <span className="font-mono font-bold text-sm text-violet-300 text-center">{u.puzzleRating}</span>
                <span className="font-mono text-sm text-[var(--text-secondary)] text-center">{u.solveCount}</span>
              </Link>
            );
          })
        ) : (
          /* ── ELO-game rows ── */
          entries.map((u, i) => {
            const elo  = eloField ? (u[eloField] as number) : 0;
            const rank = getRank(elo);
            const placeColor = PLACE_COLOR[i] ?? undefined;
            return (
              <Link key={u.id} href={`/profile/${u.id}`}
                className="grid items-center px-4 py-2 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border-subtle)] last:border-0 no-underline"
                style={{ gridTemplateColumns: "32px 36px 1fr 64px 56px 56px" }}>

                <span className="font-mono font-bold text-sm text-center"
                  style={{ color: placeColor ?? "var(--text-muted)" }}>
                  {i + 1}
                </span>

                {u.image
                  ? <Image src={u.image} alt="" width={28} height={28} className="rounded-full" />
                  : <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-[0.65rem]">
                      {u.name?.[0] ?? "?"}
                    </div>
                }

                <div className="min-w-0 pl-2">
                  <p className="font-display font-semibold text-sm text-[var(--text-primary)] truncate leading-tight">{u.name ?? "Anonymous"}</p>
                  {rank && (
                    <span className="text-[0.6rem] font-bold leading-tight" style={{ color: rank.color }}>
                      {rank.emoji} {rank.label}
                    </span>
                  )}
                </div>

                <span className="font-mono font-bold text-sm text-[var(--text-primary)] text-center">{elo}</span>
                <span className="font-mono text-sm text-[var(--text-secondary)] text-center">{u.wins}</span>
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

      {!loading && !noResults && (
        <p className="text-center text-[0.72rem] text-[var(--text-muted)] mt-3">
          {query ? `${totalShown} result${totalShown !== 1 ? "s" : ""}` : `Top ${totalShown} players`}
        </p>
      )}
    </main>
  );
}
