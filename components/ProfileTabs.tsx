"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, FileText, Award, Plus, Upload, Zap, ShieldCheck, BarChart2, Eye, ThumbsUp, MessageSquare, Users, Video, Flame, Star, Settings2 } from "lucide-react";
import VideoManager from "./VideoManager";
import PostManager from "./PostManager";
import BadgeShowcaseEditor from "./BadgeShowcaseEditor";

type Video = {
  id: string; title: string; description: string | null;
  url: string; thumbnail: string | null; duration: number | null;
  views: number; isPremium: boolean; createdAt: Date;
  _count: { likes: number };
};
type Post = { id: string; title: string; content: string; isPremium: boolean; createdAt: Date };
type Reward = {
  id: string;
  type: string;
  pointsValue: number;
  description: string;
  earnedAt: Date;
  isManual: boolean;
  adminNote: string | null;
  customBadge: { icon: string; label: string; color: string } | null;
};

const REWARD_META: Record<string, { icon: string; color: string; label: string }> = {
  WATCH_STREAK:   { icon: "🔥", color: "#f97316", label: "Watch Streak" },
  FIRST_COMMENT:  { icon: "💬", color: "#6366f1", label: "First Comment" },
  SUPER_FAN:      { icon: "⭐", color: "#fbbf24", label: "Super Fan" },
  EARLY_ADOPTER:  { icon: "🚀", color: "#10b981", label: "Early Adopter" },
  PREMIUM_MEMBER: { icon: "👑", color: "#fbbf24", label: "Premium Member" },
};

type Stats = {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalSubscribers: number;
  avgViews: number;
  watchStreak: number;
  points: number;
  level: number;
  videoCount: number;
  postCount: number;
};

const TABS = [
  { id: "videos",    label: "Videos",    icon: Play },
  { id: "community", label: "Community", icon: FileText },
  { id: "badges",    label: "Badges",    icon: Award },
  { id: "stats",     label: "Stats",     icon: BarChart2 },
] as const;

