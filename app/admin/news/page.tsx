import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewsAdminForm from "@/components/NewsAdminForm";
import { Trash2, Calendar, MessageSquare } from "lucide-react";
import { deleteNewsPost } from "@/actions/news";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default async function AdminNewsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/feed");

  const posts = await prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      _count: { select: { comments: true, likes: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] mb-1">
        Site News
      </h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Publish announcements visible to all users in their Messages panel.
      </p>

      {/* Create form */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 mb-8">
        <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-4">
          Publish New Announcement
        </h2>
        <NewsAdminForm />
      </div>

      {/* Existing posts */}
      <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-4">
        Published ({posts.length})
      </h2>

      {posts.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No news posts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[var(--text-primary)] mb-1 truncate">
                  {post.title}
                </p>
                <div className="flex items-center gap-4 text-[0.75rem] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> {formatDate(post.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {post._count.comments} comments
                  </span>
                  <span>👍 {post._count.likes}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/news/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.75rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] py-1.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] no-underline transition-colors"
                >
                  View
                </a>
                <form
                  action={async () => {
                    "use server";
                    await deleteNewsPost(post.id);
                  }}
                >
                  <button
                    type="submit"
                    className="flex items-center gap-1 text-[0.75rem] font-display font-semibold text-red-400 hover:text-red-300 py-1.5 px-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
