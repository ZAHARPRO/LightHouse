import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TrendingUp, Star, Award, Crown, MessageCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import ProfileTabs from "@/components/ProfileTabs";
import BanBanner from "@/components/BanBanner";
import AvatarUpload from "@/components/AvatarUpload";
import UsernameEditor from "@/components/UsernameEditor";
import BioEditor from "@/components/BioEditor";
import BannerUpload from "@/components/BannerUpload";
import ProfilePlaylists from "@/components/ProfilePlaylists";

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      rewards: {
        orderBy: { earnedAt: "desc" },
        include: { customBadge: { select: { icon: true, label: true, color: true } } },
      },
      videos: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { likes: true } } },
      },
      posts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) redirect("/auth/signin");

  const uid = session.user.id;

  const [totalLikes, totalComments, totalSubscribers] = await Promise.all([
    prisma.like.count({ where: { video: { authorId: uid }, type: "LIKE" } }),
    prisma.comment.count({ where: { OR: [{ video: { authorId: uid } }, { post: { authorId: uid } }] } }),
    prisma.subscription.count({ where: { creatorId: uid } }),
  ]);

  const totalViews = user.videos.reduce((s, v) => s + (v.views ?? 0), 0);
  const avgViews   = user.videos.length > 0 ? Math.round(totalViews / user.videos.length) : 0;
  const tierColor  = TIER_COLORS[user.tier] ?? "#888";
  const level      = Math.floor((user.points ?? 0) / 100) + 1;
  const pctToNext  = (((user.points ?? 0) % 100) / 100) * 100;

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {/* Ban notice */}
      {user.isBanned && <BanBanner reason={user.banReason ?? null} isOwn />}

      {/* ── Profile card with banner ── */}
      <div className="card lighthouse-beam overflow-hidden mb-8">

        {/* Banner (editable) */}
        <BannerUpload currentBanner={user.banner ?? null} />

        {/* Info section */}
        <div className="flex gap-6 sm:gap-8 items-start flex-wrap px-4 sm:px-8 pt-6 pb-6 sm:pb-8">

          {/* Avatar */}
          <div className="shrink-0 -mt-10 relative z-10">
            <AvatarUpload
              currentImage={user.image ?? null}
              tierColor={tierColor}
              name={user.name ?? "U"}
            />
          </div>

          <div className="flex-1 min-w-0 w-full sm:w-auto">
            {/* Name row */}
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="font-display font-extrabold text-[1.35rem] sm:text-[1.75rem] tracking-[-0.02em]">
                {user.name}
              </h1>
              <span
                style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30` }}
                className="text-[0.75rem] font-bold py-[0.1875rem] px-[0.625rem] rounded-full font-display tracking-[0.05em] uppercase"
              >
                {user.tier}
              </span>
              <Link
                href="/dm"
                className="inline-flex items-center gap-1.5 no-underline text-[0.8125rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] py-[0.25rem] px-[0.75rem] rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-colors"
              >
                <MessageCircle size={13} />
                Messages
              </Link>
              <Link
                href={`/profile/${user.id}`}
                className="inline-flex items-center gap-1.5 no-underline text-[0.8125rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] py-[0.25rem] px-[0.75rem] rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-colors"
              >
                <ExternalLink size={13} />
                Public Profile
              </Link>
              <ProfilePlaylists
                initialFavSong={user.favoriteSong ? (() => { try { return JSON.parse(user.favoriteSong!); } catch { return null; } })() : null}
              />
            </div>

            <p className="text-[var(--text-muted)] text-sm mb-2">{user.email}</p>

            {/* Username (with tooltip) */}
            <div className="mb-3">
              <UsernameEditor initialUsername={user.username ?? null} />
            </div>

            {/* Bio */}
            <div className="mb-4">
              <BioEditor initialBio={user.bio ?? null} />
            </div>

            {/* Level bar */}
            <div className="max-w-full sm:max-w-[320px] mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="flex items-center gap-1.5 font-display font-bold text-sm text-[var(--accent-orange)]">
                  <TrendingUp size={14}/> Level {level}
                </span>
                <span className="text-[var(--text-muted)] text-[0.8125rem]">
                  {user.points} pts — {100 - ((user.points ?? 0) % 100)} to next
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div
                  style={{ width: `${pctToNext}%` }}
                  className="h-full bg-[linear-gradient(90deg,#f97316,#fbbf24)] rounded-full transition-[width] duration-1000 ease-in-out"
                />
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4 sm:gap-5 pt-3 border-t border-[var(--border-subtle)]">
              {[
                { icon: Star,  value: user.points,         label: "Points" },
                { icon: Award, value: user.rewards.length, label: "Badges" },
                { icon: Crown, value: level,               label: "Level"  },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={15} color="var(--accent-orange)" className="shrink-0" />
                  <div>
                    <p className="font-display font-extrabold text-[1.1rem] leading-none text-[var(--text-primary)]">{value}</p>
                    <p className="text-[0.7rem] text-[var(--text-muted)] mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Videos | Community | Badges | Stats */}
      <ProfileTabs
        videos={user.videos}
        posts={user.posts}
        rewards={user.rewards}
        badgeShowcase={(() => { try { return JSON.parse(user.badgeShowcase ?? "[]"); } catch { return []; } })()}
        stats={{
          totalViews,
          totalLikes,
          totalComments,
          totalSubscribers,
          avgViews,
          watchStreak: user.watchStreak,
          points: user.points ?? 0,
          level,
          videoCount: user.videos.length,
          postCount: user.posts.length,
        }}
      />

      {/* Upgrade CTA */}
      {user.tier === "FREE" && (
        <div className="mt-8 p-5 sm:p-8 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),transparent)] border border-orange-500/15 rounded-xl flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-display font-bold text-lg mb-1">Upgrade your plan</h3>
            <p className="text-[var(--text-secondary)] text-sm">Earn more points, unlock exclusive content, and get a premium badge.</p>
          </div>
          <a href="/subscriptions" className="btn-primary no-underline whitespace-nowrap">View Plans</a>
        </div>
      )}
    </div>
  );
}
