"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play, Heart, MessageCircle, Eye, Lock, Clock,
  MessageSquare, ChevronRight, ChevronLeft, BarChart2,
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
type Post = {
  user: { name: string; initials: string; color: string };
  text: string;
  likes: number; comments: number; views: number; reach: number;
};

interface Props {
  videos: Video[];
  userTier: string | null;
  featuredVideo: Video;
  subs: Sub[];
  post: Post;
  isLoggedIn: boolean;
}

export default function FeedLayout({ videos, userTier, featuredVideo, subs, post, isLoggedIn }: Props) {
  const [showRight, setShowRight] = useState(true);
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const leftW = leftExpanded ? 130 : 52;

  return (
    <>
    <div
      style={{
        maxWidth: 1440,
        margin: "0 auto",
        padding: "1.5rem",
        display: "grid",
        gridTemplateColumns: `${leftW}px 1fr ${showRight ? "270px" : "36px"}`,
        gap: "1.5rem",
        alignItems: "start",
        transition: "grid-template-columns 0.3s ease",
      }}
    >
      {/* ── LEFT SIDEBAR ── */}
      <aside
        onMouseEnter={() => setLeftExpanded(true)}
        onMouseLeave={() => setLeftExpanded(false)}
        style={{
          display: "flex", flexDirection: "column", gap: "1rem",
          overflowY: "auto", overflowX: "hidden",
          width: leftW, transition: "width 0.3s ease",
          position: "sticky", top: "calc(64px + 1.5rem)",
          maxHeight: "calc(100vh - 64px - 3rem)",
        }}
      >
        {/* Chat button */}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="sidebar-chat-link"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: leftExpanded ? "0.5rem" : 0,
            padding: leftExpanded ? "0.75rem 0.5rem" : "0.5rem",
            borderRadius: 12,
            background: chatOpen ? "rgba(249,115,22,0.08)" : "var(--bg-card)",
            border: chatOpen ? "1px solid rgba(249,115,22,0.35)" : "1px solid var(--border-subtle)",
            cursor: "pointer",
            transition: "border-color 0.2s, background 0.2s, padding 0.3s ease, gap 0.3s ease",
            overflow: "hidden",
            width: "100%",
          }}
        >
          <div style={{
            width: leftExpanded ? 52 : 34,
            height: leftExpanded ? 52 : 34,
            borderRadius: "50%",
            background: chatOpen ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.12)",
            border: "2px solid rgba(249,115,22,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "width 0.3s ease, height 0.3s ease, background 0.2s",
          }}>
            <MessageSquare size={leftExpanded ? 22 : 15} color="var(--accent-orange)" />
          </div>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.75rem",
            color: chatOpen ? "var(--accent-orange)" : "var(--text-secondary)",
            letterSpacing: "0.05em", textTransform: "uppercase",
            maxHeight: leftExpanded ? 24 : 0,
            opacity: leftExpanded ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease, opacity 0.3s ease, color 0.2s",
            whiteSpace: "nowrap",
          }}>
            {chatOpen ? "Close" : "The Chat"}
          </span>
        </button>

        {/* Subscriptions — only when there are any */}
        {subs.length > 0 && (
        <div>
          <p style={{
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.7rem",
            color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: "0.5rem", paddingLeft: 4,
            maxHeight: leftExpanded ? 24 : 0,
            opacity: leftExpanded ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease, opacity 0.25s ease",
            whiteSpace: "nowrap",
          }}>
            Subscriptions
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {subs.map((sub) => (
              <Link
                key={sub.id}
                href={`/profile/${sub.id}`}
                className="sidebar-sub-link"
                style={{
                  display: "flex", alignItems: "center",
                  gap: leftExpanded ? "0.625rem" : 0,
                  padding: "0.3rem 0.25rem", borderRadius: 8,
                  textDecoration: "none", transition: "background 0.15s, gap 0.3s ease",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: `${sub.color}22`, border: `1.5px solid ${sub.color}50`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: "0.6875rem", fontWeight: 700,
                  color: sub.color, fontFamily: "var(--font-display)",
                }}>
                  {sub.initials}
                </div>
                <span style={{
                  fontFamily: "var(--font-body)", fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap", overflow: "hidden",
                  maxWidth: leftExpanded ? 90 : 0,
                  opacity: leftExpanded ? 1 : 0,
                  transition: "max-width 0.3s ease, opacity 0.25s ease",
                }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Videos
          </h2>
          {!isLoggedIn && (
            <Link href="/auth/register" className="btn-primary" style={{ textDecoration: "none", fontSize: "0.8125rem", padding: "0.375rem 1rem" }}>
              Join Free
            </Link>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${showRight ? 3 : 4}, 1fr)`, gap: "1rem" }}>
            {videos.map((video, i) => {
              const [bg, accent] = THUMB_COLORS[i % THUMB_COLORS.length];
              const locked = video.isPremium && userTier === "FREE";
              const isFeatured = i === 0;

              return (
                <Link key={video.id} href={`/watch/${video.id}`} style={{
                  display: "block", textDecoration: "none",
                  borderRadius: 12, overflow: "hidden", background: "var(--bg-card)",
                  border: isFeatured ? "2px solid var(--accent-orange)" : "1px solid var(--border-subtle)",
                  cursor: "pointer", transition: "border-color 0.2s",
                  boxShadow: isFeatured ? "0 0 20px rgba(249,115,22,0.15)" : "none",
                }}>
                  <div style={{
                    aspectRatio: "16/9",
                    background: `linear-gradient(135deg, ${bg} 0%, ${accent}33 100%)`,
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {(video as {thumbnail?: string|null}).thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(video as {thumbnail?: string|null}).thumbnail!}
                        alt=""
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                    {locked ? (
                      <Lock size={24} color={accent} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                        border: "1.5px solid rgba(255,255,255,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative", zIndex: 1,
                      }}>
                        <Play size={17} color="white" fill="white" style={{ marginLeft: 2 }} />
                      </div>
                    )}
                    <div style={{
                      position: "absolute", bottom: 7, right: 7, zIndex: 1,
                      background: "rgba(0,0,0,0.72)", borderRadius: 4,
                      padding: "0.125rem 0.4rem", display: "flex", alignItems: "center", gap: "0.2rem",
                    }}>
                      <Clock size={10} color="#aaa" />
                      <span style={{ fontSize: "0.6875rem", color: "#ddd", fontFamily: "var(--font-body)" }}>
                        {formatDuration(video.duration ?? 600)}
                      </span>
                    </div>
                    {video.isPremium && (
                      <div style={{
                        position: "absolute", top: 7, left: 7, zIndex: 1,
                        background: "linear-gradient(90deg,#f97316,#fbbf24)",
                        borderRadius: 4, padding: "0.1rem 0.4rem",
                      }}>
                        <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "white", fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>PRO</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "0.875rem" }}>
                    <h3 style={{
                      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem",
                      color: "var(--text-primary)", lineHeight: 1.3, marginBottom: "0.5rem",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {video.title}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: `${THUMB_COLORS[i % THUMB_COLORS.length][1]}22`,
                          border: `1px solid ${THUMB_COLORS[i % THUMB_COLORS.length][1]}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.5625rem", fontWeight: 700,
                          color: THUMB_COLORS[i % THUMB_COLORS.length][1], fontFamily: "var(--font-display)",
                        }}>
                          {(video.author?.name ?? "?")[0]}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
                          {video.author?.name}
                        </span>
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <Eye size={11} /> {formatViews(video.views ?? 0)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
      </main>

      {/* ── RIGHT SIDEBAR ── */}
      <aside style={{
        display: "flex", flexDirection: "column", gap: "1rem",
        overflowY: showRight ? "auto" : "hidden",
        overflowX: "hidden",
        position: "sticky", top: "calc(64px + 1.5rem)",
        maxHeight: "calc(100vh - 64px - 3rem)",
        transition: "opacity 0.3s ease",
      }}>
        {/* Toggle button — always at the top */}
        <button
          onClick={() => setShowRight((v) => !v)}
          title={showRight ? "Hide panel" : "Show panel"}
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--accent-orange)",
            alignSelf: "flex-start",
          }}
        >
          {showRight ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {showRight && (<>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}>
            <div style={{
              aspectRatio: "16/9",
              background: "linear-gradient(135deg, #0a0a1a 0%, #1a1040 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem",
                color: "#fbbf24", letterSpacing: "0.04em", textShadow: "0 0 20px rgba(251,191,36,0.4)",
                textAlign: "center", padding: "0 1rem",
              }}>
                {featuredVideo.title.split(" ").slice(0, 2).join(" ")}
              </div>
            </div>
            <div style={{ padding: "0.625rem 0.875rem" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                {featuredVideo.title}
              </p>
            </div>
          </div>

          <div style={{ borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: `${post.user.color}22`, border: `1.5px solid ${post.user.color}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.6875rem", color: post.user.color,
              }}>
                {post.user.initials}
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                {post.user.name}
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "0.875rem" }}>
              {post.text}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <Heart size={13} color="#ef4444" fill="#ef4444" /> {post.likes}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <MessageCircle size={13} /> {post.comments}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <Eye size={13} /> {post.views}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <BarChart2 size={13} /> {post.reach}
              </span>
            </div>
          </div>

          <Link
            href="/subscriptions"
            className="sidebar-cta-link"
            style={{
              display: "block", textAlign: "center", padding: "0.75rem", borderRadius: 10,
              background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
              textDecoration: "none", fontFamily: "var(--font-display)", fontWeight: 600,
              fontSize: "0.8125rem", color: "var(--accent-orange)", lineHeight: 1.4, transition: "background 0.2s",
            }}
          >
            watch more<br />pictures and posts
          </Link>
        </>)}
      </aside>
    </div>

    {/* Chat popup — rendered outside the grid to escape stacking context issues */}
    {chatOpen && (
      <ChatPopup onClose={() => setChatOpen(false)} />
    )}
    </>
  );
}
