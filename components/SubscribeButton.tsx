"use client";

import { useState, useTransition } from "react";
import { UserPlus, UserMinus, Loader } from "lucide-react";
import { followCreator, unfollowCreator } from "@/actions/subscriptions";

interface Props {
  creatorId: string;
  initialFollowing: boolean;
}

export default function SubscribeButton({ creatorId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const [hovered, setHovered] = useState(false);

  function handleClick() {
    startTransition(async () => {
      if (following) {
        const res = await unfollowCreator(creatorId);
        if (!res.error) setFollowing(false);
      } else {
        const res = await followCreator(creatorId);
        if (!res.error) setFollowing(true);
      }
    });
  }

  const isUnsubscribeMode = following && hovered;

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isPending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.45rem 1.1rem",
        borderRadius: 8,
        fontSize: "0.875rem",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        cursor: isPending ? "not-allowed" : "pointer",
        border: following
          ? "1px solid var(--border-default)"
          : "1px solid transparent",
        background: following
          ? isUnsubscribeMode
            ? "rgba(239,68,68,0.08)"
            : "var(--bg-elevated)"
          : "var(--accent-orange)",
        color: following
          ? isUnsubscribeMode
            ? "#ef4444"
            : "var(--text-primary)"
          : "white",
        transition: "all 0.18s",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {isPending ? (
        <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
      ) : following ? (
        <UserMinus size={14} />
      ) : (
        <UserPlus size={14} />
      )}
      {isPending
        ? following ? "Unsubscribing…" : "Subscribing…"
        : following
          ? isUnsubscribeMode ? "Unsubscribe" : "Subscribed"
          : "Subscribe"}
    </button>
  );
}
