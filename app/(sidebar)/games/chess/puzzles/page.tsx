"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Loader2, Trophy, Puzzle, Lightbulb, Zap, Tag } from "lucide-react";

type PuzzleItem = {
  id: string;
  title: string;
  difficulty: string;
  rating: number;
  solveCount: number;
  solved: boolean;
  themes?: string[];
  source?: string;
};

const DIFF_LABEL: Record<string, string> = {
  mate1: "Mate in 1", mate2: "Mate in 2", tactical: "Tactical",
  endgame: "Endgame", opening: "Opening",
};
const DIFF_COLOR: Record<string, string> = {
  mate1: "text-green-400 bg-green-500/10 border-green-500/20",
  mate2: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  tactical: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  endgame: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  opening: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

function puzzlePoints(rating: number) {
  return Math.min(25, Math.max(5, Math.round(rating / 100)));
}

export default function PuzzleListPage() {
  const [puzzles, setPuzzles]   = useState<PuzzleItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [themeFilter, setThemeFilter] = useState("");
  const [hintPoints, setHintPoints] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/puzzles")
      .then(r => r.json())
      .then(data => { setPuzzles(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/puzzles/hint-points")
      .then(r => r.ok ? r.json() : null)
      .then((d: { hintPoints: number } | null) => { if (d) setHintPoints(d.hintPoints); })
      .catch(() => {});
  }, []);

  const allThemes    = Array.from(new Set(puzzles.flatMap(p => p.themes ?? []))).sort();
  const difficulties = Array.from(new Set(puzzles.map(p => p.difficulty)));

  const visible = puzzles.filter(p => {
    if (filter !== "all" && p.difficulty !== filter) return false;
    if (themeFilter && !(p.themes ?? []).includes(themeFilter)) return false;
    return true;
  });

  const solvedCount = puzzles.filter(p => p.solved).length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← Games
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <Puzzle size={22} className="text-violet-400" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Chess Puzzles</h1>
        {hintPoints !== null && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-display font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <Lightbulb size={12} /> {hintPoints} hints
          </span>
        )}
      </div>
      <p className="text-[var(--text-muted)] mb-4">Solve tactical puzzles and earn points</p>

      {!loading && puzzles.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <Trophy size={13} className="text-yellow-400" />
          <span className="text-sm text-[var(--text-secondary)] font-display font-semibold">
            {solvedCount} / {puzzles.length} solved
          </span>
          <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden ml-2">
            <div className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${puzzles.length ? (solvedCount / puzzles.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Difficulty filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setFilter("all")}
          className={["px-4 py-1.5 rounded-full text-xs font-display font-bold border transition-all", filter === "all" ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
          All
        </button>
        {difficulties.map(d => (
          <button key={d} onClick={() => setFilter(d)}
            className={["px-4 py-1.5 rounded-full text-xs font-display font-bold border transition-all", filter === d ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
            {DIFF_LABEL[d] ?? d}
          </button>
        ))}
      </div>

      {/* Theme filter */}
      {allThemes.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Tag size={12} className="text-violet-400 shrink-0" />
          <button onClick={() => setThemeFilter("")}
            className={["text-[0.65rem] px-2.5 py-1 rounded-full border transition-all", themeFilter === "" ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
            Any theme
          </button>
          {allThemes.slice(0, 12).map(t => (
            <button key={t} onClick={() => setThemeFilter(themeFilter === t ? "" : t)}
              className={["text-[0.65rem] px-2.5 py-1 rounded-full border transition-all", themeFilter === t ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : visible.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] py-20">No puzzles match the filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((puzzle, i) => (
            <Link key={puzzle.id} href={`/games/chess/puzzles/${puzzle.id}`}
              className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl px-5 py-4 no-underline hover:border-violet-500/30 transition-all group">

              <span className="w-7 text-center font-mono text-sm font-bold text-[var(--text-muted)] shrink-0">{i + 1}</span>

              <div className="shrink-0">
                {puzzle.solved ? <CheckCircle2 size={20} className="text-green-400" /> : <Lock size={20} className="text-[var(--border-subtle)]" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[var(--text-primary)] text-sm group-hover:text-violet-300 transition-colors truncate">{puzzle.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[0.7rem] text-[var(--text-muted)]">{puzzle.solveCount} {puzzle.solveCount === 1 ? "solve" : "solves"}</span>
                  <span className="text-[0.7rem] font-mono text-amber-400/80">★ {puzzle.rating}</span>
                  {puzzle.themes?.slice(0, 2).map(t => (
                    <span key={t} className="text-[0.6rem] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[0.65rem] font-display font-bold px-2 py-0.5 rounded-full border ${DIFF_COLOR[puzzle.difficulty] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                  {DIFF_LABEL[puzzle.difficulty] ?? puzzle.difficulty}
                </span>
                <span className="flex items-center gap-0.5 text-[0.65rem] font-semibold text-emerald-400">
                  <Zap size={10} />{puzzlePoints(puzzle.rating)} pts
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
