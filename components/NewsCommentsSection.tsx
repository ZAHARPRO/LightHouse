"use client";

import { useState, useTransition } from "react";
import { addNewsComment } from "@/actions/news";
import { MessageSquare, CornerDownRight, Send, Loader2 } from "lucide-react";

type Author = { id: string; name: string | null; image: string | null };

type NewsComment = {
  id: string;
  content: string;
  createdAt: Date;
  author: Author;
  replyToName: string | null;
  replies: NewsComment[];
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name ?? "User"} className="w-8 h-8 rounded-full object-cover shrink-0" />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 font-display font-bold text-xs text-[var(--text-muted)]">
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function CommentItem({
  comment,
  newsPostId,
  isAuthenticated,
  depth = 0,
}: {
  comment: NewsComment;
  newsPostId: string;
  isAuthenticated: boolean;
  depth?: number;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pending, start]          = useTransition();

  function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    start(async () => {
      await addNewsComment(newsPostId, replyText, comment.id, comment.author.name ?? undefined);
      setReplyText("");
      setReplyOpen(false);
    });
  }

  return (
    <div className={depth > 0 ? "ml-8 border-l border-[var(--border-subtle)] pl-4" : ""}>
      <div className="flex gap-3 mb-3">
        <Avatar name={comment.author.name} image={comment.author.image} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-semibold text-[0.85rem] text-[var(--text-primary)]">
              {comment.author.name ?? "User"}
            </span>
            <span className="text-[0.72rem] text-[var(--text-muted)]">{timeAgo(comment.createdAt)}</span>
          </div>
          {comment.replyToName && (
            <span className="text-[0.72rem] text-[var(--accent-orange)] font-display font-semibold mr-1">
              @{comment.replyToName}
            </span>
          )}
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>
          {isAuthenticated && depth === 0 && (
            <button
              onClick={() => setReplyOpen((v) => !v)}
              className="mt-1.5 text-[0.72rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--accent-orange)] transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              <CornerDownRight size={11} className="inline mr-0.5" />
              Reply
            </button>
          )}
        </div>
      </div>

      {replyOpen && (
        <form onSubmit={submitReply} className="ml-11 mb-3 flex gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (replyText.trim() && !pending) submitReply(e as unknown as React.FormEvent);
              }
            }}
            placeholder={`Reply to ${comment.author.name ?? "user"}…`}
            rows={2}
            maxLength={2000}
            autoFocus
            className="input-field flex-1 text-sm"
            style={{ resize: "none" }}
          />
          <button
            type="submit"
            disabled={pending || !replyText.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--accent-orange)] text-white font-display font-semibold text-xs border-none disabled:opacity-50 cursor-pointer"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </form>
      )}

      {/* Nested replies */}
      {comment.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          newsPostId={newsPostId}
          isAuthenticated={isAuthenticated}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function NewsCommentsSection({
  newsPostId,
  initialComments,
  isAuthenticated,
}: {
  newsPostId: string;
  initialComments: NewsComment[];
  isAuthenticated: boolean;
}) {
  const [text, setText]    = useState("");
  const [pending, start]   = useTransition();
  const [comments, setComments] = useState(initialComments);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    start(async () => {
      const res = await addNewsComment(newsPostId, text);
      if ("comment" in res && res.comment) {
        setComments((prev) => [
          {
            ...res.comment,
            replies: [],
            replyToName: null,
            author: {
              id: res.comment.author.id,
              name: res.comment.author.name,
              image: (res.comment.author as { image?: string | null }).image ?? null,
            },
          },
          ...prev,
        ]);
      }
      setText("");
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare size={15} className="text-[var(--accent-orange)]" />
        <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
          Comments ({comments.length})
        </h2>
      </div>

      {/* Compose */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (text.trim() && !pending) handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Leave a comment… (Enter to send, Shift+Enter for new line)"
            rows={3}
            maxLength={2000}
            className="input-field flex-1 text-sm leading-relaxed"
            style={{ resize: "none" }}
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="self-end flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-semibold text-sm border-none disabled:opacity-50 cursor-pointer"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </form>
      ) : (
        <p className="text-[var(--text-muted)] text-sm mb-6">
          <a href="/auth/signin" className="text-[var(--accent-orange)] no-underline hover:underline">Sign in</a> to leave a comment.
        </p>
      )}

      {/* List */}
      {comments.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm text-center py-8 opacity-60">
          No comments yet. Be the first!
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              newsPostId={newsPostId}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
