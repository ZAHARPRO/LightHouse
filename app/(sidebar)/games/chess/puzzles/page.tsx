"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Loader2, Trophy, Puzzle, Lightbulb } from "lucide-react";

type PuzzleItem = {
  id: string;
  title: string;
  difficulty: "mate1" | "mate2";
  solveCount: number;
  solved: boolean;
};

const DIFF_LABEL: Record<string, string> = {
  mate1: "Mate in 1",
  mate2: "Mate in 2",
};

const DIFF_COLOR: Record<string, string> = {
  mate1: "text-green-400 bg-green-500/10 border-green-500/20",
  mate2: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

type Filter = "all" | "mate1" | "mate2";

export default function PuzzleListPage() {
  const [puzzles, setPuzzles]     = useState<PuzzleItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>("all");
  const [hintPoints, setHintPoints] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/puzzles")
      .then((r) => r.json())
      .then((data) => { setPuzzles(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/puzzles/hint-points")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { hintPoints: number } | null) => { if (d) setHintPoints(d.hintPoints); })
      .catch(() => {});
  }, []);

  const visible = filter === "all" ? puzzles : puzzles.filter((p) => p.difficulty === filter);
  const solvedCount = puzzles.filter((p) => p.solved).length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
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
      <p className="text-[var(--text-muted)] mb-2">Find checkmate in 1 or 2 moves</p>

      {!loading && puzzles.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <Trophy size={13} className="text-yellow-400" />
          <span className="text-sm text-[var(--text-secondary)] font-display font-semibold">
            {solvedCount} / {puzzles.length} solved
          </span>
          {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden ml-2">
            <div
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${puzzles.length ? (solvedCount / puzzles.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "mate1", "mate2"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "px-4 py-1.5 rounded-full text-xs font-display font-bold border transition-all",
              filter === f
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            ].join(" ")}
          >
            {f === "all" ? "All" : DIFF_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] py-20">No puzzles yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((puzzle, i) => (
            <Link
              key={puzzle.id}
              href={`/games/chess/puzzles/${puzzle.id}`}
              className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl px-5 py-4 no-underline hover:border-violet-500/30 transition-all group"
            >
              {/* Number */}
              <span className="w-7 text-center font-mono text-sm font-bold text-[var(--text-muted)] shrink-0">
                {i + 1}
              </span>

              {/* Solved indicator */}
              <div className="shrink-0">
                {puzzle.solved ? (
                  <CheckCircle2 size={20} className="text-green-400" />
                ) : (
                  <Lock size={20} className="text-[var(--border-subtle)]" />
                )}
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[var(--text-primary)] text-sm group-hover:text-violet-300 transition-colors truncate">
                  {puzzle.title}
                </p>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-0.5">
                  {puzzle.solveCount} {puzzle.solveCount === 1 ? "solve" : "solves"}
                </p>
              </div>

              {/* Difficulty badge */}
              <span className={`text-[0.65rem] font-display font-bold px-2 py-0.5 rounded-full border shrink-0 ${DIFF_COLOR[puzzle.difficulty]}`}>
                {DIFF_LABEL[puzzle.difficulty]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
