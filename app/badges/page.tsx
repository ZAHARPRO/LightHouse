import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const BADGE_CATALOG = [
  {
    type: "EARLY_ADOPTER",
    icon: "🚀",
    color: "#10b981",
    label: "Early Adopter",
    points: 200,
    description: "Joined LightHouse during the early access beta.",
    howToEarn: "This badge was awarded to users who signed up during the closed beta period.",
    rare: true,
  },
  {
    type: "FIRST_COMMENT",
    icon: "💬",
    color: "#6366f1",
    label: "First Comment",
    points: 10,
    description: "Left your first comment on a video.",
    howToEarn: "Jump into the conversation — post your first comment on any video.",
    rare: false,
  },
  {
    type: "WATCH_STREAK",
    icon: "🔥",
    color: "#f97316",
    label: "Watch Streak",
    points: 50,
    description: "Watched videos 7 days in a row.",
    howToEarn: "Stay consistent — watch at least one video every day for 7 consecutive days.",
    rare: false,
  },
  {
    type: "SUPER_FAN",
    icon: "⭐",
    color: "#fbbf24",
    label: "Super Fan",
    points: 100,
    description: "Liked 50 or more videos.",
    howToEarn: "Show your appreciation — like 50+ videos across LightHouse.",
    rare: false,
  },
  {
    type: "PREMIUM_MEMBER",
    icon: "👑",
    color: "#fbbf24",
    label: "Premium Member",
    points: 150,
    description: "Subscribed to a premium creator plan.",
    howToEarn: "Unlock premium content by subscribing to any paid plan on LightHouse.",
    rare: false,
  },
] as const;

export default async function BadgesPage() {
  const session = await auth();

  let earnedTypes = new Set<string>();
  let totalPoints = 0;

  if (session?.user?.id) {
    try {
      const rewards = await prisma.reward.findMany({
        where: { userId: session.user.id },
        select: { type: true, pointsValue: true },
      });
      earnedTypes = new Set(rewards.map((r) => r.type));
      totalPoints = rewards.reduce((s, r) => s + r.pointsValue, 0);
    } catch { /* DB unavailable */ }
  }

  const earnedCount = BADGE_CATALOG.filter((b) => earnedTypes.has(b.type)).length;

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
              ? `${earnedCount} of ${BADGE_CATALOG.length} earned · ${totalPoints} pts total`
              : `${BADGE_CATALOG.length} badges available — sign in to track your progress`}
          </p>
        </div>

        {session && earnedCount > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl border"
            style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}
          >
            <CheckCircle2 size={15} color="#10b981" />
            <span className="font-display font-bold text-sm" style={{ color: "#10b981" }}>
              {earnedCount}/{BADGE_CATALOG.length} collected
            </span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {BADGE_CATALOG.map((badge) => {
          const earned = earnedTypes.has(badge.type);
          return (
            <div
              key={badge.type}
              className="relative rounded-2xl border p-6 transition-[border-color,box-shadow] duration-200"
              style={{
                background: earned
                  ? `${badge.color}07`
                  : "var(--bg-card)",
                borderColor: earned
                  ? `${badge.color}35`
                  : "var(--border-subtle)",
                boxShadow: earned
                  ? `0 0 18px ${badge.color}12`
                  : "none",
              }}
            >
              {/* Earned checkmark */}
              {earned && (
                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: `${badge.color}20`, border: `1.5px solid ${badge.color}50` }}
                >
                  <CheckCircle2 size={12} style={{ color: badge.color }} />
                </div>
              )}

              {/* Rare badge indicator */}
              {badge.rare && (
                <div
                  className="absolute top-3 left-3 text-[0.6rem] font-display font-bold px-[0.4rem] py-[0.1rem] rounded-full"
                  style={{
                    background: `${badge.color}18`,
                    color: badge.color,
                    border: `1px solid ${badge.color}35`,
                  }}
                >
                  RARE
                </div>
              )}

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[1.75rem] mb-4"
                style={{
                  background: `${badge.color}15`,
                  border: `1.5px solid ${badge.color}30`,
                  opacity: earned ? 1 : 0.55,
                }}
              >
                {badge.icon}
              </div>

              {/* Info */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p
                    className="font-display font-bold text-[0.9375rem]"
                    style={{ color: earned ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    {badge.label}
                  </p>
                  <span
                    className="text-[0.6875rem] font-bold font-display"
                    style={{ color: badge.color }}
                  >
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
