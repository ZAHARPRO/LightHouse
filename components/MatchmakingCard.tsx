"use client";

import { Loader2, Search, Star, X } from "lucide-react";
import { useTranslations } from "next-intl";

// Explicit Tailwind class maps — dynamic strings are purged by the compiler
const ACCENT: Record<string, { btn: string; border: string; ring: string; icon: string }> = {
  yellow: {
    btn:    "bg-yellow-400 text-black",
    border: "border-yellow-500/25",
    ring:   "bg-yellow-500",
    icon:   "text-yellow-400",
  },
  orange: {
    btn:    "bg-[var(--accent-orange)] text-white",
    border: "border-orange-500/25",
    ring:   "bg-orange-500",
    icon:   "text-[var(--accent-orange)]",
  },
  pink: {
    btn:    "bg-pink-500 text-white",
    border: "border-pink-500/25",
    ring:   "bg-pink-500",
    icon:   "text-pink-400",
  },
  blue: {
    btn:    "bg-blue-500 text-white",
    border: "border-blue-500/25",
    ring:   "bg-blue-500",
    icon:   "text-blue-400",
  },
  green: {
    btn:    "bg-emerald-500 text-white",
    border: "border-emerald-500/25",
    ring:   "bg-emerald-500",
    icon:   "text-emerald-400",
  },
};

type Props = {
  searching: boolean;
  elapsed: number;
  mutedSecs: number;
  onFindMatch: () => void;
  onCancel: () => void;
  /** Disable "Find Match" (e.g. user not logged in) */
  disabled?: boolean;
  /** One of: "yellow" | "orange" | "pink" | "blue" | "green" */
  accentColor?: string;
  /** Short label shown next to the elapsed timer during search, e.g. "⏱ 10 min" */
  searchingLabel?: string;
  /** Settings UI rendered inside the card when not searching */
  children?: React.ReactNode;
};

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

export default function MatchmakingCard({
  searching,
  elapsed,
  mutedSecs,
  onFindMatch,
  onCancel,
  disabled = false,
  accentColor = "yellow",
  searchingLabel,
  children,
}: Props) {
  const t = useTranslations("matchmaking");
  const ac = ACCENT[accentColor] ?? ACCENT.yellow;

  if (searching) {
    return (
      <div className={["bg-[var(--bg-elevated)] border rounded-2xl p-6 mb-8 flex flex-col items-center gap-4", ac.border].join(" ")}>
        {/* Pulsing rings */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <span className={["absolute inset-0 rounded-full opacity-10 animate-ping", ac.ring].join(" ")} />
          <span className={["absolute inset-2 rounded-full opacity-15 animate-ping [animation-delay:0.3s]", ac.ring].join(" ")} />
          <Search size={28} className={["relative z-10", ac.icon].join(" ")} />
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-[var(--text-primary)] text-base">{t("searching")}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            {searchingLabel ? `${searchingLabel} · ` : ""}{fmtElapsed(elapsed)}
          </p>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-display font-semibold hover:text-red-400 transition-colors"
        >
          <X size={14} /> {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-8">
      {children}

      {mutedSecs > 0 && (
        <p className="text-red-400 text-xs font-semibold mb-2">
          {t("mutedFor", { secs: mutedSecs })}
        </p>
      )}

      <button
        onClick={onFindMatch}
        disabled={disabled || mutedSecs > 0}
        className={["flex items-center gap-2 px-6 py-2.5 rounded-xl font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity", ac.btn].join(" ")}
      >
        <Star size={15} />
        {t("findMatch")}
      </button>
    </div>
  );
}
