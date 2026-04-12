"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, FileText, Award, Plus, Upload, Zap } from "lucide-react";
import VideoManager from "./VideoManager";
import PostManager from "./PostManager";

type Video = {
  id: string; title: string; description: string | null;
  url: string; thumbnail: string | null; duration: number | null;
  views: number; isPremium: boolean; createdAt: Date;
  _count: { likes: number };
};
type Post = { id: string; title: string; content: string; isPremium: boolean; createdAt: Date };
type Reward = { id: string; type: string; pointsValue: number; description: string; earnedAt: Date };

const REWARD_META: Record<string, { icon: string; color: string; label: string }> = {
  WATCH_STREAK:   { icon: "🔥", color: "#f97316", label: "Watch Streak" },
  FIRST_COMMENT:  { icon: "💬", color: "#6366f1", label: "First Comment" },
  SUPER_FAN:      { icon: "⭐", color: "#fbbf24", label: "Super Fan" },
  EARLY_ADOPTER:  { icon: "🚀", color: "#10b981", label: "Early Adopter" },
  PREMIUM_MEMBER: { icon: "👑", color: "#fbbf24", label: "Premium Member" },
};

const TABS = [
  { id: "videos",    label: "Videos",    icon: Play },
  { id: "community", label: "Community", icon: FileText },
  { id: "badges",    label: "Badges",    icon: Award },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ProfileTabs({
  videos, posts, rewards,
}: {
  videos: Video[];
  posts: Post[];
  rewards: Reward[];
}) {
  const [tab, setTab] = useState<TabId>("videos");

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
            <span className="ml-0.5 text-xs opacity-70">
              ({id === "videos" ? videos.length : id === "community" ? posts.length : rewards.length})
            </span>
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
        rewards.length === 0 ? (
          <div className="card p-12 text-center">
            <Zap size={32} className="mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)]">No badges yet — watch videos, comment, and engage to earn rewards!</p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {rewards.map((r) => {
              const meta = REWARD_META[r.type] ?? { icon: "🎖️", color: "#888", label: r.type };
              return (
                <div
                  key={r.id}
                  className="card flex items-center gap-[0.875rem] px-6 py-5"
                  style={{ borderColor: `${meta.color}30` }}
                >
                  <div className="text-[1.75rem] shrink-0">{meta.icon}</div>
                  <div>
                    <p className="font-display font-bold text-[0.9rem] mb-0.5">{meta.label}</p>
                    <p className="text-[var(--text-secondary)] text-[0.8125rem] mb-1">{r.description}</p>
                    <span className="text-xs font-bold" style={{ color: meta.color }}>+{r.pointsValue} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
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
