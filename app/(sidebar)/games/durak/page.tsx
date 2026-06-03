"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users, Star, Spade } from "lucide-react";

export default function DurakHomePage() {
  const t = useTranslations("durak");

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          ← {t("backToGames")}
        </Link>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Spade size={22} className="text-[var(--accent-orange)]" />
        <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">{t("title")}</h1>
      </div>
      <p className="text-[var(--text-muted)] mb-8">{t("tagline")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <Link
          href="/games/durak/online"
          className="flex flex-col gap-2 p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 no-underline transition-all hover:scale-[1.02]"
        >
          <Users size={22} className="text-indigo-400" />
          <p className="font-display font-bold text-[var(--text-primary)] text-sm">{t("playOnline")}</p>
          <p className="text-[0.7rem] text-[var(--text-muted)]">{t("playOnlineDesc")}</p>
        </Link>
        <Link
          href="/games/durak/online/rated"
          className="flex flex-col gap-2 p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 no-underline transition-all hover:scale-[1.02]"
        >
          <Star size={22} className="text-yellow-400" />
          <p className="font-display font-bold text-[var(--text-primary)] text-sm">{t("playRated")}</p>
          <p className="text-[0.7rem] text-[var(--text-muted)]">{t("playRatedDesc")}</p>
        </Link>
      </div>

      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5">
        <p className="font-display font-bold text-[var(--text-primary)] text-sm mb-3">{t("rulesTitle")}</p>
        <ul className="flex flex-col gap-2 text-sm text-[var(--text-secondary)] list-disc pl-5">
          <li>{t("rule1")}</li>
          <li>{t("rule2")}</li>
          <li>{t("rule3")}</li>
          <li>{t("rule4")}</li>
          <li>{t("rule5")}</li>
          <li>{t("rule6")}</li>
        </ul>
      </div>
    </main>
  );
}
