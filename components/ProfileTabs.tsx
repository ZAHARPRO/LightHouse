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
      <div style={{ display:"flex", alignItems:"center", gap:"0.25rem", marginBottom:"1.5rem", borderBottom:"1px solid var(--border-subtle)", paddingBottom:"0" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display:"flex", alignItems:"center", gap:"0.4rem",
              padding:"0.625rem 1rem",
              background:"transparent", border:"none", cursor:"pointer",
              fontFamily:"var(--font-display)", fontWeight:700, fontSize:"0.875rem",
              color: tab === id ? "var(--accent-orange)" : "var(--text-muted)",
              borderBottom: tab === id ? "2px solid var(--accent-orange)" : "2px solid transparent",
              marginBottom:"-1px", transition:"color 0.15s",
            }}
          >
            <Icon size={14}/> {label}
            <span style={{ marginLeft:2, fontSize:"0.75rem", opacity:0.7 }}>
              ({id === "videos" ? videos.length : id === "community" ? posts.length : rewards.length})
            </span>
          </button>
        ))}

        {/* Quick create buttons */}
        <div style={{ marginLeft:"auto", display:"flex", gap:"0.5rem" }}>
          <Link href="/upload" style={quickBtn}>
            <Upload size={13}/> Video
          </Link>
          <Link href="/post/new" style={quickBtn}>
            <Plus size={13}/> Post
          </Link>
        </div>
      </div>

      {/* Video tab */}
      {tab === "videos" && <VideoManager initialVideos={videos}/>}

      {/* Community tab */}
      {tab === "community" && <PostManager initialPosts={posts}/>}

      {/* Badges tab */}
      {tab === "badges" && (
        rewards.length === 0 ? (
          <div className="card" style={{ padding:"3rem", textAlign:"center" }}>
            <Zap size={32} color="var(--text-muted)" style={{ margin:"0 auto 1rem" }}/>
            <p style={{ color:"var(--text-secondary)" }}>No badges yet — watch videos, comment, and engage to earn rewards!</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"1rem" }}>
            {rewards.map((r) => {
              const meta = REWARD_META[r.type] ?? { icon:"🎖️", color:"#888", label:r.type };
              return (
                <div key={r.id} className="card" style={{ padding:"1.25rem 1.5rem", display:"flex", gap:"0.875rem", alignItems:"center", borderColor:`${meta.color}30` }}>
                  <div style={{ fontSize:"1.75rem", flexShrink:0 }}>{meta.icon}</div>
                  <div>
                    <p style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"0.9rem", marginBottom:"0.125rem" }}>{meta.label}</p>
                    <p style={{ color:"var(--text-secondary)", fontSize:"0.8125rem", marginBottom:"0.25rem" }}>{r.description}</p>
                    <span style={{ fontSize:"0.75rem", fontWeight:700, color:meta.color }}>+{r.pointsValue} pts</span>
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

const quickBtn: React.CSSProperties = {
  display:"flex", alignItems:"center", gap:"0.3rem",
  padding:"0.375rem 0.75rem", borderRadius:7, textDecoration:"none",
  background:"var(--bg-elevated)", border:"1px solid var(--border-subtle)",
  color:"var(--text-secondary)", fontFamily:"var(--font-display)",
  fontWeight:600, fontSize:"0.8rem", transition:"all 0.15s",
};
