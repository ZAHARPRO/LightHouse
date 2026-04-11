import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Play, Eye, Clock, Lock, Users, Star, Crown,
  Award, TrendingUp, Zap, ArrowLeft,
} from "lucide-react";
import SubscribeButton from "@/components/SubscribeButton";

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

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { likes: true, comments: true } } },
        },
        _count: { select: { subscribers: true, videos: true } },
      },
    });
  } catch {
    notFound();
  }

  if (!user) notFound();

  const isMe = session?.user?.id === user.id;

  // Check if the logged-in user is already subscribed to this creator
  let isFollowing = false;
  if (session?.user?.id && !isMe) {
    try {
      const sub = await prisma.subscription.findUnique({
        where: {
          subscriberId_creatorId: {
            subscriberId: session.user.id,
            creatorId: id,
          },
        },
      });
      isFollowing = !!sub;
    } catch { /* ignore */ }
  }

  const tierColor = TIER_COLORS[user.tier] ?? "#888";
  const level = Math.floor((user.points ?? 0) / 100) + 1;
  const pctToNext = (((user.points ?? 0) % 100) / 100) * 100;
const totalViews = user.videos.reduce((sum: number, v) => sum + (v.views ?? 0), 0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Back */}
      <Link
        href="/feed"
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          textDecoration: "none", color: "var(--text-muted)", fontSize: "0.8125rem",
          marginBottom: "1.5rem",
          padding: "0.3rem 0.625rem", borderRadius: 7,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-elevated)",
        }}
      >
        <ArrowLeft size={13} />
        Back to Feed
      </Link>

      {/* Profile card */}
      <div
        className="card lighthouse-beam"
        style={{ padding: "2rem 2.5rem", marginBottom: "2rem", display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}
      >
        {/* Avatar */}
        <div style={{
          width: 88, height: 88, borderRadius: "50%",
          background: `${tierColor}22`, border: `3px solid ${tierColor}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.25rem", color: tierColor }}>
            {(user.name ?? "?")[0].toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
              {user.name}
            </h1>
            <span style={{
              fontSize: "0.75rem", fontWeight: 700, padding: "0.1875rem 0.625rem", borderRadius: 100,
              background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30`,
              fontFamily: "var(--font-display)", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {TIER_LABEL[user.tier] ?? user.tier}
            </span>
            {isMe ? (
              <Link
                href="/profile"
                style={{
                  fontSize: "0.75rem", padding: "0.1875rem 0.75rem", borderRadius: 100,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)", textDecoration: "none",
                  fontFamily: "var(--font-display)", fontWeight: 600,
                }}
              >
                Edit Profile
              </Link>
            ) : session?.user ? (
              <SubscribeButton creatorId={id} initialFollowing={isFollowing} />
            ) : (
              <Link
                href="/auth/signin"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.45rem 1.1rem", borderRadius: 8,
                  fontSize: "0.875rem", fontFamily: "var(--font-display)", fontWeight: 600,
                  background: "var(--accent-orange)", color: "white",
                  textDecoration: "none", border: "1px solid transparent",
                }}
              >
                Sign in to subscribe
              </Link>
            )}
          </div>

          {user.bio && (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem", maxWidth: 480 }}>
              {user.bio}
            </p>
          )}

          {/* Level bar */}
          <div style={{ maxWidth: 320 }}>
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
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap", alignSelf: "center" }}>
          {[
            { icon: Play,    value: user._count.videos,      label: "Videos" },
            { icon: Users,   value: user._count.subscribers, label: "Subscribers" },
            { icon: Eye,     value: formatViews(totalViews),  label: "Total Views" },
            { icon: Crown,   value: level,                   label: "Level" },
            { icon: Star,    value: user.points,             label: "Points" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.125rem" }}>
                <Icon size={13} color="var(--accent-orange)" />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.375rem", color: "var(--text-primary)" }}>
                  {value}
                </span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Videos */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <Play size={16} color="var(--accent-orange)" />
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem" }}>
          Videos by {user.name}
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
          {user.videos.map((video, i) => {
            const [bg, accent] = THUMB_COLORS[i % THUMB_COLORS.length];
            const locked = video.isPremium && !session;
            return (
              <Link key={video.id} href={`/watch/${video.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  borderRadius: 12, overflow: "hidden", background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  transition: "border-color 0.2s",
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
