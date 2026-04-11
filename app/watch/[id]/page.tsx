import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { isGDriveEmbed } from "@/lib/videoUrl";
import Link from "next/link";
import {
  ArrowLeft, Eye, Clock, Play, Lock,
  Calendar, Users,
} from "lucide-react";
import SubscribeButton from "@/components/SubscribeButton";
import LikeButtons from "@/components/LikeButtons";
import CommentsSection from "@/components/CommentsSection";

const THUMB_COLORS = [
  ["#1a1a2e", "#f97316"],
  ["#0a1628", "#6366f1"],
  ["#1a0a0a", "#ef4444"],
  ["#0a1a0a", "#10b981"],
  ["#1a1a0a", "#fbbf24"],
];

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

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

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  let video;
  try {
    video = await prisma.video.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true, name: true, image: true, tier: true, bio: true,
            _count: { select: { subscribers: true, videos: true } },
          },
        },
        category: true,
        _count: { select: { likes: true, comments: true } },
      },
    });
  } catch {
    notFound();
  }

  if (!video) notFound();

  const isLocked = video.isPremium && (!session);

  // Check follow status
  let isFollowing = false;
  const isMe = session?.user?.id === video.author.id;
  if (session?.user?.id && !isMe) {
    try {
      const sub = await prisma.subscription.findUnique({
        where: {
          subscriberId_creatorId: {
            subscriberId: session.user.id,
            creatorId: video.author.id,
          },
        },
      });
      isFollowing = !!sub;
    } catch { /* ignore */ }
  }

  // Increment view count — skip for the video's own author
  if (!isMe) {
    await prisma.video.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  // Like/dislike counts + user's reaction
  const likesCount    = await prisma.like.count({ where: { videoId: id, type: "LIKE" } });
  const dislikesCount = await prisma.like.count({ where: { videoId: id, type: "DISLIKE" } });
  let userReaction: "LIKE" | "DISLIKE" | null = null;
  if (session?.user?.id) {
    const row = await prisma.like.findUnique({
      where: { userId_videoId: { userId: session.user.id, videoId: id } },
    });
    userReaction = (row?.type as "LIKE" | "DISLIKE") ?? null;
  }

  // Comments with replies and like data
  const rawComments = await prisma.comment.findMany({
    where: { videoId: id, parentId: null },
    include: {
      author: { select: { id: true, name: true } },
      likes:  { select: { userId: true } },
      replies: {
        include: {
          author: { select: { id: true, name: true } },
          likes:  { select: { userId: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  type RawReply = {
    id: string; content: string; createdAt: Date; replyToName: string | null;
    author: { id: string; name: string | null };
    likes: { userId: string }[];
  };
  type RawComment = {
    id: string; content: string; createdAt: Date; isPinned: boolean;
    author: { id: string; name: string | null };
    likes: { userId: string }[];
    replies: RawReply[];
  };

  const uid = session?.user?.id ?? null;
  const comments = (rawComments as RawComment[]).map((c) => ({
    id: c.id, content: c.content, createdAt: c.createdAt, isPinned: c.isPinned,
    author: c.author,
    likeCount: c.likes.length,
    userLiked: uid ? c.likes.some((l) => l.userId === uid) : false,
    replies: c.replies.map((r) => ({
      id: r.id, content: r.content, createdAt: r.createdAt,
      author: r.author,
      likeCount: r.likes.length,
      userLiked: uid ? r.likes.some((l) => l.userId === uid) : false,
      replyToName: r.replyToName,
    })),
  }));

  type SuggestedVideo = {
    id: string; title: string; isPremium: boolean;
    duration: number | null; views: number | null; thumbnail: string | null;
    author: { id: string; name: string | null };
    _count: { likes: number };
  };

  // Suggested: other videos, excluding current
  let suggested: SuggestedVideo[] = [];
  try {
    suggested = await prisma.video.findMany({
      where: { id: { not: id } },
      take: 8,
      orderBy: { views: "desc" },
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { likes: true } },
      },
    }) as SuggestedVideo[];
  } catch { /* show empty */ }

  const authorColor = TIER_COLORS[video.author.tier] ?? "#888";
  const [bg, accent] = THUMB_COLORS[Math.abs(id.charCodeAt(0) - 97) % THUMB_COLORS.length];

  return (
    <div style={{ maxWidth: 1440, margin: "0 auto", padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 360px", gap: "2rem", alignItems: "start" }}>

      {/* ── LEFT: player + info ── */}
      <div>

        {/* Back */}
        <Link
          href="/feed"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            textDecoration: "none", color: "var(--text-muted)", fontSize: "0.8125rem",
            marginBottom: "1rem",
            padding: "0.3rem 0.625rem", borderRadius: 7,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
          }}
        >
          <ArrowLeft size={13} />
          Back to Feed
        </Link>

        {/* Player */}
        <div style={{
          width: "100%", aspectRatio: "16/9",
          borderRadius: 14, overflow: "hidden",
          background: `linear-gradient(135deg, ${bg} 0%, ${accent}22 100%)`,
          position: "relative",
          border: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isLocked ? (
            /* Locked overlay */
            <div style={{ textAlign: "center" }}>
              <Lock size={48} color={accent} style={{ margin: "0 auto 1rem" }} />
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Premium Content
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                Subscribe to watch this video
              </p>
              <Link href="/subscriptions" className="btn-primary" style={{ textDecoration: "none", padding: "0.625rem 1.5rem" }}>
                View Plans
              </Link>
            </div>
          ) : isGDriveEmbed(video.url) ? (
            /* Google Drive embed */
            <iframe
              src={video.url}
              allow="autoplay"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            /* Native player */
            <>
              <video
                src={video.url}
                controls
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
              />
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
                  border: "2px solid rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Play size={26} color="white" fill="white" style={{ marginLeft: 3 }} />
                </div>
              </div>
            </>
          )}

          {/* Duration badge */}
          {video.duration && (
            <div style={{
              position: "absolute", bottom: 12, right: 12,
              background: "rgba(0,0,0,0.75)", borderRadius: 5,
              padding: "0.2rem 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem",
              zIndex: 1,
            }}>
              <Clock size={11} color="#ccc" />
              <span style={{ fontSize: "0.75rem", color: "#eee", fontFamily: "var(--font-body)" }}>
                {formatDuration(video.duration)}
              </span>
            </div>
          )}

          {/* PRO badge */}
          {video.isPremium && (
            <div style={{
              position: "absolute", top: 12, left: 12, zIndex: 1,
              background: "linear-gradient(90deg,#f97316,#fbbf24)",
              borderRadius: 5, padding: "0.15rem 0.5rem",
            }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "white", fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
                PRO
              </span>
            </div>
          )}
        </div>

        {/* Title + stats */}
        <div style={{ marginTop: "1.25rem" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.375rem",
            letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.3,
            marginBottom: "0.75rem",
          }}>
            {video.title}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              <Eye size={14} /> {formatViews(video.views)} views
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              <Calendar size={14} /> {formatDate(video.createdAt)}
            </span>
            {video.category && (
              <span style={{
                fontSize: "0.75rem", fontWeight: 600, padding: "0.1875rem 0.625rem", borderRadius: 100,
                background: "rgba(249,115,22,0.1)", color: "var(--accent-orange)",
                border: "1px solid rgba(249,115,22,0.2)", fontFamily: "var(--font-display)",
              }}>
                {video.category.name}
              </span>
            )}
            <LikeButtons
              videoId={id}
              initialLikes={likesCount}
              initialDislikes={dislikesCount}
              initialUserReaction={userReaction}
              isOwner={isMe}
              isLoggedIn={!!session?.user}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: "1.25rem" }} />

          {/* Author row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <Link href={`/profile/${video.author.id}`} style={{ display: "flex", alignItems: "center", gap: "0.875rem", textDecoration: "none" }}>
              <div style={{
                width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                background: `${authorColor}22`, border: `2.5px solid ${authorColor}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem", color: authorColor }}>
                  {(video.author.name ?? "?")[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)", marginBottom: "0.125rem" }}>
                  {video.author.name}
                </p>
                <p style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  <Users size={12} />
                  {video.author._count.subscribers} subscribers · {video.author._count.videos} videos
                </p>
              </div>
            </Link>

            {!isMe && (
              session?.user ? (
                <SubscribeButton creatorId={video.author.id} initialFollowing={isFollowing} />
              ) : (
                <Link href="/auth/signin" className="btn-primary" style={{ textDecoration: "none", padding: "0.5rem 1.25rem", fontSize: "0.875rem" }}>
                  Sign in to subscribe
                </Link>
              )
            )}
          </div>

          {/* Description */}
          {video.description && (
            <div style={{
              marginTop: "1.25rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10, padding: "1rem 1.25rem",
            }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {video.description}
              </p>
            </div>
          )}

          {/* Comments */}
          <CommentsSection
            videoId={id}
            videoAuthorId={video.author.id}
            currentUserId={uid}
            initialComments={comments}
          />
        </div>
      </div>

      {/* ── RIGHT: suggested ── */}
      <aside style={{ position: "sticky", top: "calc(64px + 1.5rem)" }}>
        <p style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem",
          color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: "0.875rem",
        }}>
          Up Next
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {suggested.map((v, i) => {
            const [sbg, sacc] = THUMB_COLORS[i % THUMB_COLORS.length];
            const sLocked = v.isPremium && !session;
            return (
              <Link
                key={v.id}
                href={`/watch/${v.id}`}
                className="suggested-link"
                style={{
                  display: "flex", gap: "0.75rem", textDecoration: "none",
                  borderRadius: 10, padding: "0.5rem",
                  border: "1px solid transparent",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 120, height: 68, borderRadius: 7, flexShrink: 0,
                  background: `linear-gradient(135deg, ${sbg} 0%, ${sacc}33 100%)`,
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {sLocked ? (
                    <Lock size={16} color={sacc} />
                  ) : (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Play size={11} color="white" fill="white" style={{ marginLeft: 1 }} />
                    </div>
                  )}
                  {v.duration && (
                    <span style={{
                      position: "absolute", bottom: 4, right: 4,
                      background: "rgba(0,0,0,0.72)", borderRadius: 3,
                      padding: "0.0625rem 0.3rem", fontSize: "0.625rem", color: "#ddd",
                    }}>
                      {formatDuration(v.duration)}
                    </span>
                  )}
                  {v.isPremium && (
                    <span style={{
                      position: "absolute", top: 4, left: 4,
                      background: "linear-gradient(90deg,#f97316,#fbbf24)",
                      borderRadius: 3, padding: "0.0625rem 0.3rem",
                      fontSize: "0.5625rem", fontWeight: 700, color: "white", fontFamily: "var(--font-display)",
                    }}>
                      PRO
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem",
                    color: "var(--text-primary)", lineHeight: 1.35,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    marginBottom: "0.3rem",
                  }}>
                    {v.title}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {v.author?.name}
                  </p>
                  <p style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                    <Eye size={10} /> {formatViews(v.views ?? 0)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
