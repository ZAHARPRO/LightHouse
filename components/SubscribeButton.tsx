"use client";

import { useState, useTransition } from "react";
import { UserPlus, UserMinus, Loader } from "lucide-react";
import { followCreator, unfollowCreator } from "@/actions/subscriptions";
import { useTranslations } from "next-intl";

interface Props {
  creatorId: string;
  initialFollowing: boolean;
}

export default function SubscribeButton({ creatorId, initialFollowing }: Props) {
  const t = useTranslations("subscribe");
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

  const bg = following
    ? isUnsubscribeMode ? "bg-red-500/10" : "bg-[var(--bg-elevated)]"
    : "bg-[var(--accent-orange)]";

  const text = following
    ? isUnsubscribeMode ? "text-red-500" : "text-[var(--text-primary)]"
    : "text-white";

  const border = following
    ? "border border-[var(--border-default)]"
    : "border border-transparent";

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isPending}
      className={[
        "inline-flex items-center gap-[0.4rem]",
        "py-[0.45rem] px-[1.1rem] rounded-lg",
        "text-sm font-semibold font-display",
        "transition-all duration-[180ms]",
        isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        bg, text, border,
      ].join(" ")}
    >
      {isPending ? (
        <Loader size={14} className="animate-spin" />
      ) : following ? (
        <UserMinus size={14} />
      ) : (
        <UserPlus size={14} />
      )}
      {isPending
        ? following ? t("unsubscribing") : t("subscribing")
        : following
          ? isUnsubscribeMode ? t("unsubscribe") : t("subscribed")
          : t("subscribe")}
    </button>
  );
}
