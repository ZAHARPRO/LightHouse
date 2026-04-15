import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Play, Eye, Clock, Lock, Users, Star, Crown,
  Award, TrendingUp, Zap, ArrowLeft, AlignLeft,
} from "lucide-react";
import SubscribeButton from "@/components/SubscribeButton";
import ReportButton from "@/components/ReportButton";
import BanBanner from "@/components/BanBanner";
import MessageButton from "@/components/MessageButton";
import BlockButton from "@/components/BlockButton";
import UserAvatar from "@/components/UserAvatar";

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

const TIER_LABEL: Record<string, string> = {
  FREE: "Free", BASIC: "Basic", PRO: "Pro", ELITE: "Elite",
};

const THUMB_COLORS = [
  ["#1a1a2e", "#f97316"],
  ["#0a1628", "#6366f1"],
  ["#1a0a0a", "#ef4444"],
  ["#0a1a0a", "#10b981"],
  ["#1a1a0a", "#fbbf24"],
];

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  let user: Awaited<ReturnType<typeof prisma.user.findUnique>> & {
    videos: Array<{ id: string; title: string; views: number | null; isPremium: boolean; duration: number | null; _count: { likes: number; comments: number } }>;
    rewards: Array<{ id: string; type: string; description: string; customBadge: { icon: string; label: string; color: string } | null }>;
    _count: { subscribers: number; videos: number };
  } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { likes: true, comments: true } } },
        },
        rewards: {
          include: { customBadge: { select: { icon: true, label: true, color: true } } },
        },
        _count: { select: { subscribers: true, videos: true } },
      },
    });
  } catch {
    notFound();
  }

  if (!user) notFound();

  const isMe = session?.user?.id === user.id;

  let isFollowing = false;
  if (session?.user?.id && !isMe) {
    try {
      const sub = await prisma.subscription.findUnique({
        where: { subscriberId_creatorId: { subscriberId: session.user.id, creatorId: id } },
      });
      isFollowing = !!sub;
    } catch { /* ignore */ }
  }

  const tierColor  = TIER_COLORS[user.tier] ?? "#888";
  const level      = Math.floor((user.points ?? 0) / 100) + 1;
  const pctToNext  = (((user.points ?? 0) % 100) / 100) * 100;
  const totalViews = user.videos.reduce((sum: number, v: { views: number | null }) => sum + (v.views ?? 0), 0);
  const isViewerStaff = ["ADMIN", "OPERATOR", "STAFF"].includes(session?.user?.role ?? "");

  let isBlockedByMe = false;
  if (session?.user?.id && !isMe) {
    const block = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: id } },
    });
    isBlockedByMe = !!block;
  }

  /* Display name logic: username is the public identifier */
  const displayHandle = user.username ? `@${user.username}` : (user.name ?? "Unknown");
  const displayName   = user.username ? (user.name ?? null) : null;

  /* Badge showcase */
  const REWARD_META_PUB: Record<string, { icon: string; color: string; label: string }> = {
    WATCH_STREAK:   { icon: "🔥", color: "#f97316", label: "Watch Streak" },
    FIRST_COMMENT:  { icon: "💬", color: "#6366f1", label: "First Comment" },
    SUPER_FAN:      { icon: "⭐", color: "#fbbf24", label: "Super Fan" },
    EARLY_ADOPTER:  { icon: "🚀", color: "#10b981", label: "Early Adopter" },
    PREMIUM_MEMBER: { icon: "👑", color: "#fbbf24", label: "Premium Member" },
  };
  type PubReward = { id: string; type: string; description: string; customBadge: { icon: string; label: string; color: string } | null };
  function getPubMeta(r: PubReward) {
    if (r.customBadge) return { icon: r.customBadge.icon, color: r.customBadge.color, label: r.customBadge.label };
    return REWARD_META_PUB[r.type] ?? { icon: "🎖️", color: "#888", label: r.type };
  }
  const showcaseIds: string[] = (() => { try { return JSON.parse(user.badgeShowcase ?? "[]"); } catch { return []; } })();
  const showcaseBadges = showcaseIds
    .map((sid) => user.rewards.find((r) => r.id === sid))
    .filter(Boolean) as typeof user.rewards;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Ban banner */}
      {user.isBanned && <BanBanner reason={user.banReason} isOwn={isMe} />}

      {/* Back */}
      <Link
        href="/feed"
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          textDecoration: "none", color: "var(--text-muted)", fontSize: "0.8125rem",
          marginBottom: "1.5rem", padding: "0.3rem 0.625rem", borderRadius: 7,
          border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)",
        }}
      >
        <ArrowLeft size={13} />
        Back to Feed
      </Link>

      {/* ── Profile card ── */}
      <div
        className="card lighthouse-beam"
        style={{ marginBottom: "2rem", overflow: "hidden" }}
      >
        {/* Banner */}
        {user.banner ? (
          <div style={{ width: "100%", aspectRatio: "5/1", overflow: "hidden", minHeight: 72 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.banner}
              alt="Channel banner"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div style={{
            width: "100%", height: 80,
            background: "linear-gradient(135deg, #0d0d1a 0%, rgba(249,115,22,0.15) 60%, #14120a 100%)",
          }} />
        )}

        {/* Info */}
        <div style={{ padding: "0 2.5rem 2rem" }}>
          {/* Avatar row — negative margin to overlap banner */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginTop: -28, marginBottom: "1rem" }}>
            <UserAvatar
              name={user.name ?? "?"}
              image={user.image}
              tier={user.tier}
              size="xl"
            />

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", paddingBottom: 4 }}>
              {isMe ? (
                <Link
                  href="/profile"
                  style={{
                    fontSize: "0.75rem", padding: "0.375rem 0.875rem", borderRadius: 8,
                    background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)", textDecoration: "none",
                    fontFamily: "var(--font-display)", fontWeight: 600,
                  }}
                >
                  Edit Profile
                </Link>
              ) : session?.user ? (
                <>
                  <SubscribeButton creatorId={id} initialFollowing={isFollowing} />
                  <MessageButton targetId={id} />
                  <BlockButton targetId={id} targetName={user.name ?? "user"} initialBlocked={isBlockedByMe} />
                  {!isViewerStaff && (
                    <ReportButton targetId={id} targetName={user.name ?? "user"} />
                  )}
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    padding: "0.45rem 1.1rem", borderRadius: 8,
                    fontSize: "0.875rem", fontFamily: "var(--font-display)", fontWeight: 600,
                    background: "var(--accent-orange)", color: "white",
                    textDecoration: "none",
                  }}
                >
                  Sign in to subscribe
                </Link>
              )}
            </div>
          </div>

          {/* Username as main heading */}
          <div style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.625rem", letterSpacing: "-0.02em", margin: 0 }}>
              {displayHandle}
            </h1>
            <span style={{
              fontSize: "0.75rem", fontWeight: 700, padding: "0.1875rem 0.625rem", borderRadius: 100,
              background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30`,
              fontFamily: "var(--font-display)", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {TIER_LABEL[user.tier] ?? user.tier}
            </span>
          </div>

          {/* Display name (if username is set) */}
          {displayName && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              {displayName}
            </p>
          )}

          {/* Bio */}
          {user.bio && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "1rem", maxWidth: 500 }}>
              <AlignLeft size={13} style={{ color: "var(--text-muted)", marginTop: 3, flexShrink: 0 }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
                {user.bio}
              </p>
            </div>
          )}

          {/* Level bar */}
          <div style={{ maxWidth: 320, marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--accent-orange)" }}>
                <TrendingUp size={13} /> Level {level}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                {user.points} pts
              </span>
            </div>
            <div style={{ height: 5, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pctToNext}%`, background: "linear-gradient(90deg,#f97316,#fbbf24)", borderRadius: 3 }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
            {[
              { icon: Play,  value: user._count.videos,       label: "Videos" },
              { icon: Users, value: user._count.subscribers,  label: "Subscribers" },
              { icon: Eye,   value: formatViews(totalViews),  label: "Total Views" },
              { icon: Crown, value: level,                    label: "Level" },
              { icon: Star,  value: user.points,              label: "Points" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.125rem" }}>
                  <Icon size={13} color="var(--accent-orange)" />
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", color: "var(--text-primary)" }}>
                    {value}
                  </span>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Badge Showcase ── */}
      {showcaseBadges.length > 0 && (
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.875rem" }}>🏆</span>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem", margin: 0 }}>
              Featured Badges
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {/* Always render 3 slots */}
            {[0, 1, 2].map((idx) => {
              const badge = showcaseBadges[idx];
              if (!badge) {
                /* empty slot — subtle placeholder */
                return (
                  <div
                    key={idx}
                    style={{
                      borderRadius: 16,
                      border: "1.5px dashed var(--border-subtle)",
                      padding: "1.5rem 1rem",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem",
                      opacity: 0.35,
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "var(--bg-elevated)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.25rem",
                    }}>
                      🎖️
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
                      Empty
                    </span>
                  </div>
                );
              }
              const meta = getPubMeta(badge);
              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: 16,
                    border: `1.5px solid ${meta.color}35`,
                    background: `${meta.color}0a`,
                    padding: "1.5rem 1rem",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem",
                    transition: "box-shadow 0.2s",
                  }}
                >
                  <span style={{ fontSize: "2.25rem", lineHeight: 1 }}>{meta.icon}</span>
                  <span style={{
                    fontSize: "0.78rem", fontFamily: "var(--font-display)", fontWeight: 700,
                    color: meta.color, textAlign: "center", lineHeight: 1.3,
                  }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textAlign: "center" }}>
                    {badge.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Videos */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <Play size={16} color="var(--accent-orange)" />
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem" }}>
          Videos by {displayHandle}
        </h2>
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>({user._count.videos})</span>
      </div>

      {user.videos.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <Zap size={32} color="var(--text-muted)" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-secondary)" }}>No videos yet.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
          {(user.videos as Array<{ id: string; title: string; views: number | null; isPremium: boolean; duration: number | null; _count: { likes: number; comments: number } }>).map((video, i) => {
            const [bg, accent] = THUMB_COLORS[i % THUMB_COLORS.length];
            const locked = video.isPremium && !session;
            return (
              <Link key={video.id} href={`/watch/${video.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  borderRadius: 12, overflow: "hidden", background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)", transition: "border-color 0.2s",
                }}>
                  <div style={{
                    aspectRatio: "16/9",
                    background: `linear-gradient(135deg, ${bg} 0%, ${accent}33 100%)`,
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {locked ? (
                      <Lock size={22} color={accent} />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                        border: "1.5px solid rgba(255,255,255,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Play size={15} color="white" fill="white" style={{ marginLeft: 2 }} />
                      </div>
                    )}
                    {video.duration && (
                      <div style={{
                        position: "absolute", bottom: 7, right: 7,
                        background: "rgba(0,0,0,0.72)", borderRadius: 4,
                        padding: "0.125rem 0.375rem", display: "flex", alignItems: "center", gap: "0.2rem",
                      }}>
                        <Clock size={10} color="#aaa" />
                        <span style={{ fontSize: "0.6875rem", color: "#ddd" }}>
                          {formatDuration(video.duration)}
                        </span>
                      </div>
                    )}
                    {video.isPremium && (
                      <div style={{
                        position: "absolute", top: 7, left: 7,
                        background: "linear-gradient(90deg,#f97316,#fbbf24)",
                        borderRadius: 4, padding: "0.1rem 0.375rem",
                      }}>
                        <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "white", fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>PRO</span>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "0.875rem" }}>
                    <h3 style={{
                      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem",
                      color: "var(--text-primary)", lineHeight: 1.3, marginBottom: "0.5rem",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {video.title}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <Eye size={11} /> {formatViews(video.views ?? 0)}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <Award size={11} /> {video._count.likes}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
