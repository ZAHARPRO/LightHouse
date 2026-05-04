"use client";

import Link from "next/link";
import { Star, ChevronLeft, ChevronRight, Flame } from "lucide-react";

function MineIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="m 11.324219,3.07539 -1.21875,1.21875 0.621093,0.6211 c 0.220313,0.22031 0.220313,0.57656 0,0.79453 L 10.31875,6.11758 C 10.595313,6.7293 10.75,7.40899 10.75,8.12383 c 0,2.69297 -2.1820313,4.875 -4.875,4.875 C 3.1820313,12.99883 1,10.81914 1,8.12617 c 0,-2.69296 2.1820312,-4.875 4.875,-4.875 0.7148437,0 1.3945312,0.15469 2.00625,0.43125 L 8.2890625,3.27461 C 8.509375,3.0543 8.865625,3.0543 9.0835937,3.27461 L 9.7046875,3.8957 10.923438,2.67695 11.324219,3.07539 Z m 1.394531,-0.66797 -0.5625,0 c -0.154688,0 -0.28125,0.12657 -0.28125,0.28125 0,0.15469 0.126562,0.28125 0.28125,0.28125 l 0.5625,0 C 12.873438,2.96992 13,2.84336 13,2.68867 13,2.53399 12.873438,2.40742 12.71875,2.40742 Z M 11.3125,1.00117 c -0.154688,0 -0.28125,0.12657 -0.28125,0.28125 l 0,0.5625 c 0,0.15469 0.126562,0.28125 0.28125,0.28125 0.154688,0 0.28125,-0.12656 0.28125,-0.28125 l 0,-0.5625 c 0,-0.15468 -0.126562,-0.28125 -0.28125,-0.28125 z m 0.794531,1.28907 0.398438,-0.39844 c 0.110156,-0.11016 0.110156,-0.28828 0,-0.39844 -0.110157,-0.11016 -0.288281,-0.11016 -0.398438,0 L 11.708594,1.8918 c -0.110157,0.11015 -0.110157,0.28828 0,0.39844 0.1125,0.11015 0.290625,0.11015 0.398437,0 z m -1.589062,0 c 0.110156,0.11015 0.288281,0.11015 0.398437,0 0.110156,-0.11016 0.110156,-0.28829 0,-0.39844 L 10.517969,1.49336 c -0.110156,-0.11016 -0.288281,-0.11016 -0.398438,0 -0.110156,0.11016 -0.110156,0.28828 0,0.39844 l 0.398438,0.39844 z m 1.589062,0.79687 c -0.110156,-0.11016 -0.288281,-0.11016 -0.398437,0 -0.110157,0.11016 -0.110157,0.28828 0,0.39844 l 0.398437,0.39844 c 0.110157,0.11015 0.288281,0.11015 0.398438,0 0.110156,-0.11016 0.110156,-0.28829 0,-0.39844 L 12.107031,3.08711 Z M 3.625,7.37617 c 0,-0.82734 0.6726562,-1.5 1.5,-1.5 0.20625,0 0.375,-0.16875 0.375,-0.375 0,-0.20625 -0.16875,-0.375 -0.375,-0.375 -1.2398438,0 -2.25,1.01016 -2.25,2.25 0,0.20625 0.16875,0.375 0.375,0.375 0.20625,0 0.375,-0.16875 0.375,-0.375 z"/>
    </svg>
  );
}

function ChessIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M255.875 19.47c-33.142 0-59.844 26.822-59.844 60.186 0 33.364 26.703 60.156 59.845 60.156 33.142 0 59.875-26.792 59.875-60.156S289.017 19.47 255.875 19.47zm-50.688 120.343c-2.908 1.23-5.658 2.53-8.187 3.937-14.467 8.046-21.47 17.86-21.47 27.094 0 9.234 7.003 19.08 21.47 27.125 14.467 8.044 35.51 13.436 58.875 13.436 23.365 0 44.408-5.392 58.875-13.437 14.467-8.047 21.47-17.892 21.47-27.126 0-9.234-7.003-19.048-21.47-27.094-2.53-1.406-5.28-2.708-8.188-3.938-13.696 11.647-31.392 18.688-50.687 18.688-19.3 0-36.996-7.034-50.688-18.688zm78.875 87.906c-8.948 1.54-18.394 2.374-28.187 2.374-9.315 0-18.316-.758-26.875-2.156 2.69 6.923 4.36 14.186 4.906 21.656 2.456 33.554-17.04 69.573-58.47 93.594l-.155.093-.155.095c-20.062 10.653-30.28 24.056-30.28 36.97 0 12.9 10.28 26.46 30.343 37.217 20.062 10.76 48.86 17.844 80.75 17.844s60.687-7.085 80.75-17.844c20.062-10.758 30.343-24.318 30.343-37.218 0-13.127-10.773-26.656-31.655-37.406l-.22-.125-.186-.094c-40.344-23.394-58.705-59.676-55.908-93.22.626-7.497 2.31-14.813 5-21.78zM128.845 395.655c-5.592 3.72-10.256 7.61-13.875 11.53-6.9 7.48-9.94 14.64-9.94 21.845 0 7.206 3.04 14.397 9.94 21.876 6.898 7.48 17.6 14.852 31.28 21.125 27.36 12.547 66.42 20.69 109.625 20.69 43.206 0 82.295-8.143 109.656-20.69 13.682-6.27 24.352-13.644 31.25-21.124 6.9-7.48 9.97-14.67 9.97-21.875 0-7.204-3.07-14.363-9.97-21.842-3.597-3.902-8.238-7.767-13.78-11.47-5.638 15.6-19.584 28.706-37.5 38.313-23.533 12.62-54.947 20.095-89.563 20.095-34.615 0-66.06-7.474-89.593-20.094-17.94-9.62-31.887-22.747-37.5-38.374z"/>
    </svg>
  );
}
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getRank } from "@/lib/elo";
import { useTranslations } from "next-intl";

