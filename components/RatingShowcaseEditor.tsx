"use client";

import { useState, useTransition } from "react";
import { X, Plus, Check, Loader2 } from "lucide-react";
import { updateRatingShowcase } from "@/actions/profile";
import { getRank } from "@/lib/elo";

export type GameKey = "chess" | "minesweeper" | "checkers" | "battleship" | "billiards" | "durak";

export const RATING_GAMES: Record<GameKey, { icon: string; label: string; color: string }> = {
  chess:       { icon: "♟",  label: "Chess",       color: "#6366f1" },
  minesweeper: { icon: "💣", label: "Minesweeper",  color: "#ef4444" },
  checkers:    { icon: "🔴", label: "Checkers",     color: "#f97316" },
  battleship:  { icon: "🚢", label: "Battleship",   color: "#3b82f6" },
  billiards:   { icon: "🎱", label: "Billiards",    color: "#10b981" },
  durak:       { icon: "🃏", label: "Durak",        color: "#a855f7" },
};

const MAX_SLOTS = 2;

export default function RatingShowcaseEditor({
  gameElos,
  initialSlots,
}: {
  gameElos: Record<string, number>;
  initialSlots: string[];
}) {
  const [slots, setSlots] = useState<(GameKey | null)[]>(() => {
    const validated = initialSlots
      .filter((k): k is GameKey => k in RATING_GAMES)
      .slice(0, MAX_SLOTS);
    return Array.from({ length: MAX_SLOTS }, (_, i) => validated[i] ?? null);
  });
  const [picking, setPicking] = useState<number | null>(null);
  const [pending, start]      = useTransition();
  const [flash, setFlash]     = useState(false);

  function save(next: (GameKey | null)[]) {
    const keys = next.filter((k): k is GameKey => k !== null);
    start(async () => {
      await updateRatingShowcase(keys);
      setFlash(true);
      setTimeout(() => setFlash(false), 2000);
    });
  }

  function clearSlot(idx: number) {
    const next = [...slots] as (GameKey | null)[];
    next[idx] = null;
    setSlots(next);
    setPicking(null);
    save(next);
  }

  function pickGame(key: GameKey) {
    if (picking === null) return;
    const next = [...slots] as (GameKey | null)[];
    next[picking] = key;
    setSlots(next);
    setPicking(null);
    save(next);
  }

  const usedKeys  = new Set(slots.filter(Boolean) as GameKey[]);
  const available = (Object.keys(RATING_GAMES) as GameKey[]).filter((k) => !usedKeys.has(k));

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[0.8125rem] font-display font-bold text-[var(--text-primary)]">
            Featured Ratings
          </span>
          <span className="text-[0.7rem] text-[var(--text-muted)] font-display">
            — up to 2 game ratings shown on your public profile
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pending && <Loader2 size={13} className="animate-spin text-[var(--text-muted)]" />}
          {flash && (
            <span className="flex items-center gap-1 text-[0.72rem] text-emerald-400 font-display font-semibold">
              <Check size={11} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Slots */}
      <div className="flex gap-3 flex-wrap mb-1">
        {slots.map((key, idx) => {
          const meta = key ? RATING_GAMES[key] : null;
          const elo  = key ? (gameElos[key] ?? 400) : null;
          const rank = elo != null ? getRank(elo) : null;

          if (meta && key && elo != null && rank) {
            return (
              <div
                key={idx}
                className="relative flex flex-col items-center gap-2 py-4 px-4 rounded-xl border transition-[border-color] duration-150 min-w-[100px]"
                style={{ borderColor: `${meta.color}35`, background: `${meta.color}09` }}
              >
                <button
                  onClick={() => clearSlot(idx)}
                  title="Remove"
                  className="absolute top-2 right-2 w-[22px] h-[22px] rounded-full bg-black/20 border border-white/10 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                >
                  <X size={11} />
                </button>
                <span className="text-[2rem] leading-none select-none">{meta.icon}</span>
                <span
                  className="text-[0.72rem] font-display font-bold text-center leading-tight"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[0.8rem] font-display font-extrabold text-[var(--text-primary)]">{elo}</span>
                  <span className="text-[0.62rem] font-display font-semibold" style={{ color: rank.color }}>{rank.label}</span>
                </div>
              </div>
            );
          }

          return (
            <button
              key={idx}
              onClick={() => setPicking(picking === idx ? null : idx)}
              className={[
                "flex flex-col items-center gap-2 py-4 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 min-w-[100px]",
                picking === idx
                  ? "border-[var(--accent-orange)] bg-orange-500/[0.06]"
                  : "border-[var(--border-subtle)] bg-transparent hover:border-orange-500/40 hover:bg-orange-500/[0.03]",
              ].join(" ")}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors"
                style={{
                  background: picking === idx ? "rgba(249,115,22,0.1)" : "var(--bg-card)",
                  borderColor: picking === idx ? "rgba(249,115,22,0.35)" : "var(--border-subtle)",
                }}
              >
                <Plus size={16} className={picking === idx ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"} />
              </div>
              <span
                className="text-[0.72rem] font-display font-semibold"
                style={{ color: picking === idx ? "var(--accent-orange)" : "var(--text-muted)" }}
              >
                {picking === idx ? "Choosing…" : "Add rating"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Game picker */}
      {picking !== null && (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          {available.length === 0 ? (
            <p className="text-[0.8rem] text-[var(--text-muted)] font-display text-center py-2">
              All slots are filled.
            </p>
          ) : (
            <>
              <p className="text-[0.75rem] text-[var(--text-muted)] font-display mb-3">
                Choose a game to feature:
              </p>
              <div className="flex flex-wrap gap-2">
                {available.map((key) => {
                  const meta = RATING_GAMES[key];
                  const elo  = gameElos[key] ?? 400;
                  const rank = getRank(elo) ?? { label: "Unranked", color: "#888" };
                  return (
                    <button
                      key={key}
                      onClick={() => pickGame(key)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-100 hover:scale-[1.04] hover:shadow-md"
                      style={{ borderColor: `${meta.color}35`, background: `${meta.color}0d` }}
                    >
                      <span className="text-[1.4rem] leading-none">{meta.icon}</span>
                      <div className="flex flex-col items-start">
                        <span
                          className="text-[0.75rem] font-display font-bold leading-tight"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[0.65rem] text-[var(--text-muted)]">
                          {elo} · <span style={{ color: rank.color }}>{rank.label}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
