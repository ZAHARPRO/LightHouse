"use client";

import { useState, useTransition } from "react";
import { X, Plus, Check, Loader2 } from "lucide-react";
import { updateBadgeShowcase } from "@/actions/profile";

export type ShowcaseReward = {
  id: string;
  type: string;
  description: string;
  customBadge: { icon: string; label: string; color: string } | null;
};

const REWARD_META: Record<string, { icon: string; color: string; label: string }> = {
  WATCH_STREAK:   { icon: "🔥", color: "#f97316", label: "Watch Streak" },
  FIRST_COMMENT:  { icon: "💬", color: "#6366f1", label: "First Comment" },
  SUPER_FAN:      { icon: "⭐", color: "#fbbf24", label: "Super Fan" },
  EARLY_ADOPTER:  { icon: "🚀", color: "#10b981", label: "Early Adopter" },
  PREMIUM_MEMBER: { icon: "👑", color: "#fbbf24", label: "Premium Member" },
};

export function getBadgeMeta(r: ShowcaseReward) {
  if (r.customBadge)
    return { icon: r.customBadge.icon, color: r.customBadge.color, label: r.customBadge.label };
  return REWARD_META[r.type] ?? { icon: "🎖️", color: "#888", label: r.type };
}

export default function BadgeShowcaseEditor({
  rewards,
  initialSlots,
}: {
  rewards: ShowcaseReward[];
  initialSlots: string[];
}) {
  const [slots, setSlots] = useState<(string | null)[]>([
    initialSlots[0] ?? null,
  ]);
  const [picking, setPicking] = useState<number | null>(null);
  const [pending, start]      = useTransition();
  const [flash, setFlash]     = useState(false);

  function save(next: (string | null)[]) {
    const ids = next.filter((x): x is string => x !== null);
    start(async () => {
      await updateBadgeShowcase(ids);
      setFlash(true);
      setTimeout(() => setFlash(false), 2000);
    });
  }

  function clearSlot(idx: number) {
    const next = [...slots];
    next[idx] = null;
    setSlots(next);
    setPicking(null);
    save(next);
  }

  function pickBadge(rewardId: string) {
    if (picking === null) return;
    const next = [...slots];
    next[picking] = rewardId;
    setSlots(next);
    setPicking(null);
    save(next);
  }

  const usedIds   = new Set(slots.filter(Boolean));
  const available = rewards.filter((r) => !usedIds.has(r.id));

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[0.8125rem] font-display font-bold text-[var(--text-primary)]">
            Featured Badge
          </span>
          <span className="text-[0.7rem] text-[var(--text-muted)] font-display">
            — 1 badge shown on your public profile
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

      {/* 1 slot */}
      <div className="flex gap-3 mb-1">
        {slots.map((slotId, idx) => {
          const reward = slotId ? rewards.find((r) => r.id === slotId) : null;
          const meta   = reward ? getBadgeMeta(reward) : null;

          if (meta && reward) {
            return (
              <div
                key={idx}
                className="relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-xl border transition-[border-color] duration-150"
                style={{ borderColor: `${meta.color}35`, background: `${meta.color}09` }}
              >
                {/* Remove button */}
                <button
                  onClick={() => clearSlot(idx)}
                  title="Remove from showcase"
                  className="absolute top-2 right-2 w-[22px] h-[22px] rounded-full bg-black/20 border border-white/10 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                >
                  <X size={11} />
                </button>

                <span className="text-[2.25rem] leading-none select-none">{meta.icon}</span>
                <span
                  className="text-[0.72rem] font-display font-bold text-center leading-tight"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
              </div>
            );
          }

          /* Empty slot */
          return (
            <button
              key={idx}
              onClick={() => setPicking(picking === idx ? null : idx)}
              className={[
                "flex flex-col items-center gap-2.5 py-5 px-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150",
                picking === idx
                  ? "border-[var(--accent-orange)] bg-orange-500/[0.06]"
                  : "border-[var(--border-subtle)] bg-transparent hover:border-orange-500/40 hover:bg-orange-500/[0.03]",
              ].join(" ")}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center border transition-colors"
                style={{
                  background: picking === idx ? "rgba(249,115,22,0.1)" : "var(--bg-card)",
                  borderColor: picking === idx ? "rgba(249,115,22,0.35)" : "var(--border-subtle)",
                }}
              >
                <Plus size={18} className={picking === idx ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"} />
              </div>
              <span
                className="text-[0.72rem] font-display font-semibold"
                style={{ color: picking === idx ? "var(--accent-orange)" : "var(--text-muted)" }}
              >
                {picking === idx ? "Choosing…" : "Feature"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Badge picker panel */}
      {picking !== null && (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          {available.length === 0 ? (
            <p className="text-[0.8rem] text-[var(--text-muted)] font-display text-center py-2">
              All badges are already in your showcase.
            </p>
          ) : (
            <>
              <p className="text-[0.75rem] text-[var(--text-muted)] font-display mb-3">
                Select a badge to feature:
              </p>
              <div className="flex flex-wrap gap-2">
                {available.map((r) => {
                  const meta = getBadgeMeta(r);
                  return (
                    <button
                      key={r.id}
                      onClick={() => pickBadge(r.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-100 hover:scale-[1.04] hover:shadow-md"
                      style={{
                        borderColor: `${meta.color}35`,
                        background: `${meta.color}0d`,
                      }}
                    >
                      <span className="text-[1.25rem] leading-none">{meta.icon}</span>
                      <span
                        className="text-[0.75rem] font-display font-semibold"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
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
