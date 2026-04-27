import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, ShieldCheck } from "lucide-react";
import NewsCommentsSection from "@/components/NewsCommentsSection";
import NewsVoteButtons from "@/components/NewsVoteButtons";
import { getNewsVotes, getNewsComments } from "@/actions/news";
import { getTranslations } from "next-intl/server";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }   = await params;
  const [session, t] = await Promise.all([auth(), getTranslations("news")]);

  const post = await prisma.newsPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
    },
  }).catch(() => null);

  if (!post) notFound();

  const [votes, comments] = await Promise.all([
    getNewsVotes(id),
    getNewsComments(id),
  ]);

  const isAuthenticated = !!session?.user?.id;

  return (
    <div className="max-w-[720px] mx-auto px-6 py-10">
      {/* Back */}
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-8 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeft size={13} /> {t("allNews")}
      </Link>

      {/* Post */}
      <article className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-8 mb-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-display font-bold uppercase tracking-[0.08em] text-[var(--accent-orange)] bg-orange-500/10 px-2 py-0.5 rounded-full">
            {t("announcement")}
          </span>
        </div>

        <h1 className="font-display font-extrabold text-[1.75rem] tracking-[-0.02em] text-[var(--text-primary)] leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author + date */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--border-subtle)]">
          {post.author.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.image}
              alt={post.author.name ?? "Admin"}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center font-display font-bold text-sm text-[var(--text-muted)]">
              {(post.author.name ?? "A")[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-semibold text-[0.875rem] text-[var(--text-primary)]">
                {post.author.name ?? "Admin"}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[0.65rem] font-display font-bold uppercase tracking-[0.06em] text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded-full">
                <ShieldCheck size={9} /> {post.author.role}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[0.75rem] text-[var(--text-muted)]">
              <Calendar size={11} /> {formatDate(post.createdAt)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-[var(--text-secondary)] text-[0.9375rem] leading-[1.75] whitespace-pre-wrap mb-8">
          {post.content}
        </div>

        {/* Vote buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-[var(--border-subtle)]">
          <p className="text-[0.8rem] text-[var(--text-muted)] font-display">
            {t("wasHelpful")}
          </p>
          <NewsVoteButtons
            newsPostId={post.id}
            initialLikes={votes.likes}
            initialDislikes={votes.dislikes}
            initialMyVote={votes.myVote}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </article>

      {/* Comments */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-8">
        <NewsCommentsSection
          newsPostId={post.id}
          initialComments={comments.map((c) => ({
            ...c,
            replies: c.replies.map((r) => ({
              ...r,
              replies: [],
            })),
          }))}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
