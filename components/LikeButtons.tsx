"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toggleLike } from "@/actions/likes";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("like");
  const [reaction, setReaction] = useState(initialUserReaction);
  const [likes, setLikes]       = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [pending, startTransition] = useTransition();

  function handleClick(type: "LIKE" | "DISLIKE") {
    if (isOwner || !isLoggedIn) return;

    const prev = reaction;
    setReaction((r) => (r === type ? null : type));
    setLikes((n) => {
      if (type === "LIKE"    && prev === "LIKE")    return n - 1;
      if (type === "LIKE"    && prev !== "LIKE")    return n + 1;
      if (type === "DISLIKE" && prev === "LIKE")    return n - 1;
      return n;
    });
    setDislikes((n) => {
      if (type === "DISLIKE" && prev === "DISLIKE") return n - 1;
      if (type === "DISLIKE" && prev !== "DISLIKE") return n + 1;
      if (type === "LIKE"    && prev === "DISLIKE") return n - 1;
      return n;
    });

    startTransition(async () => {
      const res = await toggleLike(videoId, type);
      if ("error" in res) {
        setReaction(prev);
        setLikes(initialLikes);
        setDislikes(initialDislikes);
      }
    });
  }

  const disabled = isOwner || !isLoggedIn || pending;
  const title = isOwner
    ? t("ownVideo")
    : !isLoggedIn
    ? t("signIn")
    : undefined;

  const btnBase = [
    "flex items-center gap-[0.4rem]",
    "py-[0.4rem] px-[0.875rem] rounded-lg",
    "font-display font-semibold text-sm",
    "transition-all duration-150",
    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
  ].join(" ");

  return (
    <div className="flex items-center gap-2" title={title}>
      {/* Like */}
      <button
        onClick={() => handleClick("LIKE")}
        disabled={disabled}
        className={[
          btnBase,
          reaction === "LIKE"
            ? "bg-orange-500/10 border border-orange-500/40 text-[var(--accent-orange)]"
            : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]",
        ].join(" ")}
      >
        <ThumbsUp size={15} fill={reaction === "LIKE" ? "currentColor" : "none"} />
        {likes}
      </button>

      {/* Dislike */}
      <button
        onClick={() => handleClick("DISLIKE")}
        disabled={disabled}
        className={[
          btnBase,
          reaction === "DISLIKE"
            ? "bg-red-500/10 border border-red-500/35 text-red-500"
            : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]",
        ].join(" ")}
      >
        <ThumbsDown size={15} fill={reaction === "DISLIKE" ? "currentColor" : "none"} />
        {dislikes}
      </button>
    </div>
  );
}
