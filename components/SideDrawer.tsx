"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, MessageSquare, Maximize2, Users } from "lucide-react";

type Sub = { id: string; name: string; tier: string };

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

const SUB_COLORS = [
  "#f97316", "#6366f1", "#10b981", "#fbbf24",
  "#ef4444", "#818cf8", "#ec4899", "#14b8a6",
];

interface Props {
  onClose: () => void;
  isClosing: boolean;
  onOpenChat: () => void;
}

export default function SideDrawer({ onClose, isClosing, onOpenChat }: Props) {
  const [subs, setSubs]       = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/my-subscriptions")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setSubs(data) : setSubs([]))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, []);

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX <= rect.right + 5) return;
    leaveTimer.current = setTimeout(onClose, 150);
  }
  function handleMouseEnter() {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[499] bg-black/35"
        style={{ animation: isClosing ? "fadeOut 0.18s ease both" : "fadeInBg 0.18s ease both" }}
        onClick={onClose}
      />

      {/* Panel — full-height on mobile, 280px on sm+ */}
      <div
        ref={drawerRef}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        className={[
          "fixed left-0 top-0 z-[500] flex flex-col",
          "w-full sm:w-[280px] h-dvh",
          "bg-[var(--bg-card)] border-r border-[var(--border-subtle)]",
          "shadow-[6px_0_40px_rgba(0,0,0,0.5)]",
        ].join(" ")}
        style={{ animation: isClosing ? "slideOutLeft 0.18s ease both" : "slideInLeft 0.2s ease both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
          <span className="font-display font-extrabold text-base tracking-tight text-[var(--text-primary)]">
            Light<span className="text-[var(--accent-orange)]">House</span>
          </span>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center cursor-pointer bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Chat button */}
        <div className="px-[0.875rem] pt-4 pb-2">
          <div
            onClick={onOpenChat}
            className="flex items-center justify-between px-[0.875rem] py-[0.625rem] rounded-[10px] bg-orange-500/[0.07] border border-orange-500/20 cursor-pointer"
          >
            <div className="flex items-center gap-[0.625rem]">
              <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center bg-orange-500/15 border-2 border-orange-500/30 shrink-0">
                <MessageSquare size={16} className="text-[var(--accent-orange)]" />
              </div>
              <span className="font-display font-bold text-sm text-[var(--text-primary)]">
                Global Chat
              </span>
            </div>
            <Link
              href="/chat"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              title="Open full chat"
              className="w-7 h-7 rounded-md flex items-center justify-center no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            >
              <Maximize2 size={13} />
            </Link>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="flex-1 overflow-y-auto px-[0.875rem] pb-4 pt-2">
          <div className="flex items-center gap-[0.375rem] mb-[0.625rem] px-1">
            <Users size={12} className="text-[var(--text-muted)]" />
            <span className="font-display font-bold text-[0.6875rem] text-[var(--text-muted)] tracking-[0.07em] uppercase">
              Subscriptions
            </span>
          </div>

          {/* Skeleton */}
          {loading && (
            <div className="pt-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex gap-[0.625rem] items-center px-1 py-[0.375rem] mb-1">
                  <div className="w-[30px] h-[30px] rounded-full bg-[var(--bg-elevated)] shrink-0" />
                  <div className="w-20 h-3 rounded bg-[var(--bg-elevated)]" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && subs.length === 0 && (
            <p className="text-[0.8125rem] text-[var(--text-muted)] px-1 py-2 leading-relaxed">
              No subscriptions yet.{" "}
              <Link href="/feed" onClick={onClose} className="text-[var(--accent-orange)] no-underline">
                Discover creators
              </Link>
            </p>
          )}

          {/* Sub list */}
          {!loading && subs.map((sub, i) => {
            const color = SUB_COLORS[i % SUB_COLORS.length];
            const initials = sub.name
              .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link
                key={sub.id}
                href={`/profile/${sub.id}`}
                onClick={onClose}
                className="sidebar-sub-link flex items-center gap-[0.625rem] px-1 py-[0.375rem] rounded-lg no-underline transition-colors duration-150"
              >
                <div
                  className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center text-[0.625rem] font-bold font-display"
                  style={{ background: `${color}22`, border: `1.5px solid ${color}50`, color }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-body text-[0.8125rem] text-[var(--text-primary)] truncate">
                    {sub.name}
                  </p>
                  <p className="text-[0.6875rem] font-semibold" style={{ color: TIER_COLORS[sub.tier] ?? "#888" }}>
                    {sub.tier.charAt(0) + sub.tier.slice(1).toLowerCase()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
