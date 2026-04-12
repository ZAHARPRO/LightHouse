import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TrendingUp, Star, Award, Crown } from "lucide-react";
import ProfileTabs from "@/components/ProfileTabs";

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      rewards: { orderBy: { earnedAt: "desc" } },
      videos: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { likes: true } } },
      },
      posts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) redirect("/auth/signin");

  const tierColor = TIER_COLORS[user.tier] ?? "#888";
  const level     = Math.floor((user.points ?? 0) / 100) + 1;
  const pctToNext = (((user.points ?? 0) % 100) / 100) * 100;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-12">

      {/* Profile card */}
      <div className="card lighthouse-beam flex gap-8 items-center flex-wrap p-10 mb-8">

        {/* Avatar */}
        <div
          style={{ background: `${tierColor}22`, border: `3px solid ${tierColor}44` }}
          className="w-[88px] h-[88px] rounded-full shrink-0 flex items-center justify-center"
        >
          <span style={{ color: tierColor }} className="font-[var(--font-display)] font-extrabold text-[2.25rem]">
            {(user.name ?? "U")[0].toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="font-[var(--font-display)] font-extrabold text-[1.75rem] tracking-[-0.02em]">
              {user.name}
            </h1>
            <span
              style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30` }}
              className="text-[0.75rem] font-bold py-[0.1875rem] px-[0.625rem] rounded-full font-[var(--font-display)] tracking-[0.05em] uppercase"
            >
              {user.tier}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm mb-4">{user.email}</p>

          {/* Level bar */}
          <div className="max-w-[320px]">
            <div className="flex justify-between mb-1.5">
              <span className="flex items-center gap-1.5 font-[var(--font-display)] font-bold text-sm text-[var(--accent-orange)]">
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
        </div>

        {/* Stats */}
        <div className="flex gap-6 flex-wrap">
          {[
            { icon: Star,  value: user.points,         label: "Points" },
            { icon: Award, value: user.rewards.length, label: "Badges" },
            { icon: Crown, value: level,               label: "Level"  },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Icon size={14} color="var(--accent-orange)"/>
                <span className="font-[var(--font-display)] font-extrabold text-2xl text-[var(--text-primary)]">{value}</span>
              </div>
              <span className="text-[var(--text-muted)] text-[0.8rem]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs: Videos | Community | Badges */}
      <ProfileTabs
        videos={user.videos}
        posts={user.posts}
        rewards={user.rewards}
      />

      {/* Upgrade CTA */}
      {user.tier === "FREE" && (
        <div className="mt-8 p-8 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),transparent)] border border-orange-500/15 rounded-xl flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-[var(--font-display)] font-bold text-lg mb-1">Upgrade your plan</h3>
            <p className="text-[var(--text-secondary)] text-sm">Earn more points, unlock exclusive content, and get a premium badge.</p>
          </div>
          <a href="/subscriptions" className="btn-primary no-underline whitespace-nowrap">View Plans</a>
        </div>
      )}
    </div>
  );
}