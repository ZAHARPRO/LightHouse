"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { BADGE_DEFS } from "@/lib/badges";

/* ─── Types ─── */

type BadgeData = {
  id: string;
  type: string;
  pointsValue: number;
  description: string;
  earnedAt: string;
};

/* ─── Badge metadata — single source: BADGE_DEFS ─── */

const REWARD_META: Record<string, { icon: string; color: string; label: string }> = Object.fromEntries(
  Object.entries(BADGE_DEFS).map(([type, d]) => [type, { icon: d.icon, color: d.color, label: d.label }])
);

const STORAGE_KEY = "lh_badge_seen_at";
const AUTO_DISMISS_MS = 7000;

/* ─── Single toast item ─── */

function ToastItem({ badge, onDone }: { badge: BadgeData; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const meta = REWARD_META[badge.type] ?? { icon: "🎖️", color: "#f97316", label: badge.type };

  function dismiss() {
    setLeaving(true);
    setTimeout(onDone, 320);
  }

  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative flex items-center gap-3 w-[300px] sm:w-[320px] rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
      style={{
        background: "var(--bg-card)",
        border: `1.5px solid ${meta.color}35`,
        animation: leaving
          ? "slideOutRight 0.32s ease both"
          : "slideInRight 0.32s ease both",
      }}
    >
      {/* Countdown bar */}
      <div
        className="absolute bottom-0 left-0 h-[3px] rounded-b-2xl"
        style={{
          background: `linear-gradient(90deg, ${meta.color}, ${meta.color}88)`,
          animation: `badgeProgress ${AUTO_DISMISS_MS}ms linear forwards`,
        }}
      />

      {/* Clickable area → profile badges */}
      <Link
        href="/profile?tab=badges"
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        {/* Badge icon */}
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[1.5rem]"
          style={{
            background: `${meta.color}18`,
            border: `1.5px solid ${meta.color}40`,
          }}
        >
          {meta.icon}
        </div>

        {/* Text */}
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[var(--accent-orange)] mb-[0.1rem]">
            Badge earned!
          </p>
          <p className="font-display font-extrabold text-[0.9rem] text-[var(--text-primary)] truncate">
            {meta.label}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)] truncate">
            +{badge.pointsValue} pts · {badge.description}
          </p>
        </div>
      </Link>

      {/* Close button */}
      <button
        onClick={dismiss}
        className="shrink-0 w-7 h-7 mr-3 rounded-lg flex items-center justify-center cursor-pointer bg-transparent border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors duration-150"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ─── Notifier (mounts globally, checks for new badges) ─── */

export default function BadgeNotifier() {
  const [queue, setQueue] = useState<BadgeData[]>([]);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const seenAt = localStorage.getItem(STORAGE_KEY) ?? "0";

    fetch(`/api/check-new-badges?since=${seenAt}`)
      .then((r) => r.json())
      .then((data: BadgeData[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        setQueue(data);
        // Update seen timestamp to the most recently earned badge
        const latest = data[data.length - 1].earnedAt;
        localStorage.setItem(STORAGE_KEY, String(new Date(latest).getTime()));
      })
      .catch(() => {});
  }, []);

  // Also re-check on window focus (catches badges earned in another tab/action)
  useEffect(() => {
    function onFocus() {
      const seenAt = localStorage.getItem(STORAGE_KEY) ?? "0";
      fetch(`/api/check-new-badges?since=${seenAt}`)
        .then((r) => r.json())
        .then((data: BadgeData[]) => {
          if (!Array.isArray(data) || data.length === 0) return;
          setQueue((prev) => {
            const existingIds = new Set(prev.map((b) => b.id));
            const fresh = data.filter((b) => !existingIds.has(b.id));
            if (fresh.length === 0) return prev;
            const latest = data[data.length - 1].earnedAt;
            localStorage.setItem(STORAGE_KEY, String(new Date(latest).getTime()));
            return [...prev, ...fresh];
          });
        })
        .catch(() => {});
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="fixed top-[76px] right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {queue.map((badge) => (
        <div key={badge.id} className="pointer-events-auto">
          <ToastItem
            badge={badge}
            onDone={() => setQueue((prev) => prev.filter((b) => b.id !== badge.id))}
          />
        </div>
      ))}
    </div>
  );
}
