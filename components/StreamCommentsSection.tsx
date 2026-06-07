"use client";

import { useState } from "react";
import Image from "next/image";
import { Pin, Trash2, ThumbsUp } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";

type CommentData = {
  id: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  likeCount: number;
  author: { id: string; name: string | null; image: string | null };
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface Props {
  streamId: string;
  streamAuthorId: string;
  currentUserId: string | null;
  initialComments: CommentData[];
}

export default function StreamCommentsSection({
  streamId, streamAuthorId, currentUserId, initialComments,
}: Props) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/streams/${streamId}/stream-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (res.ok) {
      const c = await res.json() as CommentData;
      setComments(prev => [...prev, c]);
      setText("");
    }
    setSubmitting(false);
  }

  async function doAction(commentId: string, action: "pin" | "delete" | "like") {
    const res = await fetch(`/api/streams/${streamId}/stream-comments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, action }),
    });
    if (!res.ok) return;
    if (action === "delete") {
      setComments(prev => prev.filter(c => c.id !== commentId));
    } else if (action === "pin") {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, isPinned: !c.isPinned } : c));
    } else if (action === "like") {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likeCount: c.likeCount + 1 } : c));
    }
  }

  const sorted = [...comments].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="mt-6">
      <h2 className="font-display font-bold text-[0.95rem] text-[var(--text-primary)] mb-4">
        Comments ({comments.length})
      </h2>

      {/* Input */}
      {currentUserId ? (
        <div className="flex gap-3 mb-5">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment…"
            maxLength={2000}
            rows={2}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
          />
          <button
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="self-end px-4 py-2 rounded-xl bg-[var(--accent-orange)] text-white text-sm font-display font-bold hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            Post
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)] mb-5">Sign in to comment.</p>
      )}

      {/* List */}
      <div className="flex flex-col gap-4">
        {sorted.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">No comments yet.</p>
        )}
        {sorted.map(c => (
          <div key={c.id} className={["flex gap-3", c.isPinned ? "bg-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/20 rounded-xl p-3" : ""].join(" ")}>
            <div className="shrink-0 mt-0.5">
              <PlayerAvatar userId={c.author.id} name={c.author.name} image={c.author.image} size={32} noBadges />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-[0.8rem] text-[var(--text-primary)]">
                  {c.author.name ?? "Anonymous"}
                </span>
                {c.isPinned && (
                  <span className="flex items-center gap-1 text-[0.65rem] text-[var(--accent-orange)] font-semibold">
                    <Pin size={10} /> Pinned
                  </span>
                )}
                <span className="text-[0.7rem] text-[var(--text-muted)]">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-[0.85rem] text-[var(--text-secondary)] mt-0.5 leading-relaxed whitespace-pre-wrap">
                {c.content}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => doAction(c.id, "like")}
                  className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)] hover:text-[var(--accent-orange)] transition-colors"
                >
                  <ThumbsUp size={11} /> {c.likeCount > 0 && c.likeCount}
                </button>
                {currentUserId === streamAuthorId && (
                  <button
                    onClick={() => doAction(c.id, "pin")}
                    className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)] hover:text-[var(--accent-orange)] transition-colors"
                  >
                    <Pin size={11} /> {c.isPinned ? "Unpin" : "Pin"}
                  </button>
                )}
                {(currentUserId === c.author.id || currentUserId === streamAuthorId) && (
                  <button
                    onClick={() => doAction(c.id, "delete")}
                    className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
