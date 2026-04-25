import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { BADGE_DEFS } from "@/lib/badges";

const CATEGORY_LABELS: Record<string, string> = {
  special:   "⭐ Special",
  community: "💬 Community",
  activity:  "🔥 Activity",
  games:     "🎮 Games",
};

const CATEGORY_ORDER = ["special", "community", "activity", "games"];

export default async function BadgesPage() {
  const session = await auth();

  let earnedTypes = new Set<string>();
  let earnedCustomIds = new Set<string>();
  let totalPoints = 0;
  let customBadges: { id: string; icon: string; label: string; color: string; points: number; description: string }[] = [];

  if (session?.user?.id) {
    try {
      const [rewards, allCustom] = await Promise.all([
        prisma.reward.findMany({
          where: { userId: session.user.id },
          select: { type: true, pointsValue: true, customBadgeId: true },
        }),
        prisma.customBadge.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, icon: true, label: true, color: true, points: true, description: true },
        }),
      ]);
      earnedTypes    = new Set(rewards.map((r) => r.type));
      earnedCustomIds = new Set(rewards.filter((r) => r.customBadgeId).map((r) => r.customBadgeId as string));
      totalPoints    = rewards.reduce((s, r) => s + r.pointsValue, 0);
      customBadges   = allCustom;
    } catch { /* DB unavailable */ }
  } else {
    try {
      customBadges = await prisma.customBadge.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, icon: true, label: true, color: true, points: true, description: true },
      });
    } catch { /* DB unavailable */ }
  }

  const allBuiltin = Object.entries(BADGE_DEFS).map(([type, def]) => ({ type, ...def }));
  const earnedCount = allBuiltin.filter((b) => earnedTypes.has(b.type)).length;
  const totalBadges = allBuiltin.length + customBadges.length;

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    badges: allBuiltin.filter((b) => b.category === cat),
  })).filter((g) => g.badges.length > 0);

  return (
    <div className="max-w-[860px] mx-auto px-6 py-10">

      {/* Back */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-8 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeft size={13} /> Back to Profile
      </Link>

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-[1.75rem] tracking-[-0.02em] text-[var(--text-primary)]">
            Badge Catalog
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {session
              ? `${earnedCount} of ${totalBadges} earned · ${totalPoints} pts total`
              : `${totalBadges} badges available — sign in to track your progress`}
          </p>
        </div>

        {session && earnedCount > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl border"
            style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}
          >
            <CheckCircle2 size={15} color="#10b981" />
            <span className="font-display font-bold text-sm" style={{ color: "#10b981" }}>
              {earnedCount}/{totalBadges} collected
            </span>
          </div>
        )}
      </div>

      {/* Built-in badges grouped by category */}
      {grouped.map(({ cat, label, badges }) => (
        <div key={cat} className="mb-10">
          <h2 className="font-display font-bold text-[0.85rem] text-[var(--text-muted)] uppercase tracking-wider mb-4">
            {label}
          </h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {badges.map((badge) => {
              const earned = earnedTypes.has(badge.type);
              return (
                <div
                  key={badge.type}
                  className="relative rounded-2xl border p-6 transition-[border-color,box-shadow] duration-200"
                  style={{
                    background: earned ? `${badge.color}07` : "var(--bg-card)",
                    borderColor: earned ? `${badge.color}35` : "var(--border-subtle)",
                    boxShadow: earned ? `0 0 18px ${badge.color}12` : "none",
                  }}
                >
                  {earned && (
                    <div
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: `${badge.color}20`, border: `1.5px solid ${badge.color}50` }}
                    >
                      <CheckCircle2 size={12} style={{ color: badge.color }} />
                    </div>
                  )}

                  {badge.rare && (
                    <div
                      className="absolute top-3 left-3 text-[0.6rem] font-display font-bold px-[0.4rem] py-[0.1rem] rounded-full"
                      style={{ background: `${badge.color}18`, color: badge.color, border: `1px solid ${badge.color}35` }}
                    >
                      RARE
                    </div>
                  )}

                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-[1.75rem] mb-4"
                    style={{ background: `${badge.color}15`, border: `1.5px solid ${badge.color}30`, opacity: earned ? 1 : 0.55 }}
                  >
                    {badge.icon}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-display font-bold text-[0.9375rem]" style={{ color: earned ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {badge.label}
                      </p>
                      <span className="text-[0.6875rem] font-bold font-display" style={{ color: badge.color }}>
                        +{badge.points} pts
                      </span>
                    </div>

                    <p className="text-[0.8125rem] text-[var(--text-secondary)] leading-[1.5] mb-3">
                      {badge.description}
                    </p>

                    <div
                      className="rounded-lg px-3 py-2 text-[0.75rem] text-[var(--text-muted)] leading-[1.5]"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                    >
                      <span className="font-display font-semibold text-[var(--text-secondary)]">How to earn: </span>
                      {badge.howToEarn}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Admin / Custom badges */}
      {customBadges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={15} className="text-[#818cf8]" />
            <h2 className="font-display font-bold text-[1rem] text-[var(--text-primary)]">Admin Badges</h2>
            <span className="text-[0.7rem] text-[var(--text-muted)] font-display font-semibold uppercase tracking-[0.06em]">· Awarded by the team</span>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {customBadges.map((badge) => {
              const earned = earnedCustomIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className="relative rounded-2xl border p-6 transition-[border-color,box-shadow] duration-200"
                  style={{
                    background: earned ? `${badge.color}07` : "var(--bg-card)",
                    borderColor: earned ? `${badge.color}35` : "var(--border-subtle)",
                    boxShadow: earned ? `0 0 18px ${badge.color}12` : "none",
                  }}
                >
                  {earned && (
                    <div
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: `${badge.color}20`, border: `1.5px solid ${badge.color}50` }}
                    >
                      <CheckCircle2 size={12} style={{ color: badge.color }} />
                    </div>
                  )}

                  <div
                    className="absolute top-3 left-3 flex items-center gap-1 text-[0.6rem] font-display font-bold px-[0.4rem] py-[0.1rem] rounded-full"
                    style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)" }}
                  >
                    <ShieldCheck size={9} /> ADMIN
                  </div>

                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-[1.75rem] mb-4 mt-2"
                    style={{ background: `${badge.color}15`, border: `1.5px solid ${badge.color}30`, opacity: earned ? 1 : 0.55 }}
                  >
                    {badge.icon}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-display font-bold text-[0.9375rem]" style={{ color: earned ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {badge.label}
                      </p>
                      <span className="text-[0.6875rem] font-bold font-display" style={{ color: badge.color }}>
                        +{badge.points} pts
                      </span>
                    </div>

                    <p className="text-[0.8125rem] text-[var(--text-secondary)] leading-[1.5] mb-3">
                      {badge.description}
                    </p>

                    <div
                      className="rounded-lg px-3 py-2 text-[0.75rem] text-[var(--text-muted)] leading-[1.5]"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                    >
                      <span className="font-display font-semibold text-[var(--text-secondary)]">How to earn: </span>
                      Awarded manually by the LightHouse admin team.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sign-in CTA */}
      {!session && (
        <div className="mt-8 rounded-2xl bg-orange-500/[0.06] border border-orange-500/20 px-6 py-5 text-center">
          <p className="text-[var(--text-secondary)] text-[0.9rem] font-display mb-3">
            Sign in to track your progress and see which badges you&apos;ve already earned.
          </p>
          <Link href="/auth/signin" className="btn-primary no-underline py-2 px-6 text-sm">
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
