"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, Bell, GitCommit, Loader, AlertCircle, ExternalLink,
  Megaphone, Cog, FileText, Video, ChevronDown, Lock, Play,
} from "lucide-react";

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
  author: { id: string; name: string | null; tier: string };
};

type NotifVideo = {
  id: string;
  title: string;
  isPremium: boolean;
  duration: number | null;
  createdAt: string;
  author: { id: string; name: string | null; tier: string };
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

const SITE_NEWS: { id: string; title: string; body: string; date: string }[] = [
  { id: "sn1", title: "Community feed is live!", body: "You can now see posts from creators you follow in the sidebar and on the /community page.", date: "2026-04-13" },
  { id: "sn2", title: "Profile links in comments", body: "Clicking on an avatar or username in comments now takes you to their profile page.", date: "2026-04-12" },
];

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
  storageKey: string;
}

/* ─── Main panel ─── */

const NotificationsPanel = forwardRef<HTMLDivElement, Props>(function NotificationsPanel(
  { anchorRight, onClose, isClosing, onCommitsLoaded, storageKey }, ref
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

  // Timestamps of when user last opened each section (persisted in localStorage)
  const [siteNewsSeenAt, setSiteNewsSeenAt] = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_sitenews_seen") ?? "0", 10)
  );
  const [devNewsSeenAt, setDevNewsSeenAt]   = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_devnews_seen") ?? "0", 10)
  );
  const [postsSeenAt, setPostsSeenAt]       = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_posts_seen") ?? "0", 10)
  );
  const [videosSeenAt, setVideosSeenAt]     = useState<number>(
    () => parseInt(localStorage.getItem("lh_notif_videos_seen") ?? "0", 10)
  );

  function markSeen(key: string, setter: (n: number) => void) {
    const now = Date.now();
    setter(now);
    localStorage.setItem(key, String(now));
  }

  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Fetch all three in parallel */
  useEffect(() => {
    // Commits (site news)
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

        {/* ══ 0. Site News (global announcements — stub) ══ */}
        <Section
          icon={<Megaphone size={14} />}
          label="Site News"
          badge={SITE_NEWS.filter(n => new Date(n.date).getTime() > siteNewsSeenAt).length}
          onOpen={() => markSeen("lh_notif_sitenews_seen", setSiteNewsSeenAt)}
        >
          {SITE_NEWS.map((item, i, arr) => (
            <div
              key={item.id}
              className={[
                "px-4 py-3",
                i < arr.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <div className="w-[7px] h-[7px] rounded-full bg-[var(--accent-orange)] border-2 border-orange-500/30 shrink-0 mt-[5px]" />
                <div>
                  <p className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.35] mb-1">
                    {item.title}
                  </p>
                  <p className="text-[0.775rem] text-[var(--text-secondary)] leading-[1.5] mb-1">
                    {item.body}
                  </p>
                  <span className="text-[0.6875rem] text-[var(--text-muted)]">{item.date}</span>
                </div>
              </div>
            </div>
          ))}
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

        {/* ══ 2. New Posts ══ */}
        <Section
          icon={<FileText size={14} />}
          label="New Posts"
          badge={posts.filter(p => new Date(p.createdAt).getTime() > postsSeenAt).length}
          onOpen={() => markSeen("lh_notif_posts_seen", setPostsSeenAt)}
        >
          {postsLoading && (
            <div className="py-5 text-center">
              <Loader size={16} className="mx-auto text-[var(--accent-orange)] animate-spin" />
            </div>
          )}

          {!postsLoading && posts.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">
              No new posts from your subscriptions.
            </p>
          )}

          {!postsLoading && posts.map((p, i) => {
            const color = TIER_COLORS[p.author.tier] ?? "#666";
            return (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                onClick={onClose}
                className={[
                  "flex items-start gap-3 px-4 py-3 no-underline transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]",
                  i < posts.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-[0.5625rem] mt-[2px]"
                  style={{ background: `${color}22`, border: `1.5px solid ${color}50`, color }}
                >
                  {(p.author.name ?? "?")[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-[0.2rem]">
                    <span className="font-display font-semibold text-[0.75rem] text-[var(--text-secondary)] truncate">
                      {p.author.name}
                    </span>
                    {p.isPremium && <Lock size={10} className="text-[var(--accent-orange)] shrink-0" />}
                  </div>
                  <p
                    className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.3] overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {p.title}
                  </p>
                  <span className="text-[0.6875rem] text-[var(--text-muted)]">{timeAgo(p.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </Section>

        {/* ══ 3. New Videos ══ */}
        <Section
          icon={<Video size={14} />}
          label="New Videos"
          badge={videos.filter(v => new Date(v.createdAt).getTime() > videosSeenAt).length}
          onOpen={() => markSeen("lh_notif_videos_seen", setVideosSeenAt)}
        >
          {videosLoading && (
            <div className="py-5 text-center">
              <Loader size={16} className="mx-auto text-[var(--accent-orange)] animate-spin" />
            </div>
          )}

          {!videosLoading && videos.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">
              No new videos from your subscriptions.
            </p>
          )}

          {!videosLoading && videos.map((v, i) => {
            const color = TIER_COLORS[v.author.tier] ?? "#666";
            return (
              <Link
                key={v.id}
                href={`/watch/${v.id}`}
                onClick={onClose}
                className={[
                  "flex items-start gap-3 px-4 py-3 no-underline transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]",
                  i < videos.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                {/* Thumbnail placeholder */}
                <div
                  className="w-10 h-[26px] rounded shrink-0 flex items-center justify-center mt-[2px]"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Play size={10} style={{ color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-[0.2rem]">
                    <div
                      className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-[0.4375rem]"
                      style={{ background: `${color}22`, border: `1px solid ${color}50`, color }}
                    >
                      {(v.author.name ?? "?")[0].toUpperCase()}
                    </div>
                    <span className="font-display font-semibold text-[0.75rem] text-[var(--text-secondary)] truncate">
                      {v.author.name}
                    </span>
                    {v.isPremium && <Lock size={10} className="text-[var(--accent-orange)] shrink-0" />}
                  </div>
                  <p
                    className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.3] overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {v.title}
                  </p>
                  <div className="flex items-center gap-2 mt-[0.2rem]">
                    <span className="text-[0.6875rem] text-[var(--text-muted)]">{timeAgo(v.createdAt)}</span>
                    {v.duration && (
                      <>
                        <span className="text-[var(--border-subtle)] text-[0.6875rem]">·</span>
                        <span className="text-[0.6875rem] text-[var(--text-muted)]">{fmtDuration(v.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </Section>

      </div>
    </div>
  );
});

export default NotificationsPanel;