type TabId = typeof TABS[number]["id"];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function ProfileTabs({
  videos, posts, rewards, stats, badgeShowcase,
}: {
  videos: Video[];
  posts: Post[];
  rewards: Reward[];
  stats: Stats;
  badgeShowcase: string[];
}) {
  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "videos";
    const p = new URLSearchParams(window.location.search).get("tab");
    return (TABS.some(t => t.id === p) ? p : "videos") as TabId;
  });
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p && TABS.some(t => t.id === p)) setTab(p as TabId);
  }, []);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--border-subtle)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              "flex items-center gap-[0.4rem] px-4 py-[0.625rem] -mb-px",
              "bg-transparent border-none cursor-pointer",
              "font-display font-bold text-sm transition-colors duration-150",
              "border-b-2",
              tab === id
                ? "text-[var(--accent-orange)] border-[var(--accent-orange)]"
                : "text-[var(--text-muted)] border-transparent",
            ].join(" ")}
          >
            <Icon size={14} /> {label}
            {id !== "stats" && (
              <span className="ml-0.5 text-xs opacity-70">
                ({id === "videos" ? videos.length : id === "community" ? posts.length : rewards.length})
              </span>
            )}
          </button>
        ))}

        {/* Quick create buttons */}
        <div className="ml-auto flex gap-2">
          <Link href="/upload" className={quickBtn}>
            <Upload size={13} /> Video
          </Link>
          <Link href="/post/new" className={quickBtn}>
            <Plus size={13} /> Post
          </Link>
        </div>
      </div>

      {/* Video tab */}
      {tab === "videos" && <VideoManager initialVideos={videos} />}

      {/* Community tab */}
      {tab === "community" && <PostManager initialPosts={posts} />}

      {/* Badges tab */}
      {tab === "badges" && (
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--text-muted)] text-sm">
              {rewards.length === 0
                ? "Watch videos, comment, and engage to earn badges."
                : `${rewards.length} badge${rewards.length === 1 ? "" : "s"} earned`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowcaseOpen((v) => !v)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.78rem] font-display font-semibold cursor-pointer transition-colors duration-150",
                  showcaseOpen
                    ? "border-[var(--accent-orange)] text-[var(--accent-orange)] bg-orange-500/[0.07]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:border-orange-500/40 hover:text-[var(--accent-orange)]",
                ].join(" ")}
              >
                <Settings2 size={13} />
                Showcase
              </button>
              <Link
                href="/badges"
                className="flex items-center gap-1 no-underline text-[0.8rem] font-display font-semibold text-[var(--accent-orange)] hover:underline"
              >
                <Award size={13} /> Browse all
              </Link>
            </div>
          </div>

          {/* Badge Showcase editor (collapsible) */}
          {showcaseOpen && (
            <BadgeShowcaseEditor
              rewards={rewards}
              initialSlots={badgeShowcase}
            />
          )}

          {rewards.length === 0 ? (
            <div className="card p-12 text-center">
              <Zap size={32} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <p className="text-[var(--text-secondary)]">No badges yet.</p>
              <Link href="/badges" className="mt-3 inline-block no-underline text-sm font-display font-semibold text-[var(--accent-orange)] hover:underline">
                See what you can earn →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {rewards.map((r) => {
                const customMeta = r.customBadge
                  ? { icon: r.customBadge.icon, color: r.customBadge.color, label: r.customBadge.label }
                  : null;
                const meta = customMeta ?? REWARD_META[r.type] ?? { icon: "🎖️", color: "#888", label: r.type };
                return (
                  <div
                    key={r.id}
                    className="card flex flex-col gap-2 px-5 py-4"
                    style={{ borderColor: `${meta.color}30` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[1.75rem] shrink-0">{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-[0.9rem] mb-0.5">{meta.label}</p>
                        <p className="text-[var(--text-secondary)] text-[0.8125rem]">{r.description}</p>
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: meta.color }}>+{r.pointsValue} pts</span>
                    </div>
                    {r.isManual && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.7rem] font-display font-bold"
                        style={{ background: "rgba(99,102,241,0.08)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
                      >
                        <ShieldCheck size={11} />
                        Awarded by Admin
                        {r.adminNote && <span className="font-normal opacity-80 truncate ml-0.5">— {r.adminNote}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div>
          <p className="text-[var(--text-muted)] text-sm mb-5">Your channel performance at a glance.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Eye,           value: fmt(stats.totalViews),       label: "Total Views",    sub: stats.videoCount > 0 ? `~${fmt(stats.avgViews)} avg/video` : null },
              { icon: ThumbsUp,      value: fmt(stats.totalLikes),       label: "Likes Received", sub: null },
              { icon: MessageSquare, value: fmt(stats.totalComments),    label: "Comments",       sub: null },
              { icon: Users,         value: fmt(stats.totalSubscribers), label: "Subscribers",    sub: null },
              { icon: Video,         value: stats.videoCount,            label: "Videos",         sub: null },
              { icon: FileText,      value: stats.postCount,             label: "Posts",          sub: null },
              { icon: Flame,         value: stats.watchStreak,           label: "Watch Streak",   sub: stats.watchStreak > 0 ? "days in a row" : "Start watching!" },
              { icon: Star,          value: stats.points,                label: "Points",         sub: `Level ${stats.level}` },
            ].map(({ icon: Icon, value, label, sub }) => (
              <div
                key={label}
                className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-4 flex flex-col gap-1"
              >
                <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[0.75rem] mb-1">
                  <Icon size={12} className="text-[var(--accent-orange)] shrink-0" />
                  {label}
                </div>
                <span className="font-display font-extrabold text-[1.5rem] text-[var(--text-primary)] leading-none">
                  {value}
                </span>
                {sub && <span className="text-[0.7rem] text-[var(--text-muted)]">{sub}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const quickBtn = [
  "flex items-center gap-[0.3rem]",
  "py-[0.375rem] px-[0.75rem] rounded-[7px]",
  "no-underline bg-[var(--bg-elevated)]",
  "border border-[var(--border-subtle)]",
  "text-[var(--text-secondary)] font-display font-semibold text-[0.8rem]",
  "transition-all duration-150",
].join(" ");
