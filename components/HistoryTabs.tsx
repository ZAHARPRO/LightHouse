"use client";

import { useState } from "react";
import Link from "next/link";
// useTranslations — клиентская версия, вызывается ВНУТРИ компонента, не на уровне модуля
import { useTranslations } from "next-intl";
import { Clock, Eye , ThumbsDown, Bookmark, Play, ThumbsUp, } from "lucide-react";
import DownloadVideoButton from "./DownloadVideoButton";

type Video = {
  id: string;
  title: string;
  duration: number | null;
  views: number | null;
  isPremium: boolean;
  author: { id: string; name: string | null };
  watchedAt?: Date;
};

interface Props {
  history: Video[];
  liked: Video[];
  saved: Video[];
  userTier: string | null;
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Простые строки без t() — чтобы не передавать t в утилиту
function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "только что";
  // Строки конкатенируются через +, не через {t()} внутри template literal
  if (mins < 60)  return mins + " мин. назад";
  if (hours < 24) return hours + " ч. назад";
  if (days < 7)   return days + " дн. назад";
  return new Date(date).toLocaleDateString("ru-RU");
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function VideoCard({
  video,
  userTier,
  badge,
  onRemove,
  removeIcon,
  removeTitle,
}: {
  video: Video;
  userTier: string | null;
  badge?: React.ReactNode;
  onRemove?: () => void;
  removeIcon?: React.ReactNode;
  removeTitle?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-indigo-500/30 transition-colors">

      <Link
        href={`/watch/${video.id}`}
        className="shrink-0 w-[120px] h-[68px] rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center relative overflow-hidden no-underline"
      >
        {video.isPremium && (
          <span className="absolute top-1 left-1 text-[0.55rem] font-bold text-white bg-[linear-gradient(90deg,#f97316,#fbbf24)] px-1.5 py-[1px] rounded font-display">
            PRO
          </span>
        )}
        <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
          <Play size={12} color="white" fill="white" className="ml-px" />
        </div>
        {video.duration && (
          <span className="absolute bottom-1 right-1 text-[0.6rem] text-[#ddd] bg-black/60 px-1 rounded">
            {formatDuration(video.duration)}
          </span>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/watch/${video.id}`}
          className="font-display font-semibold text-sm text-[var(--text-primary)] line-clamp-2 no-underline hover:text-indigo-400 transition-colors"
        >
          {video.title}
        </Link>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{video.author.name}</p>
        {video.views != null && (
          <p className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)] mt-0.5">
            <Eye size={10} /> {formatViews(video.views)}
          </p>
        )}
        {badge && <div className="mt-1">{badge}</div>}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <DownloadVideoButton videoId={video.id} userTier={userTier} />

        {onRemove && (
          <button
            onClick={onRemove}
            title={removeTitle}
            className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)] hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
          >
            {removeIcon}
          </button>
        )}
      </div>
    </div>
  );
}

export default function HistoryTabs({ history, liked, saved, userTier }: Props) {
  // useTranslations вызывается ЗДЕСЬ — внутри компонента, это правильно
  const t = useTranslations("history");

  const [tab, setTab] = useState<"history" | "liked" | "saved">("history");
  const [historyList] = useState(history);
  const [likedList,   setLikedList]   = useState(liked);
  const [savedList,   setSavedList]   = useState(saved);

  // TABS определяется внутри компонента, потому что использует t()
  const TABS = [
    { key: "history" as const, label: t("tabHistory"), icon: <Clock size={14} /> },
    { key: "liked"   as const, label: t("tabLiked"),   icon: <ThumbsUp size={14} /> },
    { key: "saved"   as const, label: t("tabSaved"),   icon: <Bookmark size={14} /> },
  ];

  async function handleUnlike(videoId: string) {
    setLikedList((prev) => prev.filter((v) => v.id !== videoId));
    await fetch(`/api/likes/${videoId}`, { method: "DELETE" });
  }

  async function handleUnsave(videoId: string) {
    setSavedList((prev) => prev.filter((v) => v.id !== videoId));
    await fetch("/api/saved", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
  }

  return (
    <div>
      {/* Вкладки */}
      <div className="flex gap-2 mb-6 border-b border-[var(--border-subtle)] pb-3">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-display font-semibold transition-colors",
              tab === tabItem.key
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-transparent",
            ].join(" ")}
          >
            {tabItem.icon} {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <div className="flex flex-col gap-3">
          {historyList.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm">{t("noHistory")}</p>
          )}
          {historyList.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              userTier={userTier}
              badge={
                v.watchedAt && (
                  <span className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)]">
                    <Clock size={10} /> {timeAgo(v.watchedAt)}
                  </span>
                )
              }
            />
          ))}
        </div>
      )}

      {tab === "liked" && (
        <div className="flex flex-col gap-3">
          {likedList.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm">{t("noLiked")}</p>
          )}
          {likedList.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              userTier={userTier}
              onRemove={() => handleUnlike(v.id)}
              removeIcon={<ThumbsDown size={13} />}
              removeTitle={t("removeLike")}
            />
          ))}
        </div>
      )}

      {tab === "saved" && (
        <div className="flex flex-col gap-3">
          {savedList.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm">{t("noSaved")}</p>
          )}
          {savedList.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              userTier={userTier}
              onRemove={() => handleUnsave(v.id)}
              removeIcon={<Bookmark size={13} />}
              removeTitle={t("removeSave")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
