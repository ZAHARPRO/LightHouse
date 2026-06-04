"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Star, Spade, Bot } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";
type DeckSize = 36 | 52;
type Variant = "podkidnoy" | "perevodnoy";
type ThrowRule = "all" | "neighbors";

export default function DurakHomePage() {
  const t = useTranslations("durak");
  const router = useRouter();

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [deckSize, setDeckSize] = useState<DeckSize>(36);
  const [variant, setVariant] = useState<Variant>("podkidnoy");
  const [playerCount, setPlayerCount] = useState(2);
  const [throwRule, setThrowRule] = useState<ThrowRule>("all");

  function startBotGame() {
    router.push(
      `/games/durak/bot?difficulty=${difficulty}&deck=${deckSize}&variant=${variant}&players=${playerCount}&throw=${throwRule}`,
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/games/"
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors"
        >
          ← {t("backToGames")}
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Spade size={22} className="text-[var(--accent-orange)]" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">
          {t("title")}
        </h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">{t("tagline")}</p>

      {/* ── Bot game configurator ── */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Bot size={20} className="text-[var(--accent-orange)]" />
          <h2 className="font-display font-bold text-[var(--text-primary)] text-base">
            {t("vsBot")}
          </h2>
        </div>

        {/* Difficulty */}
        <div className="mb-4">
          <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wide">
            {t("selectDifficulty")}
          </p>
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={[
                  "flex-1 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  difficulty === d
                    ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {d === "easy" ? t("easy") : d === "medium" ? t("medium") : t("hard")}
              </button>
            ))}
          </div>
        </div>

        {/* Player count */}
        <div className="mb-4">
          <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wide">
            {t("botCount")} ({playerCount - 1})
          </p>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={[
                  "flex-1 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  playerCount === n
                    ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {n === 2 ? "1v1" : `${n - 1} bot${n > 2 ? "s" : ""}`}
              </button>
            ))}
          </div>
        </div>

        {/* Deck size */}
        <div className="mb-4">
          <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wide">
            {t("deckSize")}
          </p>
          <div className="flex gap-2">
            {([36, 52] as DeckSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setDeckSize(size)}
                className={[
                  "flex-1 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  deckSize === size
                    ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {size} {t("cards")}
              </button>
            ))}
          </div>
        </div>

        {/* Variant toggle */}
        <div className="mb-4">
          <button
            onClick={() => setVariant(variant === "perevodnoy" ? "podkidnoy" : "perevodnoy")}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
              variant === "perevodnoy"
                ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            <span className={[
              "w-4 h-4 rounded-sm border flex items-center justify-center text-[0.6rem] transition-all",
              variant === "perevodnoy"
                ? "bg-[var(--accent-orange)] border-[var(--accent-orange)] text-white"
                : "border-[var(--border-subtle)]",
            ].join(" ")}>
              {variant === "perevodnoy" && "✓"}
            </span>
            {t("perevodnoy")}
          </button>
        </div>

        {/* Throw rule — only relevant with 4+ players */}
        {playerCount >= 4 && (
          <div className="mb-6">
            <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wide">
              {t("throwRule")}
            </p>
            <div className="flex gap-2">
              {(["all", "neighbors"] as ThrowRule[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setThrowRule(r)}
                  className={[
                    "flex-1 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                    throwRule === r
                      ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  ].join(" ")}
                >
                  {r === "all" ? t("throwAll") : t("throwNeighbors")}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={startBotGame}
          className="w-full py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-base hover:opacity-90 transition-opacity"
        >
          {t("startGame")}
        </button>
      </div>

      {/* ── Online play links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <Link
          href="/games/durak/online"
          className="flex flex-col gap-2 p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 no-underline transition-all hover:scale-[1.02]"
        >
          <Users size={22} className="text-indigo-400" />
          <p className="font-display font-bold text-[var(--text-primary)] text-sm">
            {t("playOnline")}
          </p>
          <p className="text-[0.7rem] text-[var(--text-muted)]">
            {t("playOnlineDesc")}
          </p>
        </Link>
        <Link
          href="/games/durak/online/rated"
          className="flex flex-col gap-2 p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 no-underline transition-all hover:scale-[1.02]"
        >
          <Star size={22} className="text-yellow-400" />
          <p className="font-display font-bold text-[var(--text-primary)] text-sm">
            {t("playRated")}
          </p>
          <p className="text-[0.7rem] text-[var(--text-muted)]">
            {t("playRatedDesc")}
          </p>
        </Link>
      </div>
    </main>
  );
}
