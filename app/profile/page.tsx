import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { User, Award, Star, Zap, Crown, TrendingUp } from "lucide-react";

const REWARD_META: Record<string, { icon: string; color: string; label: string }> = {
  WATCH_STREAK:   { icon: "🔥", color: "#f97316", label: "Watch Streak" },
  FIRST_COMMENT:  { icon: "💬", color: "#6366f1", label: "First Comment" },
  SUPER_FAN:      { icon: "⭐", color: "#fbbf24", label: "Super Fan" },
  EARLY_ADOPTER:  { icon: "🚀", color: "#10b981", label: "Early Adopter" },
  PREMIUM_MEMBER: { icon: "👑", color: "#fbbf24", label: "Premium Member" },
};

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  let user;
  let rewards: {id:string;type:string;pointsValue:number;description:string;earnedAt:Date}[] = [];

  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { rewards: { orderBy: { earnedAt: "desc" } } },
    });
    rewards = user?.rewards ?? [];
  } catch {
    user = { name: session.user.name, email: session.user.email, points: 0, tier: "FREE", createdAt: new Date(), bio: null };
  }

  const tierColor = TIER_COLORS[user?.tier ?? "FREE"];
  const levelPts = user?.points ?? 0;
  const level = Math.floor(levelPts / 100) + 1;
  const pctToNext = ((levelPts % 100) / 100) * 100;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
      {/* Profile card */}
      <div
        className="card lighthouse-beam"
        style={{ padding: "2.5rem", marginBottom: "2rem", display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: `${tierColor}22`,
            border: `3px solid ${tierColor}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.25rem", color: tierColor }}>
            {(user?.name ?? session.user?.name ?? "U")[0].toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
              {user?.name ?? session.user?.name}
            </h1>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.1875rem 0.625rem", borderRadius: 100, background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30`, fontFamily: "var(--font-display)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {user?.tier ?? "FREE"}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
            {user?.email ?? session.user?.email}
          </p>

          {/* Level bar */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem", color: "var(--accent-orange)" }}>
                <TrendingUp size={14} /> Level {level}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                {levelPts} pts — {100 - (levelPts % 100)} to next level
              </span>
            </div>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pctToNext}%`, background: "linear-gradient(90deg, #f97316, #fbbf24)", borderRadius: 3, transition: "width 1s ease" }} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {[
            { icon: Star, value: levelPts, label: "Points" },
            { icon: Award, value: rewards.length, label: "Badges" },
            { icon: Crown, value: level, label: "Level" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.125rem" }}>
                <Icon size={14} color="var(--accent-orange)" />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", color: "var(--text-primary)" }}>
                  {value}
                </span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <Award size={18} color="var(--accent-orange)" />
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem" }}>
            Badges Earned
          </h2>
        </div>

        {rewards.length === 0 ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
            <Zap size={32} color="var(--text-muted)" style={{ margin: "0 auto 1rem" }} />
            <p style={{ color: "var(--text-secondary)" }}>No badges yet — watch videos, comment, and chat to earn rewards!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
            {rewards.map((reward) => {
              const meta = REWARD_META[reward.type] ?? { icon: "🎖️", color: "#888", label: reward.type };
              return (
                <div
                  key={reward.id}
                  className="card"
                  style={{
                    padding: "1.25rem 1.5rem",
                    display: "flex",
                    gap: "0.875rem",
                    alignItems: "center",
                    borderColor: `${meta.color}30`,
                  }}
                >
                  <div style={{ fontSize: "1.75rem", flexShrink: 0 }}>{meta.icon}</div>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.125rem" }}>
                      {meta.label}
                    </p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                      {reward.description}
                    </p>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: meta.color }}>
                      +{reward.pointsValue} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upgrade CTA */}
      {(user?.tier ?? "FREE") === "FREE" && (
        <div style={{ marginTop: "2rem", padding: "2rem", background: "linear-gradient(135deg, rgba(249,115,22,0.08), transparent)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.25rem" }}>
              Upgrade your plan
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Earn more points, unlock exclusive content, and get a premium badge.
            </p>
          </div>
          <a href="/subscriptions" className="btn-primary" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
            View Plans
          </a>
        </div>
      )}
    </div>
  );
}
