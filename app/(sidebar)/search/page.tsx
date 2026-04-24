import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Search, Play, Clock, Eye, Lock, FileText, Users } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

/* ── helpers ── */
const THUMB_COLORS = [
  ["#1a1a2e", "#f97316"], ["#0a1628", "#6366f1"],
  ["#1a0a0a", "#ef4444"], ["#0a1a0a", "#10b981"], ["#1a1a0a", "#fbbf24"],
];

const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#6366f1", FREE: "#666",
};
const TIER_LABELS: Record<string, string> = {
  ELITE: "Elite", PRO: "Pro", BASIC: "Basic", FREE: "Free",
};

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

function timeAgo(date: Date) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? "s" : ""} ago`;
  const y = Math.floor(mo / 12);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}

const TABS = [
  { key: "all",      label: "All" },
  { key: "videos",   label: "Videos" },
  { key: "creators", label: "Creators" },
  { key: "posts",    label: "Posts" },
];

/* ── page ── */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; tab?: string };
}) {
  const q   = (searchParams.q ?? "").trim();
  const tab = searchParams.tab ?? "all";

  if (!q) {
    return (
      <div className="max-w-[860px] mx-auto px-6 py-20 text-center">
        <Search size={40} className="mx-auto mb-4 text-[var(--text-muted)] opacity-40" />
        <p className="font-display font-bold text-xl text-[var(--text-primary)]">
          Start typing to search
        </p>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Search for videos, creators and posts
        </p>
      </div>
    );
  }

  /* ── types ── */
  type VideoResult = {
    id: string; title: string; description: string | null; thumbnail: string | null;
    views: number; isPremium: boolean; duration: number | null; createdAt: Date;
    author: { id: string; name: string | null; image: string | null; tier: string };
  };
  type CreatorResult = {
    id: string; name: string | null; username: string | null;
    image: string | null; tier: string; bio: string | null;
    _count: { subscribers: number; videos: number };
  };
  type PostResult = {
    id: string; title: string; content: string;
    isPremium: boolean; createdAt: Date;
    author: { id: string; name: string | null; image: string | null; tier: string };
  };

  /* ── DB queries in parallel ── */
  let videos: VideoResult[]   = [];
  let creators: CreatorResult[] = [];
  let posts: PostResult[]     = [];

  try {
    [videos, creators, posts] = await Promise.all([
      (tab === "all" || tab === "videos")
        ? prisma.video.findMany({
            where: {
              OR: [
                { title:       { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { views: "desc" },
            take: 20,
            select: {
              id: true, title: true, description: true, thumbnail: true,
              views: true, isPremium: true, duration: true, createdAt: true,
              author: { select: { id: true, name: true, image: true, tier: true } },
            },
          }) as Promise<VideoResult[]>
        : Promise.resolve([] as VideoResult[]),

      (tab === "all" || tab === "creators")
        ? prisma.user.findMany({
            where: {
              isBanned: false,
              OR: [
                { name:     { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
                { bio:      { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { subscribers: { _count: "desc" } },
            take: 8,
            select: {
              id: true, name: true, username: true, image: true,
              tier: true, bio: true,
              _count: { select: { subscribers: true, videos: true } },
            },
          }) as Promise<CreatorResult[]>
        : Promise.resolve([] as CreatorResult[]),

      (tab === "all" || tab === "posts")
        ? prisma.post.findMany({
            where: {
              OR: [
                { title:   { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true, title: true, content: true,
              isPremium: true, createdAt: true,
              author: { select: { id: true, name: true, image: true, tier: true } },
            },
          }) as Promise<PostResult[]>
        : Promise.resolve([] as PostResult[]),
    ]);
  } catch { /* DB unavailable — show empty */ }

  const total = videos.length + creators.length + posts.length;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <p className="text-[var(--text-muted)] text-sm mb-3">
          {total} result{total !== 1 ? "s" : ""} for{" "}
          <span className="font-semibold text-[var(--text-primary)]">&ldquo;{q}&rdquo;</span>
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/search?q=${encodeURIComponent(q)}&tab=${t.key}`}
              className={[
                "no-underline px-4 py-1.5 rounded-full text-[0.8125rem] font-display font-semibold transition-colors duration-150",
                tab === t.key
                  ? "bg-[var(--accent-orange)] text-white"
                  : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]",
              ].join(" ")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {total === 0 && (
        <div className="text-center py-20">
          <Search size={36} className="mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
          <p className="font-display font-bold text-lg text-[var(--text-primary)]">No results found</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">Try different keywords</p>
        </div>
      )}

      {/* ── Videos ── */}
      {videos.length > 0 && (
        <section className="mb-10">
          {tab === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[1rem] text-[var(--text-primary)] flex items-center gap-2">
                <Play size={15} className="text-[var(--accent-orange)]" /> Videos
              </h2>
              {videos.length >= 20 && (
                <Link href={`/search?q=${encodeURIComponent(q)}&tab=videos`}
                  className="text-[0.75rem] font-display font-semibold text-[var(--accent-orange)] no-underline hover:underline">
                  See all
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {videos.map((v, i) => {
              const [bg, accent] = THUMB_COLORS[i % THUMB_COLORS.length];
              return (
                <Link
                  key={v.id}
                  href={`/watch/${v.id}`}
                  className="flex gap-4 no-underline group rounded-xl p-3 transition-colors duration-150 hover:bg-[var(--bg-elevated)]"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ width: 240, height: 135, background: `linear-gradient(135deg,${bg} 0%,${accent}33 100%)` }}
                  >
                    {(v as { thumbnail?: string | null }).thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(v as { thumbnail?: string | null }).thumbnail!} alt=""
                        className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="relative z-[1] w-9 h-9 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-sm border border-white/15">
                      <Play size={14} color="white" fill="white" className="ml-0.5" />
                    </div>
                    {/* Duration */}
                    {v.duration && (
                      <div className="absolute bottom-1.5 right-1.5 z-[1] flex items-center gap-1 bg-black/75 rounded px-1.5 py-0.5">
                        <Clock size={9} color="#ccc" />
                        <span className="text-[0.625rem] text-[#ddd]">{fmtDuration(v.duration)}</span>
                      </div>
                    )}
                    {/* Premium */}
                    {v.isPremium && (
                      <div className="absolute top-1.5 left-1.5 z-[1] rounded px-1.5 py-0.5"
                        style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)" }}>
                        <span className="text-[0.5625rem] font-bold text-white tracking-wide">PRO</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-1">
                    <h3 className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] leading-[1.3] mb-1.5 group-hover:text-[var(--accent-orange)] transition-colors line-clamp-2">
                      {v.isPremium && <Lock size={12} className="inline mr-1 text-[var(--accent-orange)]" />}
                      {v.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <UserAvatar name={v.author.name ?? "?"} image={v.author.image} tier={v.author.tier} size="xs" />
                      <span className="text-[0.8rem] text-[var(--text-secondary)]">{v.author.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[0.75rem] text-[var(--text-muted)]">
                      <Eye size={11} /> {fmtViews(v.views)}
                      <span>·</span>
                      {timeAgo(v.createdAt)}
                    </div>
                    {v.description && (
                      <p className="mt-2 text-[0.775rem] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Creators ── */}
      {creators.length > 0 && (
        <section className="mb-10">
          {tab === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[1rem] text-[var(--text-primary)] flex items-center gap-2">
                <Users size={15} className="text-[var(--accent-orange)]" /> Creators
              </h2>
              {creators.length >= 8 && (
                <Link href={`/search?q=${encodeURIComponent(q)}&tab=creators`}
                  className="text-[0.75rem] font-display font-semibold text-[var(--accent-orange)] no-underline hover:underline">
                  See all
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {creators.map((c) => {
              const color = TIER_COLORS[c.tier] ?? "#666";
              return (
                <Link
                  key={c.id}
                  href={`/profile/${c.id}`}
                  className="flex items-center gap-4 no-underline p-3 rounded-xl transition-colors duration-150 hover:bg-[var(--bg-elevated)] group"
                >
                  <UserAvatar name={c.name ?? "?"} image={c.image} tier={c.tier} size="lg" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] group-hover:text-[var(--accent-orange)] transition-colors truncate">
                        {c.name}
                      </span>
                      <span
                        className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                      >
                        {TIER_LABELS[c.tier]}
                      </span>
                    </div>
                    {c.username && (
                      <p className="text-[0.775rem] text-[var(--text-muted)]">@{c.username}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[0.75rem] text-[var(--text-muted)]">
                      <span>{c._count.subscribers} subscriber{c._count.subscribers !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>{c._count.videos} video{c._count.videos !== 1 ? "s" : ""}</span>
                    </div>
                    {c.bio && (
                      <p className="mt-1 text-[0.75rem] text-[var(--text-muted)] line-clamp-1">{c.bio}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Posts ── */}
      {posts.length > 0 && (
        <section>
          {tab === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[1rem] text-[var(--text-primary)] flex items-center gap-2">
                <FileText size={15} className="text-[var(--accent-orange)]" /> Posts
              </h2>
              {posts.length >= 10 && (
                <Link href={`/search?q=${encodeURIComponent(q)}&tab=posts`}
                  className="text-[0.75rem] font-display font-semibold text-[var(--accent-orange)] no-underline hover:underline">
                  See all
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="block no-underline rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-5 py-4 transition-[border-color] duration-150 hover:border-orange-500/30 group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar name={p.author.name ?? "?"} image={p.author.image} tier={p.author.tier} size="xs" />
                  <span className="text-[0.775rem] font-display font-semibold text-[var(--text-secondary)]">
                    {p.author.name}
                  </span>
                  <span className="ml-auto text-[0.7rem] text-[var(--text-muted)]">{timeAgo(p.createdAt)}</span>
                </div>
                <h3 className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] leading-[1.3] mb-1.5 group-hover:text-[var(--accent-orange)] transition-colors">
                  {p.isPremium && <Lock size={12} className="inline mr-1 text-[var(--accent-orange)]" />}
                  {p.title}
                </h3>
                <p className="text-[0.8125rem] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                  {p.content}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