function CheckersIcon({ size = 22 }: { size?: number }) {
  // 4×4 checkerboard with black and white pieces on dark squares
  const sq = 16; // cell size in a 64×64 viewBox
  const board = [
    [0,1,0,1],
    [1,0,1,0],
    [0,1,0,1],
    [1,0,1,0],
  ];
  // dark squares: (r+c)%2===1; pieces placed on specific dark squares
  const blackPieces: [number,number][] = [[0,1],[0,3],[1,0],[1,2]];
  const whitePieces: [number,number][] = [[2,1],[2,3],[3,0],[3,2]];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      {/* Board squares */}
      {board.map((row, r) => row.map((_, c) => (
        <rect
          key={`${r}-${c}`}
          x={c * sq} y={r * sq} width={sq} height={sq}
          fill={(r + c) % 2 === 0 ? "#f0d9b5" : "#b58863"}
        />
      )))}
      {/* Black pieces */}
      {blackPieces.map(([r, c]) => (
        <g key={`b-${r}-${c}`}>
          <circle cx={c * sq + sq / 2} cy={r * sq + sq / 2} r={sq * 0.38} fill="#1a1a1a" />
          <circle cx={c * sq + sq / 2} cy={r * sq + sq / 2} r={sq * 0.26} fill="none" stroke="#555" strokeWidth="1.2" />
        </g>
      ))}
      {/* White pieces */}
      {whitePieces.map(([r, c]) => (
        <g key={`w-${r}-${c}`}>
          <circle cx={c * sq + sq / 2} cy={r * sq + sq / 2} r={sq * 0.38} fill="#f0f0f0" />
          <circle cx={c * sq + sq / 2} cy={r * sq + sq / 2} r={sq * 0.26} fill="none" stroke="#bbb" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}

function PuzzleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5A2.5 2.5 0 0 0 10.5 1 2.5 2.5 0 0 0 8 3.5V5H4a2 2 0 0 0-2 2v3.8h1.5a2.5 2.5 0 0 1 0 5H2V19a2 2 0 0 0 2 2h3.8v-1.5a2.5 2.5 0 0 1 5 0V21H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5Z"/>
    </svg>
  );
}

const GAMES = [
  { href: "/games/minesweeper",              title: "Minesweeper",        description: "Click cells, avoid mines",      icon: MineIcon,     color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20"  },
  { href: "/games/minesweeper/online",       title: "MS Online",          description: "1 vs 1",                        icon: MineIcon,     color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20"  },
  { href: "/games/minesweeper/online/rated", title: "MS Rated",           description: "Earn ELO",                      icon: MineIcon,     color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20"  },
  { href: "/games/chess",                    title: "Chess vs Bot",       description: "3 difficulty levels",           icon: ChessIcon,    color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20"  },
  { href: "/games/chess/online",             title: "Chess Online",       description: "1 vs 1 with timer",             icon: ChessIcon,    color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20"  },
  { href: "/games/chess/online/rated",       title: "Chess Rated",        description: "Earn ELO",                      icon: ChessIcon,    color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20"  },
  { href: "/games/chess/puzzles",            title: "Chess Puzzles",      description: "Mate in 1 or 2 moves",          icon: PuzzleIcon,   color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20"  },
  { href: "/games/checkers",                 title: "Checkers vs Bot",    description: "3 difficulty levels",           icon: CheckersIcon, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20"  },
  { href: "/games/checkers/online",          title: "Checkers Online",    description: "1 vs 1 in real-time",           icon: CheckersIcon, color: "text-amber-400",  bg: "bg-indigo-500/10 border-indigo-500/20"    },
  { href: "/games/checkers/online/rated",    title: "Checkers Rated",     description: "Earn ELO",                      icon: CheckersIcon, color: "text-orange-400", bg: "bg-yellow-500/10 border-yellow-500/20"  },
];

type LeaderEntry = {
  id: string;
  name: string | null;
  image: string | null;
  chessElo: number;
  minesweeperElo: number;
  checkersElo: number;
  wins: number;
  maxStreak: number;
};

const LEADERBOARDS = [
  { key: "chess",       label: "♟ Chess",        eloField: "chessElo"       as const },
  { key: "minesweeper", label: "💣 Minesweeper",  eloField: "minesweeperElo" as const },
  { key: "checkers",    label: "🔴 Checkers",     eloField: "checkersElo"    as const },
];

const PLACE_COLOR = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function GamesPage() {
  const t = useTranslations("games");
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
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 ">
      {/* ── Leaderboard ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl mb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Star size={16} className="text-yellow-400" />
          <h2 className="font-display font-extrabold text-base text-[var(--text-primary)]">{t("leaderboard")}</h2>
          <Link href="/games/leaderboard"
            className="text-[0.7rem] font-display font-semibold text-[var(--accent-orange)] hover:opacity-80 transition-opacity no-underline whitespace-nowrap">
            {t("viewAll")}
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
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">{t("player")}</span>
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">{t("elo")}</span>
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center">{t("wins")}</span>
            <span className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider text-center flex items-center justify-center gap-0.5">
              <Flame size={10} className="text-orange-400" /> {t("best")}
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">{t("loading")}</div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">{t("noPlayers")}</div>
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
              {expanded ? t("showLess") : t("showAll", { count: entries.length })}
            </button>
          )}
        </div>
      </div>

      {/* ── Game cards ─────────────────────────────────────────────────── */}
      {[
        { label: "💣 Minesweeper", games: GAMES.filter(g => g.href.includes("minesweeper")) },
        { label: "♟ Chess",        games: GAMES.filter(g => g.href.includes("chess"))       },
        { label: "⛂ Checkers",    games: GAMES.filter(g => g.href.includes("checkers"))    },
      ].map(({ label, games }) => (
        <div key={label} className="mb-6">
          <p className="text-xs font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">{label}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ maxWidth: 480 }}>
            {games.map(({ href, title, description, icon: Icon, color, bg }) => (
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
        </div>
      ))}
    </main>
  );
}
