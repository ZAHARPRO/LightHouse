import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Crown, Calendar, Users, Lock } from "lucide-react";

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

  // Check subscription for premium gate
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

  const locked   = post.isPremium && !isMe && !isSubscribed;
  const authorColor = TIER_COLORS[post.author.tier] ?? "#888";

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Back */}
      <Link
        href="/feed"
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          textDecoration: "none", color: "var(--text-muted)", fontSize: "0.8125rem",
          marginBottom: "1.75rem", padding: "0.3rem 0.625rem", borderRadius: 7,
          border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)",
        }}
      >
        <ArrowLeft size={13} /> Back to Feed
      </Link>

      {/* Header */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
        borderRadius: 16, padding: "2rem 2.5rem", marginBottom: "1.5rem",
      }}>
        {/* Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "0.6875rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: 100,
            background: "rgba(249,115,22,0.1)", color: "var(--accent-orange)",
            border: "1px solid rgba(249,115,22,0.2)", fontFamily: "var(--font-display)",
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            Post
          </span>
          {post.isPremium && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.3rem",
              fontSize: "0.6875rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: 100,
              background: "linear-gradient(90deg,rgba(249,115,22,0.15),rgba(251,191,36,0.15))",
              color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)",
              fontFamily: "var(--font-display)", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              <Crown size={10} /> Premium
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "auto" }}>
            <Calendar size={12} /> {formatDate(post.createdAt)}
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.75rem",
          letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.25,
          marginBottom: "1.5rem",
        }}>
          {post.title}
        </h1>

        {/* Author */}
        <Link
          href={`/profile/${post.author.id}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: `${authorColor}22`, border: `2px solid ${authorColor}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem", color: authorColor }}>
              {(post.author.name ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
              {post.author.name}
            </p>
            <p style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <Users size={11} /> {post.author._count.subscribers} subscribers
            </p>
          </div>
        </Link>
      </div>

      {/* Content */}
      {locked ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: 16, padding: "3rem 2rem", textAlign: "center",
        }}>
          <Lock size={40} color="var(--accent-orange)" style={{ margin: "0 auto 1rem" }} />
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            Premium Post
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Subscribe to {post.author.name} to read this post
          </p>
          <Link href="/subscriptions" className="btn-primary" style={{ textDecoration: "none", padding: "0.625rem 1.5rem" }}>
            View Plans
          </Link>
        </div>
      ) : (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: 16, padding: "2rem 2.5rem",
        }}>
          <div style={{
            color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.8,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {post.content}
          </div>
        </div>
      )}
    </div>
  );
}
