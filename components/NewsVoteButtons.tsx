"use client";

import { useState, useTransition } from "react";
import { voteNews } from "@/actions/news";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";

export default function NewsVoteButtons({
  newsPostId,
  initialLikes,
  initialDislikes,
  initialMyVote,
  isAuthenticated,
}: {
  newsPostId: string;
  initialLikes: number;
  initialDislikes: number;
  initialMyVote: "LIKE" | "DISLIKE" | null;
  isAuthenticated: boolean;
}) {
  const [likes, setLikes]         = useState(initialLikes);
  const [dislikes, setDislikes]   = useState(initialDislikes);
  const [myVote, setMyVote]       = useState(initialMyVote);
  const [pending, start]          = useTransition();

  function vote(type: "LIKE" | "DISLIKE") {
    if (!isAuthenticated) return;
    const prev = myVote;

    // Optimistic update
    if (prev === type) {
      setMyVote(null);
      type === "LIKE" ? setLikes((n) => n - 1) : setDislikes((n) => n - 1);
    } else {
      if (prev === "LIKE") setLikes((n) => n - 1);
      if (prev === "DISLIKE") setDislikes((n) => n - 1);
      setMyVote(type);
      type === "LIKE" ? setLikes((n) => n + 1) : setDislikes((n) => n + 1);
    }

    start(async () => {
      await voteNews(newsPostId, type);
    });
  }

  const btnBase =
    "flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-semibold text-sm border cursor-pointer transition-all duration-150 disabled:opacity-50";

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => vote("LIKE")}
        disabled={pending || !isAuthenticated}
        title={isAuthenticated ? undefined : "Sign in to vote"}
        className={[
          btnBase,
          myVote === "LIKE"
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
            : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-emerald-500/30 hover:text-emerald-400",
        ].join(" ")}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
        {likes}
      </button>

      <button
        onClick={() => vote("DISLIKE")}
        disabled={pending || !isAuthenticated}
        title={isAuthenticated ? undefined : "Sign in to vote"}
        className={[
          btnBase,
          myVote === "DISLIKE"
            ? "bg-red-500/15 border-red-500/40 text-red-400"
            : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-red-500/30 hover:text-red-400",
        ].join(" ")}
      >
        <ThumbsDown size={14} />
        {dislikes}
      </button>
    </div>
  );
}
