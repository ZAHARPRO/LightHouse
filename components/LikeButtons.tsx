"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toggleLike } from "@/actions/likes";

interface Props {
  videoId: string;
  initialLikes: number;
  initialDislikes: number;
  initialUserReaction: "LIKE" | "DISLIKE" | null;
  isOwner: boolean;
  isLoggedIn: boolean;
}

export default function LikeButtons({
  videoId,
  initialLikes,
  initialDislikes,
  initialUserReaction,
  isOwner,
  isLoggedIn,
}: Props) {
  const [reaction, setReaction] = useState(initialUserReaction);
  const [likes, setLikes]       = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [pending, startTransition] = useTransition();

  function handleClick(type: "LIKE" | "DISLIKE") {
    if (isOwner || !isLoggedIn) return;

    // Optimistic update
    const prev = reaction;
    setReaction((r) => (r === type ? null : type));
    setLikes((n) => {
      if (type === "LIKE"    && prev === "LIKE")    return n - 1; // toggle off
      if (type === "LIKE"    && prev !== "LIKE")    return n + 1; // add / switch to like
      if (type === "DISLIKE" && prev === "LIKE")    return n - 1; // switch away from like
      return n;
    });
    setDislikes((n) => {
      if (type === "DISLIKE" && prev === "DISLIKE") return n - 1; // toggle off
      if (type === "DISLIKE" && prev !== "DISLIKE") return n + 1; // add / switch to dislike
      if (type === "LIKE"    && prev === "DISLIKE") return n - 1; // switch away from dislike
      return n;
    });

    startTransition(async () => {
      const res = await toggleLike(videoId, type);
      if ("error" in res) {
        // Revert on error
        setReaction(prev);
        setLikes(initialLikes);
        setDislikes(initialDislikes);
      }
    });
  }

  const disabled = isOwner || !isLoggedIn || pending;
  const title = isOwner
    ? "You can't react to your own video"
    : !isLoggedIn
    ? "Sign in to react"
    : undefined;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} title={title}>
      {/* Like */}
      <button
        onClick={() => handleClick("LIKE")}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.4rem 0.875rem", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
          background: reaction === "LIKE" ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
          border: reaction === "LIKE" ? "1px solid rgba(249,115,22,0.4)" : "1px solid var(--border-subtle)",
          color: reaction === "LIKE" ? "var(--accent-orange)" : "var(--text-secondary)",
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem",
          transition: "all 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <ThumbsUp size={15} fill={reaction === "LIKE" ? "currentColor" : "none"} />
        {likes}
      </button>

      {/* Dislike */}
      <button
        onClick={() => handleClick("DISLIKE")}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.4rem 0.875rem", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
          background: reaction === "DISLIKE" ? "rgba(239,68,68,0.1)" : "var(--bg-elevated)",
          border: reaction === "DISLIKE" ? "1px solid rgba(239,68,68,0.35)" : "1px solid var(--border-subtle)",
          color: reaction === "DISLIKE" ? "#ef4444" : "var(--text-secondary)",
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem",
          transition: "all 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <ThumbsDown size={15} fill={reaction === "DISLIKE" ? "currentColor" : "none"} />
        {dislikes}
      </button>
    </div>
  );
}
