import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Crown, Calendar, Users, Lock, Pencil, Clock } from "lucide-react";
import PostCommentsSection from "@/components/PostCommentsSection";

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true, name: true, tier: true, bio: true,
          _count: { select: { subscribers: true, posts: true } },
        },
      },
    },
  }).catch(() => null);

  if (!post) notFound();

  const isMe     = session?.user?.id === post.author.id;
  const isLocked = post.isPremium && !session?.user;

  let isSubscribed = false;
  if (post.isPremium && session?.user?.id && !isMe) {
    const sub = await prisma.subscription.findUnique({
      where: {
        subscriberId_creatorId: {
          subscriberId: session.user.id,
          creatorId: post.author.id,
        },
      },
    }).catch(() => null);
    isSubscribed = !!sub;
  }

  const locked      = post.isPremium && !isMe && !isSubscribed;
  const authorColor = TIER_COLORS[post.author.tier] ?? "#888";
  const wasEdited   = post.updatedAt.getTime() - post.createdAt.getTime() > 5000;
  const uid = session?.user?.id ?? null;

  const rawComments = await prisma.comment.findMany({
    where: { postId: id, parentId: null },
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

  const comments = rawComments.map((c) => ({
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

  return (
    <div className="max-w-[740px] mx-auto px-6 py-10">

      {/* Back */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-7 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeft size={13} /> Back to Feed
      </Link>

      {/* Header */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl px-10 py-8 mb-6">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold py-[0.2rem] px-[0.6rem] rounded-full bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/20 font-display tracking-[0.05em] uppercase">
            Post
          </span>
          {post.isPremium && (
            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold py-[0.2rem] px-[0.6rem] rounded-full bg-[linear-gradient(90deg,rgba(249,115,22,0.15),rgba(251,191,36,0.15))] text-[#fbbf24] border border-[rgba(251,191,36,0.25)] font-display tracking-[0.05em] uppercase">
              <Crown size={10} /> Premium
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="flex items-center gap-1 text-[0.8rem] text-[var(--text-muted)]">
              <Calendar size={12} /> {formatDate(post.createdAt)}
            </span>
            {isMe && (
              <Link
                href={`/post/${id}/edit`}
                className="inline-flex items-center gap-1 no-underline text-[0.75rem] font-semibold py-[0.2rem] px-[0.6rem] rounded-[6px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors duration-150"
              >
                <Pencil size={11} /> Edit
              </Link>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display font-extrabold text-[1.75rem] tracking-[-0.02em] text-[var(--text-primary)] leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author */}
        <Link
          href={`/profile/${post.author.id}`}
          className="inline-flex items-center gap-3 no-underline"
        >
          <div
            style={{ background: `${authorColor}22`, border: `2px solid ${authorColor}50` }}
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
          >
            <span style={{ color: authorColor }} className="font-display font-extrabold text-base">
              {(post.author.name ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-display font-bold text-[0.9rem] text-[var(--text-primary)]">
              {post.author.name}
            </p>
            <p className="flex items-center gap-1 text-[0.75rem] text-[var(--text-muted)]">
              <Users size={11} /> {post.author._count.subscribers} subscribers
            </p>
          </div>
        </Link>
      </div>

      {/* Content */}
      {locked ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl px-8 py-12 text-center">
          <Lock size={40} color="var(--accent-orange)" className="mx-auto mb-4" />
          <p className="font-display font-bold text-lg text-[var(--text-primary)] mb-2">
            Premium Post
          </p>
          <p className="text-[var(--text-secondary)] text-[0.9rem] mb-6">
            Subscribe to {post.author.name} to read this post
          </p>
          <Link href="/subscriptions" className="btn-primary no-underline py-2.5 px-6">
            View Plans
          </Link>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl px-10 py-8">
          <div className="text-[var(--text-secondary)] text-base leading-[1.8] whitespace-pre-wrap break-words">
            {post.content}
          </div>
          {wasEdited && (
            <p className="flex items-center gap-1 mt-5 text-[0.75rem] text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-4">
              <Clock size={11} />
              Edited{" "}
              {new Date(post.updatedAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              })}{" "}
              at{" "}
              {new Date(post.updatedAt).toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      <PostCommentsSection
        postId={id}
        postAuthorId={post.author.id}
        currentUserId={uid}
        initialComments={comments}
      />
    </div>
  );
}