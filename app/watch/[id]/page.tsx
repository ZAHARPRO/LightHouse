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

  if (!isMe) {
    await prisma.video.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  const likesCount    = await prisma.like.count({ where: { videoId: id, type: "LIKE" } });
  const dislikesCount = await prisma.like.count({ where: { videoId: id, type: "DISLIKE" } });
  let userReaction: "LIKE" | "DISLIKE" | null = null;
  if (session?.user?.id) {
    const row = await prisma.like.findUnique({
      where: { userId_videoId: { userId: session.user.id, videoId: id } },
    });
    userReaction = (row?.type as "LIKE" | "DISLIKE") ?? null;
  }

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
    <div className="max-w-[1440px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

      {/* ── LEFT: player + info ── */}
      <div>

        {/* Back */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-4 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
        >
          <ArrowLeft size={13} />
          Back to Feed
        </Link>

        {/* Player */}
        <div
          style={{ background: `linear-gradient(135deg, ${bg} 0%, ${accent}22 100%)` }}
          className="w-full aspect-video rounded-[14px] overflow-hidden border border-[var(--border-subtle)] relative flex items-center justify-center"
        >
          {isLocked ? (
            <div className="text-center">
              <Lock size={48} color={accent} className="mx-auto mb-4" />
              <p className="font-[var(--font-display)] font-bold text-lg text-[var(--text-primary)] mb-2">
                Premium Content
              </p>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                Subscribe to watch this video
              </p>
              <Link href="/subscriptions" className="btn-primary no-underline py-2.5 px-6">
                View Plans
              </Link>
            </div>
          ) : isGDriveEmbed(video.url) ? (
            <iframe
              src={video.url}
              allow="autoplay"
              className="absolute inset-0 w-full h-full border-none"
            />
          ) : (
            <>
              <video
                src={video.url}
                controls
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-[8px] border border-white/15 flex items-center justify-center">
                  <Play size={26} color="white" fill="white" className="ml-0.5" />
                </div>
              </div>
            </>
          )}

          {/* Duration badge */}
          {video.duration && (
            <div className="absolute bottom-3 right-3 bg-black/75 rounded-[5px] py-[0.2rem] px-2 flex items-center gap-1 z-10">
              <Clock size={11} color="#ccc" />
              <span className="text-[0.75rem] text-[#eee] font-[var(--font-body)]">
                {formatDuration(video.duration)}
              </span>
            </div>
          )}

          {/* PRO badge */}
          {video.isPremium && (
            <div className="absolute top-3 left-3 z-10 bg-[linear-gradient(90deg,#f97316,#fbbf24)] rounded-[5px] py-[0.15rem] px-2">
              <span className="text-[0.6875rem] font-bold text-white font-[var(--font-display)] tracking-[0.05em]">
                PRO
              </span>
            </div>
          )}
        </div>

        {/* Title + stats */}
        <div className="mt-5">
          <h1 className="font-[var(--font-display)] font-extrabold text-[1.375rem] tracking-[-0.02em] text-[var(--text-primary)] leading-tight mb-3">
            {video.title}
          </h1>

          <div className="flex items-center gap-5 flex-wrap mb-5">
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
              <Eye size={14} /> {formatViews(video.views)} views
            </span>
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
              <Calendar size={14} /> {formatDate(video.createdAt)}
            </span>
            {video.category && (
              <span className="text-[0.75rem] font-semibold py-[0.1875rem] px-[0.625rem] rounded-full bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/20 font-[var(--font-display)]">
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
          <div className="h-px bg-[var(--border-subtle)] mb-5" />

          {/* Author row */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Link href={`/profile/${video.author.id}`} className="flex items-center gap-3.5 no-underline">
              <div
                style={{ background: `${authorColor}22`, border: `2.5px solid ${authorColor}50` }}
                className="w-[46px] h-[46px] rounded-full shrink-0 flex items-center justify-center"
              >
                <span style={{ color: authorColor }} className="font-[var(--font-display)] font-extrabold text-lg">
                  {(video.author.name ?? "?")[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-[var(--font-display)] font-bold text-[0.9375rem] text-[var(--text-primary)] mb-0.5">
                  {video.author.name}
                </p>
                <p className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)]">
                  <Users size={12} />
                  {video.author._count.subscribers} subscribers · {video.author._count.videos} videos
                </p>
              </div>
            </Link>

            {!isMe && (
              session?.user ? (
                <SubscribeButton creatorId={video.author.id} initialFollowing={isFollowing} />
              ) : (
                <Link href="/auth/signin" className="btn-primary no-underline py-2 px-5 text-sm">
                  Sign in to subscribe
                </Link>
              )
            )}
          </div>

          {/* Description */}
          {video.description && (
            <div className="mt-5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[10px] py-4 px-5">
              <p className="text-[0.9rem] text-[var(--text-secondary)] leading-[1.65] whitespace-pre-wrap">
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
      <aside className="sticky top-[calc(64px+1.5rem)]">
        <p className="font-[var(--font-display)] font-bold text-[0.8125rem] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-3.5">
          Up Next
        </p>

        <div className="flex flex-col gap-3">
          {suggested.map((v, i) => {
            const [sbg, sacc] = THUMB_COLORS[i % THUMB_COLORS.length];
            const sLocked = v.isPremium && !session;
            return (
              <Link
                key={v.id}
                href={`/watch/${v.id}`}
                className="suggested-link flex gap-3 no-underline rounded-[10px] p-2 border border-transparent transition-[background,border-color] duration-150"
              >
                {/* Thumbnail */}
                <div
                  style={{ background: `linear-gradient(135deg, ${sbg} 0%, ${sacc}33 100%)` }}
                  className="w-[120px] h-[68px] rounded-[7px] shrink-0 relative flex items-center justify-center overflow-hidden"
                >
                  {sLocked ? (
                    <Lock size={16} color={sacc} />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-[4px] flex items-center justify-center">
                      <Play size={11} color="white" fill="white" className="ml-px" />
                    </div>
                  )}
                  {v.duration && (
                    <span className="absolute bottom-1 right-1 bg-black/[0.72] rounded-[3px] py-[0.0625rem] px-1.5 text-[0.625rem] text-[#ddd]">
                      {formatDuration(v.duration)}
                    </span>
                  )}
                  {v.isPremium && (
                    <span className="absolute top-1 left-1 bg-[linear-gradient(90deg,#f97316,#fbbf24)] rounded-[3px] py-[0.0625rem] px-1.5 text-[0.5625rem] font-bold text-white font-[var(--font-display)]">
                      PRO
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-[var(--font-display)] font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-tight line-clamp-2 mb-1">
                    {v.title}
                  </p>
                  <p className="text-[0.75rem] text-[var(--text-muted)]">
                    {v.author?.name}
                  </p>
                  <p className="flex items-center gap-1 text-[0.6875rem] text-[var(--text-muted)] mt-0.5">
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