import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Lock, ArrowRight } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { getTranslations } from "next-intl/server";

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
  { id: "mp1", title: "New level dropping next week!", content: "Get ready for the toughest boss yet — we've been cooking this one for months. Stay tuned for the full reveal on Friday.", isPremium: false, createdAt: new Date(Date.now() - 3_600_000), author: { id: "a1", name: "Shovel Knight", image: null, tier: "ELITE" } },
  { id: "mp2", title: "Behind the scenes of Tokyo Night Walk", content: "Shot entirely on a single mirrorless camera at 4AM. Here's what went wrong and what saved the footage in the end.", isPremium: true, createdAt: new Date(Date.now() - 86_400_000), author: { id: "a2", name: "Marco Visuals", image: null, tier: "PRO" } },
  { id: "mp3", title: "Prisma ORM tips I wish I knew earlier", content: "After two years of production usage, here are the patterns that actually matter and the ones that will get you into trouble.", isPremium: false, createdAt: new Date(Date.now() - 172_800_000), author: { id: "a3", name: "DB Wizard", image: null, tier: "BASIC" } },
  { id: "mp4", title: "Deep Focus playlist — August edition", content: "New 4-hour mix is up. Handpicked for late-night coding sessions and study blocks.", isPremium: false, createdAt: new Date(Date.now() - 259_200_000), author: { id: "a4", name: "LoFi Lab", image: null, tier: "PRO" } },
];

type Post = {
  id: string;
  title: string;
  content: string;
  isPremium: boolean;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

export default async function CommunityPage() {
  const t = await getTranslations("community");
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
            author: { select: { id: true, name: true, image: true, tier: true } },
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
            {t("title")}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {isLoggedIn
              ? subCount > 0
                ? t(subCount === 1 ? "followingCount" : "followingCountPlural", { count: subCount })
                : t("emptyFollowing")
              : t("notSignedIn")}
          </p>
        </div>

        {!isLoggedIn && (
          <Link href="/auth/signin" className="btn-primary no-underline text-sm py-2 px-5">
            {t("signIn")}
          </Link>
        )}
        {isLoggedIn && subCount === 0 && (
          <Link
            href="/feed"
            className="flex items-center gap-1.5 no-underline text-sm font-display font-semibold text-[var(--accent-orange)] py-2 px-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.06] hover:bg-orange-500/[0.1] transition-colors duration-150"
          >
            <Users size={14} /> {t("discoverCreators")} <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-8 py-16 text-center">
          <Users size={36} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="font-display font-bold text-[var(--text-primary)] text-lg mb-2">{t("noPostsYet")}</p>
          <p className="text-[var(--text-muted)] text-[0.9rem]">
            {t("noPostsMessage")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => {
            return (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block no-underline rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-7 py-5 transition-[border-color] duration-150 hover:border-orange-500/30"
              >
                {/* Author row */}
                <div className="flex items-center gap-[0.625rem] mb-3">
                  <UserAvatar name={post.author.name ?? "?"} image={post.author.image} tier={post.author.tier} size="md" />
                  <span className="font-display font-semibold text-[0.875rem] text-[var(--text-primary)]">
                    {post.author.name}
                  </span>
                  {post.isPremium && (
                    <span className="text-[0.6875rem] font-bold px-[0.4rem] py-[0.1rem] rounded-full bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/25 font-display">
                      {t("premium")}
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
            {t("previewNotice")}{" "}
            <Link href="/auth/signin" className="text-[var(--accent-orange)] font-semibold no-underline hover:underline">
              {t("signInLink")}
            </Link>{" "}
            {t("toSeeReal")}
          </p>
        </div>
      )}
    </div>
  );
}
