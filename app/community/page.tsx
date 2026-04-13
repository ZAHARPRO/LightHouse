import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Lock, ArrowRight } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#6366f1", FREE: "#666",
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MOCK_POSTS = [
  { id: "mp1", title: "New level dropping next week!", content: "Get ready for the toughest boss yet — we've been cooking this one for months. Stay tuned for the full reveal on Friday.", isPremium: false, createdAt: new Date(Date.now() - 3_600_000), author: { id: "a1", name: "Shovel Knight", tier: "ELITE" } },
  { id: "mp2", title: "Behind the scenes of Tokyo Night Walk", content: "Shot entirely on a single mirrorless camera at 4AM. Here's what went wrong and what saved the footage in the end.", isPremium: true, createdAt: new Date(Date.now() - 86_400_000), author: { id: "a2", name: "Marco Visuals", tier: "PRO" } },
  { id: "mp3", title: "Prisma ORM tips I wish I knew earlier", content: "After two years of production usage, here are the patterns that actually matter and the ones that will get you into trouble.", isPremium: false, createdAt: new Date(Date.now() - 172_800_000), author: { id: "a3", name: "DB Wizard", tier: "BASIC" } },
  { id: "mp4", title: "Deep Focus playlist — August edition", content: "New 4-hour mix is up. Handpicked for late-night coding sessions and study blocks.", isPremium: false, createdAt: new Date(Date.now() - 259_200_000), author: { id: "a4", name: "LoFi Lab", tier: "PRO" } },
];

type Post = {
  id: string;
  title: string;
  content: string;
  isPremium: boolean;
  createdAt: Date;
  author: { id: string; name: string | null; tier: string };
};

export default async function CommunityPage() {
  const session = await auth();

  let posts: Post[] = [];
  let isLoggedIn = !!session;
  let subCount = 0;

  if (session?.user?.id) {
    try {
      // Get IDs of subscribed creators
      const subs = await prisma.subscription.findMany({
        where: {
          subscriberId: session.user.id,
          status: "ACTIVE",
          NOT: { creatorId: session.user.id },
        },
        select: { creatorId: true },
      });

      subCount = subs.length;
      const creatorIds = subs.map((s) => s.creatorId);

      if (creatorIds.length > 0) {
        posts = (await prisma.post.findMany({
          where: { authorId: { in: creatorIds } },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true, title: true, content: true, isPremium: true, createdAt: true,
            author: { select: { id: true, name: true, tier: true } },
          },
        })) as Post[];
      }
    } catch { /* DB unavailable — show empty */ }
  } else {
    // Show demo posts for logged-out users
    posts = MOCK_POSTS;
  }

  return (
    <div className="max-w-[740px] mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-[1.75rem] tracking-[-0.02em] text-[var(--text-primary)]">
            Community
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {isLoggedIn
              ? subCount > 0
                ? `Posts from ${subCount} creator${subCount === 1 ? "" : "s"} you follow`
                : "Subscribe to creators to see their posts here"
              : "Sign in to see posts from creators you follow"}
          </p>
        </div>

        {!isLoggedIn && (
          <Link href="/auth/signin" className="btn-primary no-underline text-sm py-2 px-5">
            Sign In
          </Link>
        )}
        {isLoggedIn && subCount === 0 && (
          <Link
            href="/feed"
            className="flex items-center gap-1.5 no-underline text-sm font-display font-semibold text-[var(--accent-orange)] py-2 px-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.06] hover:bg-orange-500/[0.1] transition-colors duration-150"
          >
            <Users size={14} /> Discover creators <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-8 py-16 text-center">
          <Users size={36} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="font-display font-bold text-[var(--text-primary)] text-lg mb-2">No posts yet</p>
          <p className="text-[var(--text-muted)] text-[0.9rem]">
            The creators you follow haven&apos;t posted anything yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => {
            const color = TIER_COLORS[post.author.tier] ?? "#666";
            return (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block no-underline rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-7 py-5 transition-[border-color] duration-150 hover:border-orange-500/30"
              >
                {/* Author row */}
                <div className="flex items-center gap-[0.625rem] mb-3">
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-[0.75rem]"
                    style={{ background: `${color}22`, border: `1.5px solid ${color}50`, color }}
                  >
                    {(post.author.name ?? "?")[0].toUpperCase()}
                  </div>
                  <span className="font-display font-semibold text-[0.875rem] text-[var(--text-primary)]">
                    {post.author.name}
                  </span>
                  {post.isPremium && (
                    <span className="text-[0.6875rem] font-bold px-[0.4rem] py-[0.1rem] rounded-full bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/25 font-display">
                      Premium
                    </span>
                  )}
                  <span className="ml-auto text-xs text-[var(--text-muted)]">
                    {timeAgo(post.createdAt)}
                  </span>
                </div>

                {/* Title */}
                <h2 className="font-display font-bold text-[1rem] text-[var(--text-primary)] leading-[1.3] mb-2">
                  {post.isPremium && <Lock size={13} className="inline mr-1 text-[var(--accent-orange)]" />}
                  {post.title}
                </h2>

                {/* Preview */}
                <p
                  className="text-[0.875rem] text-[var(--text-secondary)] leading-relaxed overflow-hidden"
                  style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
                >
                  {post.content}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Not logged in — demo notice */}
      {!isLoggedIn && (
        <div className="mt-6 rounded-xl bg-orange-500/[0.06] border border-orange-500/20 px-6 py-4 text-center">
          <p className="text-[0.875rem] text-[var(--text-secondary)] font-display">
            These are preview posts.{" "}
            <Link href="/auth/signin" className="text-[var(--accent-orange)] font-semibold no-underline hover:underline">
              Sign in
            </Link>{" "}
            to see posts from creators you actually follow.
          </p>
        </div>
      )}
    </div>
  );
}
