"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play, Eye, Lock, Clock,
  MessageSquare, ChevronRight, ChevronLeft,
} from "lucide-react";
import ChatPopup from "./ChatPopup";

const THUMB_COLORS = [
  ["#1a1a2e", "#f97316"],
  ["#0a1628", "#6366f1"],
  ["#1a0a0a", "#ef4444"],
  ["#0a1a0a", "#10b981"],
  ["#1a1a0a", "#fbbf24"],
];

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

type Video = {
  id: string;
  title: string;
  author: { name: string | null; image: string | null } | null;
  views: number;
  isPremium: boolean;
  duration: number | null;
  _count: { likes: number; comments: number };
};

type Sub = { id: string; name: string; initials: string; color: string };

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  isPremium: boolean;
  createdAt: Date;
  author: { id: string; name: string | null; tier: string };
};

interface Props {
  videos: Video[];
  userTier: string | null;
  subs: Sub[];
  communityPosts: CommunityPost[];
  isLoggedIn: boolean;
}

/* ── Shared video card ── */
function VideoCard({ video, index, userTier, featured = false }: {
  video: Video;
  index: number;
  userTier: string | null;
  featured?: boolean;
}) {
  const [bg, accent] = THUMB_COLORS[index % THUMB_COLORS.length];
  const locked = video.isPremium && userTier === "FREE";

  return (
    <Link
      href={`/watch/${video.id}`}
      className={[
        "block no-underline rounded-xl overflow-hidden bg-[var(--bg-card)] cursor-pointer transition-[border-color] duration-200",
        featured
          ? "border-2 border-[var(--accent-orange)] shadow-[0_0_20px_rgba(249,115,22,0.15)]"
          : "border border-[var(--border-subtle)]",
      ].join(" ")}
    >
      {/* Thumbnail */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: "16/9", background: `linear-gradient(135deg, ${bg} 0%, ${accent}33 100%)` }}
      >
        {(video as { thumbnail?: string | null }).thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(video as { thumbnail?: string | null }).thumbnail!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {locked ? (
          <Lock size={24} style={{ color: accent }} />
        ) : (
          <div className="relative z-[1] w-11 h-11 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-[6px] border border-white/15">
            <Play size={17} color="white" fill="white" className="ml-0.5" />
          </div>
        )}

        {/* Duration */}
        <div className="absolute bottom-[7px] right-[7px] z-[1] flex items-center gap-[0.2rem] bg-black/72 rounded px-[0.4rem] py-[0.125rem]">
          <Clock size={10} color="#aaa" />
          <span className="text-[0.6875rem] text-[#ddd] font-body">
            {formatDuration(video.duration ?? 600)}
          </span>
        </div>

        {/* Premium badge */}
        {video.isPremium && (
          <div
            className="absolute top-[7px] left-[7px] z-[1] rounded px-[0.4rem] py-[0.1rem]"
            style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)" }}
          >
            <span className="text-[0.625rem] font-bold text-white font-display tracking-[0.04em]">PRO</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-[0.875rem]">
        <h3
          className="font-display font-bold text-sm text-[var(--text-primary)] leading-[1.3] mb-2 overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        >
          {video.title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[0.375rem] min-w-0">
            <div
              className="w-[22px] h-[22px] shrink-0 rounded-full flex items-center justify-center text-[0.5625rem] font-bold font-display"
              style={{
                background: `${accent}22`,
                border: `1px solid ${accent}40`,
                color: accent,
              }}
            >
              {(video.author?.name ?? "?")[0]}
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-body truncate">
              {video.author?.name}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] shrink-0 ml-2">
            <Eye size={11} /> {formatViews(video.views ?? 0)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Main layout ── */
const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#6366f1", FREE: "#666",
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function FeedLayout({ videos, userTier, subs, communityPosts, isLoggedIn }: Props) {
  const [showRight, setShowRight]       = useState(true);
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [chatOpen, setChatOpen]         = useState(false);
  const [chatClosing, setChatClosing]   = useState(false);

  function closeChat() {
    setChatClosing(true);
    setTimeout(() => { setChatOpen(false); setChatClosing(false); }, 180);
  }

  const leftW = leftExpanded ? 130 : 52;

  return (
    <>
      {/* ── MOBILE layout (< lg): single column, no sidebars ── */}
      <div className="lg:hidden px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-extrabold text-lg tracking-tight text-[var(--text-primary)]">Videos</h2>
          {!isLoggedIn && (
            <Link href="/auth/register" className="btn-primary no-underline text-[0.8125rem] py-[0.375rem] px-4">
              Join Free
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((video, i) => (
            <VideoCard key={video.id} video={video} index={i} userTier={userTier} featured={i === 0} />
          ))}
        </div>
      </div>

      {/* ── DESKTOP layout (≥ lg): 3-column grid with sidebars ── */}
      <div
        className="hidden lg:grid max-w-[1440px] mx-auto px-6 py-6 items-start"
        style={{
          gridTemplateColumns: `${leftW}px 1fr ${showRight ? "270px" : "36px"}`,
          gap: "1.5rem",
          transition: "grid-template-columns 0.3s ease",
        }}
      >
        {/* ── LEFT SIDEBAR ── */}
        <aside
          onMouseEnter={() => setLeftExpanded(true)}
          onMouseLeave={() => setLeftExpanded(false)}
          className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden sticky"
          style={{
            width: leftW,
            transition: "width 0.3s ease",
            top: "calc(64px + 1.5rem)",
            maxHeight: "calc(100vh - 64px - 3rem)",
          }}
        >
          {/* Chat button */}
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="sidebar-chat-link flex flex-col items-center cursor-pointer overflow-hidden w-full rounded-xl border transition-[border-color,background] duration-200"
            style={{
              gap: leftExpanded ? "0.5rem" : 0,
              padding: leftExpanded ? "0.75rem 0.5rem" : "0.5rem",
              background: chatOpen ? "rgba(249,115,22,0.08)" : "var(--bg-card)",
              borderColor: chatOpen ? "rgba(249,115,22,0.35)" : "var(--border-subtle)",
              transition: "border-color 0.2s, background 0.2s, padding 0.3s ease, gap 0.3s ease",
            }}
          >
            <div
              className="rounded-full flex items-center justify-center shrink-0 border-2 border-orange-500/30"
              style={{
                width: leftExpanded ? 52 : 34,
                height: leftExpanded ? 52 : 34,
                background: chatOpen ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.12)",
                transition: "width 0.3s ease, height 0.3s ease, background 0.2s",
              }}
            >
              <MessageSquare size={leftExpanded ? 22 : 15} className="text-[var(--accent-orange)]" />
            </div>
            <span
              className="font-display font-bold text-xs tracking-[0.05em] uppercase overflow-hidden whitespace-nowrap"
              style={{
                color: chatOpen ? "var(--accent-orange)" : "var(--text-secondary)",
                maxHeight: leftExpanded ? 24 : 0,
                opacity: leftExpanded ? 1 : 0,
                transition: "max-height 0.3s ease, opacity 0.3s ease, color 0.2s",
              }}
            >
              {chatOpen ? "Close" : "The Chat"}
            </span>
          </button>

          {/* Subscriptions */}
          {subs.length > 0 && (
            <div>
              <p
                className="font-display font-bold text-[0.7rem] text-[var(--text-muted)] tracking-[0.08em] uppercase mb-2 pl-1 overflow-hidden whitespace-nowrap"
                style={{
                  maxHeight: leftExpanded ? 24 : 0,
                  opacity: leftExpanded ? 1 : 0,
                  transition: "max-height 0.3s ease, opacity 0.25s ease",
                }}
              >
                Subscriptions
              </p>
              <div className="flex flex-col gap-[0.375rem]">
                {subs.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/profile/${sub.id}`}
                    className="sidebar-sub-link flex items-center px-[0.25rem] py-[0.3rem] rounded-lg no-underline overflow-hidden"
                    style={{
                      gap: leftExpanded ? "0.625rem" : 0,
                      transition: "background 0.15s, gap 0.3s ease",
                    }}
                  >
                    <div
                      className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center text-[0.6875rem] font-bold font-display"
                      style={{ background: `${sub.color}22`, border: `1.5px solid ${sub.color}50`, color: sub.color }}
                    >
                      {sub.initials}
                    </div>
                    <span
                      className="font-body text-xs text-[var(--text-secondary)] whitespace-nowrap overflow-hidden"
                      style={{
                        maxWidth: leftExpanded ? 90 : 0,
                        opacity: leftExpanded ? 1 : 0,
                        transition: "max-width 0.3s ease, opacity 0.25s ease",
                      }}
                    >
                      {sub.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── CENTER: VIDEOS ── */}
        <main>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-extrabold text-lg tracking-tight text-[var(--text-primary)]">
              Videos
            </h2>
            {!isLoggedIn && (
              <Link href="/auth/register" className="btn-primary no-underline text-[0.8125rem] py-[0.375rem] px-4">
                Join Free
              </Link>
            )}
          </div>

          {/* Responsive video grid: 2 cols normally, 3 when right panel is visible */}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${showRight ? 3 : 4}, 1fr)` }}
          >
            {videos.map((video, i) => (
              <VideoCard key={video.id} video={video} index={i} userTier={userTier} featured={i === 0} />
            ))}
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside
          className="flex flex-col gap-4 overflow-x-hidden sticky transition-opacity duration-300"
          style={{
            overflowY: showRight ? "auto" : "hidden",
            top: "calc(64px + 1.5rem)",
            maxHeight: "calc(100vh - 64px - 3rem)",
          }}
        >
          {/* Toggle */}
          <button
            onClick={() => setShowRight((v) => !v)}
            title={showRight ? "Hide panel" : "Show panel"}
            className="self-start w-8 h-8 rounded-lg shrink-0 flex items-center justify-center cursor-pointer bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--accent-orange)]"
          >
            {showRight ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {showRight && (
            <>
              {/* Community header */}
              <div className="flex items-center justify-between">
                <span className="font-display font-extrabold text-sm text-[var(--text-primary)]">Community</span>
                <Link
                  href="/community"
                  className="text-[0.75rem] font-display font-semibold text-[var(--accent-orange)] no-underline hover:underline"
                >
                  See all
                </Link>
              </div>

              {/* Mini post feed */}
              {communityPosts.length === 0 ? (
                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-6 text-center">
                  <p className="text-[0.8125rem] text-[var(--text-muted)] font-display">
                    {isLoggedIn ? "No posts from your subscriptions yet." : "Sign in to see posts from creators you follow."}
                  </p>
                  {!isLoggedIn && (
                    <Link href="/auth/signin" className="btn-primary no-underline text-xs py-[0.3rem] px-4 mt-3 inline-block">
                      Sign In
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-[0.625rem]">
                  {communityPosts.map((p) => {
                    const color = TIER_COLORS[p.author.tier] ?? "#666";
                    return (
                      <Link
                        key={p.id}
                        href={`/post/${p.id}`}
                        className="block no-underline rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-[0.875rem] py-3 transition-[border-color] duration-150 hover:border-orange-500/30"
                      >
                        {/* Author row */}
                        <div className="flex items-center gap-2 mb-[0.5rem]">
                          <div
                            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-[0.5625rem]"
                            style={{ background: `${color}22`, border: `1.5px solid ${color}50`, color }}
                          >
                            {(p.author.name ?? "?")[0].toUpperCase()}
                          </div>
                          <span className="font-display font-semibold text-[0.75rem] text-[var(--text-secondary)] truncate">
                            {p.author.name}
                          </span>
                          <span className="ml-auto text-[0.6875rem] text-[var(--text-muted)] shrink-0">
                            {timeAgo(p.createdAt)}
                          </span>
                        </div>
                        {/* Title */}
                        <p
                          className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)] leading-[1.3] mb-1 overflow-hidden"
                          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                        >
                          {p.isPremium && (
                            <span className="text-[var(--accent-orange)] mr-1">★</span>
                          )}
                          {p.title}
                        </p>
                        {/* Preview */}
                        <p
                          className="text-[0.75rem] text-[var(--text-muted)] leading-snug overflow-hidden"
                          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                        >
                          {p.content}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* CTA */}
              <Link
                href="/community"
                className="block text-center px-4 py-[0.625rem] rounded-[10px] bg-orange-500/[0.08] border border-orange-500/20 no-underline font-display font-semibold text-[0.8125rem] text-[var(--accent-orange)] transition-colors duration-200 hover:bg-orange-500/[0.12]"
              >
                See more posts →
              </Link>
            </>
          )}
        </aside>
      </div>

      {/* Chat popup */}
      {(chatOpen || chatClosing) && (
        <ChatPopup onClose={closeChat} isClosing={chatClosing} />
      )}
    </>
  );
}
