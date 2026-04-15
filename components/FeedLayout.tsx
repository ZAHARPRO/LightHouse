"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play, Lock,
  MessageSquare, ChevronRight, ChevronLeft,
} from "lucide-react";
import ChatPopup from "./ChatPopup";
import UserAvatar from "./UserAvatar";

const THUMB_COLORS = [
  ["#0d0d1a", "#f97316"],
  ["#060e1c", "#6366f1"],
  ["#150606", "#ef4444"],
  ["#061509", "#10b981"],
  ["#14120a", "#fbbf24"],
  ["#0d0618", "#a855f7"],
  ["#06100e", "#14b8a6"],
  ["#160a06", "#fb923c"],
];

const CATEGORIES = ["All", "Gaming", "Music", "Programming", "Art", "IRL", "Tech", "Science", "Sports"];

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
  thumbnail?: string | null;
  author: { name: string | null; image: string | null } | null;
  views: number;
  isPremium: boolean;
  duration: number | null;
  createdAt?: Date;
  _count: { likes: number; comments: number };
};

type Sub = { id: string; name: string; initials: string; color: string; image?: string | null };

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  isPremium: boolean;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

interface Props {
  videos: Video[];
  userTier: string | null;
  subs: Sub[];
  communityPosts: CommunityPost[];
  isLoggedIn: boolean;
}

