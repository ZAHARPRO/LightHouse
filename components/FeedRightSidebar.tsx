"use client";

import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { useTranslations } from "next-intl";

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  isPremium: boolean;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

interface Props {
  communityPosts: CommunityPost[];
  isLoggedIn: boolean;
  visible: boolean;
  onToggle: () => void;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function FeedRightSidebar({ communityPosts, isLoggedIn, visible, onToggle }: Props) {
  const t = useTranslations("community");

  return (
    <aside
      className="flex flex-col gap-4 overflow-x-hidden sticky transition-opacity duration-300"
      style={{
        overflowY: visible ? "auto" : "hidden",
        top: "calc(64px + 1.5rem)",
        maxHeight: "calc(100vh - 64px - 3rem)",
      }}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        title={visible ? t("hidePanel") : t("showPanel")}
        className="self-start w-8 h-8 rounded-lg shrink-0 flex items-center justify-center cursor-pointer bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--accent-orange)]"
      >
        {visible ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {visible && (
        <>
          <div className="flex items-center justify-between">
            <span className="font-display font-extrabold text-sm text-[var(--text-primary)]">{t("title")}</span>
            <Link
              href="/community"
              className="text-[0.75rem] font-display font-semibold text-[var(--accent-orange)] no-underline hover:underline"
            >
              {t("seeAll")}
            </Link>
          </div>

          {communityPosts.length === 0 ? (
            <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-6 text-center">
              <p className="text-[0.8125rem] text-[var(--text-muted)] font-display">
                {isLoggedIn
                  ? t("noPostsMessage")
                  : t("notSignedIn")}
              </p>
              {!isLoggedIn && (
                <Link href="/auth/signin" className="btn-primary no-underline text-xs py-[0.3rem] px-4 mt-3 inline-block">
                  {t("signIn")}
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-[0.625rem]">
              {communityPosts.map((p) => (
                <Link
                  key={p.id}
                  href={`/post/${p.id}`}
                  className="block no-underline rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-[0.875rem] py-3 transition-[border-color] duration-150 hover:border-orange-500/30"
                >
                  <div className="flex items-center gap-2 mb-[0.5rem]">
                    <UserAvatar name={p.author.name ?? "?"} image={p.author.image} tier={p.author.tier} size="xs" />
                    <span className="font-display font-semibold text-[0.75rem] text-[var(--text-secondary)] truncate">
                      {p.author.name}
                    </span>
                    <span className="ml-auto text-[0.6875rem] text-[var(--text-muted)] shrink-0">
                      {timeAgo(p.createdAt)}
                    </span>
                  </div>
                  <p
                    className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)] leading-[1.3] mb-1 overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {p.isPremium && <span className="text-[var(--accent-orange)] mr-1">★</span>}
                    {p.title}
                  </p>
                  <p
                    className="text-[0.75rem] text-[var(--text-muted)] leading-snug overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {p.content}
                  </p>
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/community"
            className="block text-center px-4 py-[0.625rem] rounded-[10px] bg-orange-500/[0.08] border border-orange-500/20 no-underline font-display font-semibold text-[0.8125rem] text-[var(--accent-orange)] transition-colors duration-200 hover:bg-orange-500/[0.12]"
          >
            {t("seeMorePosts")}
          </Link>
        </>
      )}
    </aside>
  );
}
