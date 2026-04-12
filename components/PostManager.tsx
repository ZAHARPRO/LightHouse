"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, Edit2, Trash2, X, Check, Crown, ChevronUp } from "lucide-react";
import { updatePost, deletePost } from "@/actions/posts";

type Post = {
  id: string; title: string; content: string;
  isPremium: boolean; createdAt: Date;
};

export default function PostManager({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts]           = useState(initialPosts);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();
  const [success, setSuccess]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  function flash(msg: string, type: "ok" | "err") {
    if (type === "ok") { setSuccess(msg); setTimeout(() => setSuccess(null), 2500); }
    else               { setError(msg);   setTimeout(() => setError(null),   3000); }
  }

  function handleSave(postId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updatePost(postId, fd);
      if (res && "error" in res) { flash(res.error ?? "Unknown error", "err"); return; }
      setPosts(ps => ps.map(p =>
        p.id !== postId ? p : {
          ...p,
          title:     (fd.get("title") as string)?.trim() || p.title,
          content:   (fd.get("content") as string)?.trim() || p.content,
          isPremium: fd.get("isPremium") === "on",
        }
      ));
      setExpanded(null);
      flash("Post updated", "ok");
    });
  }

  function handleDelete(postId: string) {
    startTransition(async () => {
      const res = await deletePost(postId);
      if (res && "error" in res) { flash(res.error ?? "Unknown error", "err"); return; }
      setPosts(ps => ps.filter(p => p.id !== postId));
      setConfirmDel(null);
      flash("Post deleted", "ok");
    });
  }

  if (posts.length === 0) return (
    <div className="card p-12 text-center">
      <FileText size={32} className="mx-auto mb-4 text-[var(--text-muted)]" />
      <p className="text-[var(--text-secondary)] mb-5">No posts yet</p>
      <Link href="/post/new" className="btn-primary no-underline py-2 px-5">
        Write First Post
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-sm">
          <Check size={14} /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-500 text-sm">
          <X size={14} /> {error}
        </div>
      )}

      {posts.map((post) => {
        const isOpen = expanded === post.id;
        const isDel  = confirmDel === post.id;

        return (
          <div key={post.id} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">

            {/* Row */}
            <div className="flex items-center gap-[0.875rem] p-4">
              <div className="w-[38px] h-[38px] rounded-lg shrink-0 flex items-center justify-center bg-orange-500/[0.08] border border-orange-500/15">
                <FileText size={16} className="text-[var(--accent-orange)]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/post/${post.id}`}
                    className="font-display font-bold text-[0.9rem] text-[var(--text-primary)] no-underline truncate max-w-[280px] sm:max-w-[360px]"
                  >
                    {post.title}
                  </Link>
                  {post.isPremium && <Crown size={12} className="text-amber-400 shrink-0" />}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-[0.2rem]">
                  {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {post.content.slice(0, 60)}{post.content.length > 60 ? "…" : ""}
                </p>
              </div>

              <div className="flex gap-[0.375rem] shrink-0">
                <button
                  onClick={() => { setExpanded(e => e === post.id ? null : post.id); setConfirmDel(null); }}
                  className={actionBtn(isOpen ? "orange" : "default")}
                  title="Edit"
                >
                  {isOpen ? <ChevronUp size={14} /> : <Edit2 size={14} />}
                </button>
                <button
                  onClick={() => { setConfirmDel(d => d === post.id ? null : post.id); setExpanded(null); }}
                  className={actionBtn(isDel ? "red" : "default")}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Edit form */}
            {isOpen && (
              <form
                onSubmit={(e) => handleSave(post.id, e)}
                className="border-t border-[var(--border-subtle)] px-4 py-5 flex flex-col gap-[0.875rem] bg-[var(--bg-elevated)]"
              >
                <div>
                  <Label>Title *</Label>
                  <input name="title" defaultValue={post.title} required className="input-field h-[38px]" />
                </div>
                <div>
                  <Label>Content *</Label>
                  <textarea name="content" defaultValue={post.content} required rows={6} className="input-field leading-[1.65]" style={{ resize: "vertical" }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" name="isPremium" defaultChecked={post.isPremium} className="w-[15px] h-[15px] accent-[var(--accent-orange)]" />
                    <Crown size={13} className="text-[var(--accent-orange)]" /> Premium
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setExpanded(null)} className={actionBtn("default")}>
                      <X size={13} /> Cancel
                    </button>
                    <button type="submit" disabled={pending} className={actionBtn("orange")}>
                      <Check size={13} /> {pending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Delete confirm */}
            {isDel && (
              <div className="border-t border-[var(--border-subtle)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-red-500/[0.05]">
                <span className="text-sm text-[var(--text-secondary)]">
                  Delete <b className="text-[var(--text-primary)]">{post.title}</b>? This can&apos;t be undone.
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDel(null)} className={actionBtn("default")}>
                    <X size={13} /> Cancel
                  </button>
                  <button onClick={() => handleDelete(post.id)} disabled={pending} className={actionBtn("red")}>
                    <Trash2 size={13} /> {pending ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display font-semibold text-xs text-[var(--text-muted)] mb-[0.375rem]">
      {children}
    </p>
  );
}

function actionBtn(variant: "default" | "orange" | "red") {
  const base = "flex items-center gap-[0.3rem] px-[0.625rem] py-[0.375rem] rounded-[7px] cursor-pointer font-display font-semibold text-[0.8rem] transition-all duration-150 border";
  if (variant === "orange") return `${base} bg-orange-500/10 border-orange-500/35 text-[var(--accent-orange)]`;
  if (variant === "red")    return `${base} bg-red-500/10 border-red-500/30 text-red-500`;
  return `${base} bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]`;
}
