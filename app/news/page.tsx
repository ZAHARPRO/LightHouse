import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Newspaper, MessageSquare, ThumbsUp, Calendar, ArrowLeft } from "lucide-react";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export default async function NewsListPage() {
  const posts = await prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true, role: true } },
      _count: { select: { comments: true, likes: true } },
    },
  });

  return (
    <div className="max-w-[720px] mx-auto px-6 py-10">
      <Link
        href="/dm"
        className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-6 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeft size={13} /> Back to Messages
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-orange)]/15 flex items-center justify-center">
          <Newspaper size={18} className="text-[var(--accent-orange)]" />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] leading-none">
            Site News
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Official announcements from the team</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-12 text-center">
          <Newspaper size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-secondary)] text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post, i) => (
            <Link
              key={post.id}
              href={`/news/${post.id}`}
              className="no-underline group"
            >
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 hover:border-orange-500/30 transition-colors duration-150">
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 text-[0.65rem] font-display font-bold uppercase tracking-[0.08em] text-[var(--accent-orange)] bg-orange-500/10 px-2 py-0.5 rounded-full mb-3">
                    Latest
                  </span>
                )}
                <h2 className="font-display font-bold text-[1.0625rem] text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-orange)] transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4 line-clamp-2">
                  {post.content}
                </p>
                <div className="flex items-center gap-4 text-[0.75rem] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> {timeAgo(post.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={11} /> {post._count.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {post._count.comments}
                  </span>
                  <span className="ml-auto text-[var(--accent-orange)] font-display font-semibold text-[0.75rem]">
                    Read more →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