/* ── YouTube-style video card ── */
function VideoCard({ video, index, userTier }: {
  video: Video;
  index: number;
  userTier: string | null;
}) {
  const [bg, accent] = THUMB_COLORS[index % THUMB_COLORS.length];
  const locked = video.isPremium && userTier === "FREE";

  return (
    <Link href={`/watch/${video.id}`} className="block no-underline group cursor-pointer rounded-lg overflow-hidden transition-transform duration-200 hover:scale-[1.02]">
      {/* Thumbnail */}
      <div
        className="relative rounded-xl overflow-hidden mb-3"
        style={{ aspectRatio: "16/9", background: `linear-gradient(135deg, ${bg} 0%, ${accent}22 100%)` }}
      >
        {video.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/15">
          {!locked && (
            <div className="w-14 h-14 rounded-full bg-black/70 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl">
              <Play size={20} color="white" fill="white" className="ml-0.5" />
            </div>
          )}
        </div>

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/70 backdrop-blur-sm border border-white/30 flex items-center justify-center">
              <Lock size={20} style={{ color: accent }} />
            </div>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[0.65rem] text-white font-mono font-semibold">
          {formatDuration(video.duration ?? 600)}
        </div>

        {/* Premium badge */}
        {video.isPremium && (
          <div
            className="absolute top-2 left-2 rounded-md px-2 py-1 shadow-lg"
            style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)" }}
          >
            <span className="text-[0.6rem] font-bold text-white tracking-wider font-display">PRO</span>
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex gap-3">
        <div className="shrink-0">
          <UserAvatar name={video.author?.name ?? "?"} image={video.author?.image} size="sm" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3
            className="font-display font-bold text-[0.9rem] text-[var(--text-primary)] leading-[1.4] mb-1 overflow-hidden"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            {video.title}
          </h3>
          <p className="text-[0.8rem] text-[var(--text-secondary)] font-medium truncate mb-0.5">
            {video.author?.name}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)]">
            {formatViews(video.views ?? 0)} views · {video.createdAt ? timeAgo(video.createdAt) : "recently"}
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ── Hero / featured card — first video, full-width horizontal ── */
function HeroCard({ video, index, userTier }: { video: Video; index: number; userTier: string | null }) {
  const [bg, accent] = THUMB_COLORS[index % THUMB_COLORS.length];
  const locked = video.isPremium && userTier === "FREE";

  return (
    <Link href={`/watch/${video.id}`} className="block no-underline group mb-8">
      <div className="rounded-2xl overflow-hidden flex flex-col sm:flex-row bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-elevated)] transition-all duration-300 group-hover:shadow-xl border border-[var(--border-subtle)] group-hover:border-orange-500/40">
        {/* Thumbnail */}
        <div
          className="relative overflow-hidden shrink-0"
          style={{
            width: "min(100%, 380px)",
            aspectRatio: "16/9",
            background: `linear-gradient(135deg, ${bg} 0%, ${accent}22 100%)`,
          }}
        >
          {video.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
            />
          )}

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
            {!locked && (
              <div
                className="rounded-full bg-black/75 backdrop-blur-md border-2 border-white/40 flex items-center justify-center shadow-2xl"
                style={{ width: 60, height: 60 }}
              >
                <Play size={26} color="white" fill="white" className="ml-1" />
              </div>
            )}
          </div>

          {locked && (
            <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
                <Lock size={28} style={{ color: accent }} />
              </div>
            </div>
          )}

          <div className="absolute bottom-3 right-3 bg-black/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[0.7rem] text-white font-mono font-bold shadow-lg">
            {formatDuration(video.duration ?? 600)}
          </div>

          {video.isPremium && (
            <div
              className="absolute top-3 left-3 rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-sm"
              style={{ background: "linear-gradient(135deg,#f97316,#fbbf24)" }}
            >
              <span className="text-[0.65rem] font-extrabold text-white tracking-widest font-display">EXCLUSIVE</span>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-center gap-3.5">
          <span className="self-start text-[0.62rem] font-display font-bold tracking-[0.15em] uppercase text-[var(--accent-orange)] bg-orange-500/15 border border-orange-500/30 px-3 py-1.5 rounded-full shadow-sm">
            🔥 Trending Now
          </span>

          <h2
            className="font-display font-extrabold text-[1.1rem] text-[var(--text-primary)] leading-[1.25] overflow-hidden"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            {video.title}
          </h2>

          <div className="flex items-center gap-2.5">
            <UserAvatar name={video.author?.name ?? "?"} image={video.author?.image} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[0.85rem] text-[var(--text-secondary)] font-display font-semibold truncate">
                {video.author?.name}
              </p>
              <p className="text-[0.75rem] text-[var(--text-muted)]">
                {formatViews(video.views ?? 0)} views · {video.createdAt ? timeAgo(video.createdAt) : "recently"}
              </p>
            </div>
          </div>

          {/* Engagement metrics */}
          <div className="flex gap-4 text-[0.75rem] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="text-orange-500 font-bold">{formatViews(video._count.likes ?? 0)}</span> likes
            </span>
            <span className="flex items-center gap-1">
              <span className="text-blue-400 font-bold">{formatViews(video._count.comments ?? 0)}</span> comments
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Category chips ── */
function CategoryChips({ active, setActive }: { active: string; setActive: (c: string) => void }) {
  return (
    <div
      className="flex gap-2.5 overflow-x-auto pb-2 mb-6 -mx-6 px-6 sm:-mx-0 sm:px-0"
      style={{ scrollbarWidth: "none", scrollBehavior: "smooth" }}
    >
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => setActive(cat)}
          className={[
            "shrink-0 px-4 py-2 rounded-full text-[0.8rem] font-display font-semibold transition-all duration-150 border cursor-pointer whitespace-nowrap",
            active === cat
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent shadow-md scale-105"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]",
          ].join(" ")}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

/* ── timeAgo helper ── */
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

/* ── Main layout ── */
export default function FeedLayout({ videos, userTier, subs, communityPosts, isLoggedIn }: Props) {
  const [showRight, setShowRight] = useState(true);
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatClosing, setChatClosing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  function closeChat() {
    setChatClosing(true);
    setTimeout(() => { setChatOpen(false); setChatClosing(false); }, 180);
  }

  const leftW = leftExpanded ? 130 : 52;
  const hero = videos[0] ?? null;
  const rest = videos.slice(1);

  return (
    <>
      {/* ── MOBILE layout (< lg) ── */}
      <div className="lg:hidden px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-extrabold text-xl tracking-tight text-[var(--text-primary)]">For You</h2>
          {!isLoggedIn && (
            <Link href="/auth/register" className="btn-primary no-underline text-[0.8125rem] py-[0.375rem] px-4 shadow-md">
              Join Free
            </Link>
          )}
        </div>

        <CategoryChips active={activeCategory} setActive={setActiveCategory} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-8">
          {videos.map((video, i) => (
            <VideoCard key={video.id} video={video} index={i} userTier={userTier} />
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
                      className="w-[40px] h-[40px] rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[0.6875rem] font-bold font-display"
                      style={
                        sub.image
                          ? { border: `1.5px solid ${sub.color}50` }
                          : { background: `${sub.color}22`, border: `1.5px solid ${sub.color}50`, color: sub.color }
                      }
                    >
                      {sub.image ? (
                        <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                      ) : (
                        sub.initials
                      )}
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
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-extrabold text-lg tracking-tight text-[var(--text-primary)]">
              For You
            </h2>
            {!isLoggedIn && (
              <Link href="/auth/register" className="btn-primary no-underline text-[0.8125rem] py-[0.375rem] px-4">
                Join Free
              </Link>
            )}
          </div>

          {/* Category chips */}
          <CategoryChips active={activeCategory} setActive={setActiveCategory} />

          {/* Hero card — first video */}
          {hero && <HeroCard video={hero} index={0} userTier={userTier} />}

          {/* Video grid — remaining videos */}
          {rest.length > 0 && (
            <div
              className="grid gap-x-4 gap-y-7"
              style={{ gridTemplateColumns: `repeat(${showRight ? 2 : 3}, 1fr)` }}
            >
              {rest.map((video, i) => (
                <VideoCard key={video.id} video={video} index={i + 1} userTier={userTier} />
              ))}
            </div>
          )}
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
                  {communityPosts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/post/${p.id}`}
                      className="block no-underline rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-[0.875rem] py-3 transition-[border-color] duration-150 hover:border-orange-500/30"
                    >
                      {/* Author row */}
                      <div className="flex items-center gap-2 mb-[0.5rem]">
                        <UserAvatar name={p.author.name ?? "?"} image={p.author.image} tier={p.author.tier} size="xs" />
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
                        {p.isPremium && <span className="text-[var(--accent-orange)] mr-1">★</span>}
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
                  ))}
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
