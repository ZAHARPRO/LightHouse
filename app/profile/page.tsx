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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>

      {/* Profile card */}
      <div className="card lighthouse-beam" style={{ padding:"2.5rem", marginBottom:"2rem", display:"flex", gap:"2rem", alignItems:"center", flexWrap:"wrap" }}>

        {/* Avatar */}
        <div style={{
          width:88, height:88, borderRadius:"50%", flexShrink:0,
          background:`${tierColor}22`, border:`3px solid ${tierColor}44`,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <span style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:"2.25rem", color:tierColor }}>
            {(user.name ?? "U")[0].toUpperCase()}
          </span>
        </div>

        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap", marginBottom:"0.25rem" }}>
            <h1 style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:"1.75rem", letterSpacing:"-0.02em" }}>
              {user.name}
            </h1>
            <span style={{ fontSize:"0.75rem", fontWeight:700, padding:"0.1875rem 0.625rem", borderRadius:100, background:`${tierColor}18`, color:tierColor, border:`1px solid ${tierColor}30`, fontFamily:"var(--font-display)", letterSpacing:"0.05em", textTransform:"uppercase" }}>
              {user.tier}
            </span>
          </div>
          <p style={{ color:"var(--text-muted)", fontSize:"0.875rem", marginBottom:"1rem" }}>{user.email}</p>

          {/* Level bar */}
          <div style={{ maxWidth:320 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.375rem" }}>
              <span style={{ display:"flex", alignItems:"center", gap:"0.375rem", fontFamily:"var(--font-display)", fontWeight:700, fontSize:"0.875rem", color:"var(--accent-orange)" }}>
                <TrendingUp size={14}/> Level {level}
              </span>
              <span style={{ color:"var(--text-muted)", fontSize:"0.8125rem" }}>
                {user.points} pts — {100 - ((user.points ?? 0) % 100)} to next
              </span>
            </div>
            <div style={{ height:6, background:"var(--bg-elevated)", borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pctToNext}%`, background:"linear-gradient(90deg,#f97316,#fbbf24)", borderRadius:3, transition:"width 1s ease" }}/>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
          {[
            { icon: Star,  value: user.points,         label: "Points" },
            { icon: Award, value: user.rewards.length, label: "Badges" },
            { icon: Crown, value: level,               label: "Level" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.25rem", marginBottom:"0.125rem" }}>
                <Icon size={14} color="var(--accent-orange)"/>
                <span style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:"1.5rem", color:"var(--text-primary)" }}>{value}</span>
              </div>
              <span style={{ color:"var(--text-muted)", fontSize:"0.8rem" }}>{label}</span>
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
        <div style={{ marginTop:"2rem", padding:"2rem", background:"linear-gradient(135deg,rgba(249,115,22,0.08),transparent)", border:"1px solid rgba(249,115,22,0.15)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem" }}>
          <div>
            <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", marginBottom:"0.25rem" }}>Upgrade your plan</h3>
            <p style={{ color:"var(--text-secondary)", fontSize:"0.875rem" }}>Earn more points, unlock exclusive content, and get a premium badge.</p>
          </div>
          <a href="/subscriptions" className="btn-primary" style={{ textDecoration:"none", whiteSpace:"nowrap" }}>View Plans</a>
        </div>
      )}
    </div>
  );
}
