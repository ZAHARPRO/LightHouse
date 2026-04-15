"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, Bell, GitCommit, Loader, AlertCircle, ExternalLink,
  Megaphone, Cog, FileText, Video, ChevronDown, Lock, Play, MessageCircle,
} from "lucide-react";
import UserAvatar from "./UserAvatar";

/* ─── Types ─── */

type Commit = {
  sha: string;
  title: string;
  description: string | null;
  author: string;
  date: string;
  url: string;
};

type NotifPost = {
  id: string;
  title: string;
  isPremium: boolean;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

type NotifVideo = {
  id: string;
  title: string;
  isPremium: boolean;
  duration: number | null;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

type NotifDM = {
  id: string;
  updatedAt: string;
  other: { id: string; name: string | null; username: string | null; tier: string; image: string | null };
  lastMessage: { content: string; senderId: string; createdAt: string; isDeleted: boolean } | null;
  lastIsMe: boolean;
};

/* ─── Helpers ─── */

function timeAgo(iso: string | Date): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtDuration(secs: number | null): string {
  if (!secs) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#6366f1", FREE: "#666",
};

type SiteNewsItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
  _count: { comments: number; likes: number };
};

/* ─── Accordion section ─── */

function Section({
  icon, label, badge, children, defaultOpen = false, onOpen,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [seen, setSeen] = useState(defaultOpen);

  function toggle() {
    setOpen((v) => {
      if (!v) {
        setSeen(true);
        onOpen?.();
      }
      return !v;
    });
  }

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      {/* Section header */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-[0.5rem] px-4 py-[0.75rem] bg-transparent border-none cursor-pointer text-left transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]"
      >
        <span className="text-[var(--accent-orange)]">{icon}</span>
        <span className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)] flex-1">
          {label}
        </span>
        {!seen && badge !== undefined && badge > 0 && (
          <span className="text-[0.6rem] font-bold px-[0.35rem] py-[0.05rem] rounded-full bg-orange-500/15 text-[var(--accent-orange)] border border-orange-500/25 font-display">
            {badge}
          </span>
        )}
        <ChevronDown
          size={14}
          className="text-[var(--text-muted)] transition-transform duration-200 shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {/* Content */}
      {open && (
        <div className="bg-[var(--bg-secondary)]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Props ─── */

interface Props {
  anchorRight: number;
  onClose: () => void;
  isClosing: boolean;
  onCommitsLoaded: (latestSha: string | null) => void;
  onAllSeen: () => void;
  storageKey: string;
}

/* ─── Main panel ─── */

const NotificationsPanel = forwardRef<HTMLDivElement, Props>(function NotificationsPanel(
  { anchorRight, onClose, isClosing, onCommitsLoaded, onAllSeen, storageKey }, ref
) {
  const [commits, setCommits]         = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(true);
  const [commitsError, setCommitsError]     = useState<string | null>(null);
  const [needsToken, setNeedsToken]         = useState(false);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  const [posts, setPosts]             = useState<NotifPost[]>([]);
  const [postsLoading, setPostsLoading]     = useState(true);

  const [videos, setVideos]           = useState<NotifVideo[]>([]);
  const [videosLoading, setVideosLoading]   = useState(true);

  const [dms, setDms]                 = useState<NotifDM[]>([]);
  const [dmsLoading, setDmsLoading]   = useState(true);

  const [siteNews, setSiteNews]           = useState<SiteNewsItem[]>([]);
  const [siteNewsLoading, setSiteNewsLoading] = useState(true);

  // Timestamps of when user last opened each section (persisted in localStorage)
  const [siteNewsSeenAt, setSiteNewsSeenAt] = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_sitenews_seen") ?? "0", 10)
  );
  const [devNewsSeenAt, setDevNewsSeenAt]   = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_devnews_seen") ?? "0", 10)
  );
  const [contentSeenAt, setContentSeenAt]   = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_content_seen") ?? "0", 10)
  );
  const [dmsSeenAt, setDmsSeenAt]           = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_dms_seen") ?? "0", 10)
  );

  function markSeen(key: string, setter: (n: number) => void) {
    const now = Date.now();
    setter(now);
    localStorage.setItem(key, String(now));
  }

  // Call onAllSeen when every section's unread count drops to zero
  useEffect(() => {
    if (commitsLoading || postsLoading || videosLoading || dmsLoading || siteNewsLoading) return;

    const unread =
      siteNews.filter(n => new Date(n.createdAt).getTime() > siteNewsSeenAt).length +
      commits.filter(c => new Date(c.date).getTime() > devNewsSeenAt).length +
      (posts.filter(p => new Date(p.createdAt).getTime() > contentSeenAt).length +
       videos.filter(v => new Date(v.createdAt).getTime() > contentSeenAt).length) +
      dms.filter(d => new Date(d.updatedAt).getTime() > dmsSeenAt && !d.lastIsMe).length;

    if (unread === 0) onAllSeen();
  }, [siteNewsSeenAt, devNewsSeenAt, contentSeenAt, dmsSeenAt,
      siteNews, commits, posts, videos, dms,
      siteNewsLoading, commitsLoading, postsLoading, videosLoading, dmsLoading]);

  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Fetch all in parallel */
  useEffect(() => {
    // Site news from DB
    fetch("/api/notifications/news")
      .then((r) => r.json())
      .then((data) => setSiteNews(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setSiteNewsLoading(false));

    // Commits (dev news)
    fetch("/api/github-commits")
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401 || data.needsToken) {
          setNeedsToken(true);
        } else if (Array.isArray(data)) {
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          setCommits(data.filter((c: Commit) => new Date(c.date).getTime() >= weekAgo));
          const latestSha = data[0]?.sha ?? null;
          onCommitsLoaded(latestSha);
          if (latestSha) localStorage.setItem(storageKey, latestSha);
        } else {
          setCommitsError(data.error ?? "Could not load updates.");
        }
      })
      .catch(() => setCommitsError("Network error."))
      .finally(() => setCommitsLoading(false));

    // Posts from subscriptions
    fetch("/api/notifications/posts")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setPostsLoading(false));

    // Videos from subscriptions
    fetch("/api/notifications/videos")
      .then((r) => r.json())
      .then((data) => setVideos(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setVideosLoading(false));

    // DM conversations
    fetch("/api/notifications/dms")
      .then((r) => r.json())
      .then((data) => setDms(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setDmsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX >= rect.left   - 5 &&
      e.clientX <= rect.right  + 5 &&
      e.clientY >= rect.top    - 5 &&
      e.clientY <= rect.bottom + 5
    ) return;
    leaveTimer.current = setTimeout(onClose, 120);
  }

  function handleMouseEnter() {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
  }

  /* ── Render ── */
  return (
    <div
      ref={ref}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      className="fixed z-[3000] flex flex-col bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] shadow-[0_8px_40px_rgba(0,0,0,0.45)] overflow-hidden"
      style={{
        top: 64 + 8,
        right: anchorRight,
        width: "min(360px, calc(100vw - 16px))",
        maxHeight: "calc(100vh - 88px)",
        transformOrigin: "top right",
        animation: isClosing ? "slideUpOut 0.18s ease both" : "slideDownIn 0.2s ease both",
      }}
    >
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-4 py-[0.875rem] border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[var(--accent-orange)]" />
          <span className="font-display font-bold text-sm text-[var(--text-primary)]">Notifications</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto flex-1">

        {/* ══ 0. Site News (from DB) ══ */}
        <Section
          icon={<Megaphone size={14} />}
          label="Site News"
          badge={siteNews.filter(n => new Date(n.createdAt).getTime() > siteNewsSeenAt).length}
          onOpen={() => markSeen("lh_notif_sitenews_seen", setSiteNewsSeenAt)}
        >
          {siteNewsLoading && (
            <div className="py-5 text-center">
              <Loader size={16} className="mx-auto text-[var(--accent-orange)] animate-spin" />
            </div>
          )}

          {!siteNewsLoading && siteNews.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">
              No announcements yet.
            </p>
          )}

          {!siteNewsLoading && siteNews.map((item, i, arr) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              onClick={onClose}
              className={[
                "flex items-start gap-2 px-4 py-3 no-underline transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]",
                i < arr.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
              ].join(" ")}
            >
              <div className="w-[7px] h-[7px] rounded-full bg-[var(--accent-orange)] border-2 border-orange-500/30 shrink-0 mt-[5px]" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.35] mb-0.5">
                  {item.title}
                </p>
                <p
                  className="text-[0.75rem] text-[var(--text-secondary)] leading-[1.5] mb-1 overflow-hidden"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                >
                  {item.content}
                </p>
                <div className="flex items-center gap-2 text-[0.6875rem] text-[var(--text-muted)]">
                  <span>{timeAgo(item.createdAt)}</span>
                  <span>·</span>
                  <span>👍 {item._count.likes}</span>
                  <span>·</span>
                  <span>💬 {item._count.comments}</span>
                </div>
              </div>
            </Link>
          ))}

          {!siteNewsLoading && siteNews.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-end border-t border-[var(--border-subtle)]">
              <Link
                href="/news"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] no-underline font-display hover:text-[var(--accent-orange)] transition-colors duration-150"
              >
                <Megaphone size={11} /> All announcements
              </Link>
            </div>
          )}
        </Section>

        {/* ══ 1. Development News ══ */}
        <Section
          icon={<Cog size={14} />}
          label="Development News"
          badge={commits.filter(c => new Date(c.date).getTime() > devNewsSeenAt).length}
          onOpen={() => markSeen("lh_notif_devnews_seen", setDevNewsSeenAt)}
          defaultOpen={false}
        >
          {commitsLoading && (
            <div className="py-6 text-center">
              <Loader size={18} className="mx-auto mb-2 text-[var(--accent-orange)] animate-spin" />
              <p className="text-[var(--text-muted)] text-xs">Loading…</p>
            </div>
          )}

          {!commitsLoading && needsToken && (
            <div className="px-4 py-4 text-[0.8rem] text-[var(--text-secondary)] leading-[1.55]">
              <AlertCircle size={14} className="inline mr-1 text-orange-500" />
              GitHub token required — add{" "}
              <code className="text-[0.7rem] text-[var(--accent-orange)] bg-orange-500/10 px-1 rounded">
                GITHUB_TOKEN
              </code>{" "}
              to .env.local.
            </div>
          )}

          {!commitsLoading && commitsError && (
            <div className="py-5 px-4 text-center">
              <AlertCircle size={18} className="mx-auto mb-2 text-red-500" />
              <p className="text-[var(--text-secondary)] text-xs">{commitsError}</p>
            </div>
          )}

          {!commitsLoading && !commitsError && commits.length === 0 && !needsToken && (
            <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">No updates this week.</p>
          )}

          {!commitsLoading && !commitsError && commits.map((c, i) => {
            const isOpen   = expandedCommit === c.sha;
            const shortSha = c.sha.slice(0, 7);
            return (
              <div key={c.sha} className={i < commits.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}>
                <button
                  onClick={() => setExpandedCommit(isOpen ? null : c.sha)}
                  className="w-full text-left bg-transparent border-none cursor-pointer px-4 py-3 flex gap-3 items-start hover:bg-[var(--bg-elevated)] transition-colors duration-[120ms]"
                >
                  <div className="flex flex-col items-center shrink-0 mt-[5px]">
                    <div className="w-[7px] h-[7px] rounded-full bg-[var(--accent-orange)] border-2 border-orange-500/30" />
                    {i < commits.length - 1 && <div className="w-px h-6 bg-[var(--border-subtle)] mt-[3px]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.35] break-words m-0">
                      {c.title}
                    </p>
                    <div className="flex items-center flex-wrap gap-[0.375rem] mt-[0.25rem]">
                      <span className="text-[0.6875rem] text-[var(--text-muted)]">{c.author}</span>
                      <span className="text-[var(--border-subtle)] text-[0.6875rem]">·</span>
                      <span className="text-[0.6875rem] text-[var(--text-muted)]">{timeAgo(c.date)}</span>
                      <span className="text-[var(--border-subtle)] text-[0.6875rem]">·</span>
                      <code className="text-[0.625rem] text-[var(--accent-orange)] bg-orange-500/10 px-1 py-[0.05rem] rounded font-mono">
                        {shortSha}
                      </code>
                    </div>
                    {isOpen && c.description && (
                      <p className="mt-2 text-[0.8rem] text-[var(--text-secondary)] leading-[1.55] whitespace-pre-wrap break-words bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md px-[0.625rem] py-2">
                        {c.description}
                      </p>
                    )}
                    {isOpen && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--accent-orange)] no-underline font-display font-medium"
                      >
                        <ExternalLink size={11} /> View on GitHub
                      </a>
                    )}
                  </div>
                  {c.description && (
                    <span
                      className="text-[var(--text-muted)] text-[0.625rem] shrink-0 mt-[5px] transition-transform duration-150 inline-block"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    >
                      ▾
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {/* GitHub link */}
          {!commitsLoading && !needsToken && (
            <div className="px-4 py-2 flex items-center justify-end border-t border-[var(--border-subtle)]">
              <a
                href="https://github.com/ZAHARPRO/LightHouse/commits"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] no-underline font-display hover:text-[var(--accent-orange)] transition-colors duration-150"
              >
                <GitCommit size={11} /> All commits
              </a>
            </div>
          )}
        </Section>

        {/* ══ 2. New Content (Posts + Videos) ══ */}
        <Section
          icon={<FileText size={14} />}
          label="New Content"
          badge={posts.filter(p => new Date(p.createdAt).getTime() > contentSeenAt).length + videos.filter(v => new Date(v.createdAt).getTime() > contentSeenAt).length}
          onOpen={() => markSeen("lh_notif_content_seen", setContentSeenAt)}
        >
          {(postsLoading || videosLoading) && (
            <div className="py-5 text-center">
              <Loader size={16} className="mx-auto text-[var(--accent-orange)] animate-spin" />
            </div>
          )}

          {!postsLoading && !videosLoading && posts.length === 0 && videos.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">
              No new posts or videos from your subscriptions.
            </p>
          )}

          {!postsLoading && !videosLoading && [...posts.map(p => ({ ...p, type: "post" as const })), ...videos.map(v => ({ ...v, type: "video" as const }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item, i, arr) => {
            const color = TIER_COLORS[item.author.tier] ?? "#666";
            const isPost = item.type === "post";
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={isPost ? `/post/${item.id}` : `/watch/${item.id}`}
                onClick={onClose}
                className={[
                  "flex items-start gap-3 px-4 py-3 no-underline transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]",
                  i < arr.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                {/* Icon/Avatar */}
                {isPost ? (
                  <UserAvatar name={item.author.name ?? "?"} image={item.author.image} tier={item.author.tier} size="sm" className="mt-[2px]" />
                ) : (
                  <div
                    className="w-10 h-[26px] rounded shrink-0 flex items-center justify-center mt-[2px]"
                    style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                  >
                    <Play size={10} style={{ color }} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-[0.2rem]">
                    {!isPost && (
                      <UserAvatar name={item.author.name ?? "?"} image={item.author.image} tier={item.author.tier} size="xs" />
                    )}
                    <span className="font-display font-semibold text-[0.75rem] text-[var(--text-secondary)] truncate">
                      {item.author.name}
                    </span>
                    {item.isPremium && <Lock size={10} className="text-[var(--accent-orange)] shrink-0" />}
                    <span className="text-[0.65rem] text-[var(--text-muted)] ml-auto">
                      {isPost ? "Post" : "Video"}
                    </span>
                  </div>
                  <p
                    className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.3] overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-[0.2rem]">
                    <span className="text-[0.6875rem] text-[var(--text-muted)]">{timeAgo(item.createdAt)}</span>
                    {!isPost && "duration" in item && item.duration && (
                      <>
                        <span className="text-[var(--border-subtle)] text-[0.6875rem]">·</span>
                        <span className="text-[0.6875rem] text-[var(--text-muted)]">{fmtDuration(item.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </Section>

        {/* ══ 3. Direct Messages ══ */}
        <Section
          icon={<MessageCircle size={14} />}
          label="Direct Messages"
          badge={dms.filter(d => new Date(d.updatedAt).getTime() > dmsSeenAt && !d.lastIsMe).length}
          onOpen={() => markSeen("lh_notif_dms_seen", setDmsSeenAt)}
        >
          {dmsLoading && (
            <div className="py-5 text-center">
              <Loader size={16} className="mx-auto text-[var(--accent-orange)] animate-spin" />
            </div>
          )}

          {!dmsLoading && dms.filter(d => new Date(d.updatedAt).getTime() > dmsSeenAt && !d.lastIsMe).length === 0 && (
            <p className="px-4 py-5 text-center text-sm text-[var(--text-muted)] italic">
              cry baby you're alone 👶
            </p>
          )}

          {!dmsLoading && dms.filter(d => new Date(d.updatedAt).getTime() > dmsSeenAt && !d.lastIsMe).map((dm, i, arr) => {
            const preview = dm.lastMessage
              ? dm.lastMessage.isDeleted
                ? "Message deleted"
                : dm.lastIsMe
                  ? `You: ${dm.lastMessage.content}`
                  : dm.lastMessage.content
              : "No messages yet";
            return (
              <Link
                key={dm.id}
                href={`/dm/${dm.id}`}
                onClick={onClose}
                className={[
                  "flex items-center gap-3 px-4 py-3 no-underline transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]",
                  i < arr.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                {/* Avatar */}
                <UserAvatar name={dm.other.name ?? "?"} image={dm.other.image} tier={dm.other.tier} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1 mb-[0.15rem]">
                    <span className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] truncate">
                      {dm.other.name}
                      {dm.other.username && (
                        <span className="font-normal text-[0.7rem] text-[var(--text-muted)] ml-1">
                          @{dm.other.username}
                        </span>
                      )}
                    </span>
                    {dm.lastMessage && (
                      <span className="text-[0.6rem] text-[var(--text-muted)] shrink-0">
                        {timeAgo(dm.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[0.75rem] text-[var(--text-muted)] truncate"
                    style={{ fontStyle: dm.lastMessage?.isDeleted ? "italic" : undefined }}
                  >
                    {preview}
                  </p>
                </div>
              </Link>
            );
          })}

          {!dmsLoading && dms.filter(d => new Date(d.updatedAt).getTime() > dmsSeenAt && !d.lastIsMe).length > 0 && (
            <div className="px-4 py-2 flex items-center justify-end border-t border-[var(--border-subtle)]">
              <Link
                href="/dm"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] no-underline font-display hover:text-[var(--accent-orange)] transition-colors duration-150"
              >
                <MessageCircle size={11} /> All messages
              </Link>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
});

export default NotificationsPanel;
