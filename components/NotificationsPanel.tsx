"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { X, Bell, GitCommit, Loader, AlertCircle, ExternalLink } from "lucide-react";

type Commit = {
  sha: string;
  title: string;
  description: string | null;
  author: string;
  date: string;
  url: string;
};

function timeAgo(iso: string): string {
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

interface Props {
  anchorRight: number;
  onClose: () => void;
  isClosing: boolean;
  onCommitsLoaded: (latestSha: string | null) => void;
  storageKey: string;
}

const NotificationsPanel = forwardRef<HTMLDivElement, Props>(function NotificationsPanel(
  { anchorRight, onClose, isClosing, onCommitsLoaded, storageKey }, ref
) {
  const [commits, setCommits]     = useState<Commit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/github-commits")
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401 || data.needsToken) {
          setNeedsToken(true);
        } else if (Array.isArray(data)) {
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const recent = data.filter((c: Commit) => new Date(c.date).getTime() >= weekAgo);
          setCommits(recent);
          const latestSha = data[0]?.sha ?? null;
          onCommitsLoaded(latestSha);
          if (latestSha) localStorage.setItem(storageKey, latestSha);
        } else {
          setError(data.error ?? "Could not load updates.");
        }
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
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

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = commits.filter(c => new Date(c.date).getTime() >= weekAgo).length;

  return (
    <div
      ref={ref}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      className="fixed z-[3000] flex flex-col bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] shadow-[0_8px_40px_rgba(0,0,0,0.45)] overflow-hidden"
      style={{
        top: 64 + 8,
        right: anchorRight,
        /* Full width on mobile, fixed 360px on sm+ */
        width: "min(360px, calc(100vw - 16px))",
        maxHeight: "calc(100vh - 88px)",
        transformOrigin: "top right",
        animation: isClosing ? "slideUpOut 0.18s ease both" : "slideDownIn 0.2s ease both",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-[0.875rem] border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <GitCommit size={14} className="text-[var(--accent-orange)]" />
          <span className="font-display font-bold text-sm text-[var(--text-primary)]">
            Project Updates
          </span>
          {recentCount > 0 && (
            <span className="text-[0.6875rem] font-bold px-[0.4rem] py-[0.0625rem] rounded-full bg-orange-500/15 text-[var(--accent-orange)] border border-orange-500/25 font-display">
              {recentCount} this week
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/ZAHARPRO/LightHouse/commits"
            target="_blank"
            rel="noopener noreferrer"
            title="View all on GitHub"
            className="flex items-center gap-[0.3rem] no-underline text-[var(--text-muted)] text-xs font-display font-medium"
          >
            <ExternalLink size={12} />
            GitHub
          </a>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">

        {/* Loading */}
        {loading && (
          <div className="py-10 px-4 text-center">
            <Loader size={22} className="mx-auto mb-3 text-[var(--accent-orange)] animate-spin" />
            <p className="text-[var(--text-muted)] text-[0.8125rem]">Loading commits…</p>
          </div>
        )}

        {/* Needs token */}
        {!loading && needsToken && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={15} className="text-orange-500" />
              <span className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)]">
                GitHub token required
              </span>
            </div>
            <p className="text-[0.8rem] text-[var(--text-secondary)] leading-[1.55] mb-4">
              The repo is private. Add a Personal Access Token to{" "}
              <code className="text-xs text-[var(--accent-orange)] bg-orange-500/10 px-[0.3rem] py-[0.1rem] rounded">
                .env.local
              </code>
              :
            </p>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-[0.875rem] py-[0.625rem] mb-4">
              <code className="text-xs text-[var(--accent-orange)] font-mono block leading-relaxed">
                GITHUB_TOKEN=&quot;ghp_your_token_here&quot;
              </code>
            </div>
            <ol className="text-[0.8rem] text-[var(--text-secondary)] leading-[1.7] pl-5 m-0">
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-orange)] no-underline"
                >
                  github.com/settings/tokens
                </a>
              </li>
              <li>Select <strong className="text-[var(--text-primary)]">Fine-grained token</strong></li>
              <li>Give it <strong className="text-[var(--text-primary)]">Contents: Read-only</strong> on this repo</li>
              <li>
                Paste it in{" "}
                <code className="text-xs text-[var(--accent-orange)] bg-orange-500/10 px-[0.3rem] py-[0.1rem] rounded">
                  .env.local
                </code>{" "}
                and restart
              </li>
            </ol>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-8 px-4 text-center">
            <AlertCircle size={22} className="mx-auto mb-[0.625rem] text-red-500" />
            <p className="text-[var(--text-secondary)] text-[0.8125rem]">{error}</p>
          </div>
        )}

        {/* Commits */}
        {!loading && !error && commits.map((c, i) => {
          const isOpen    = expanded === c.sha;
          const shortSha  = c.sha.slice(0, 7);

          return (
            <div
              key={c.sha}
              className={i < commits.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : c.sha)}
                className="w-full text-left bg-transparent border-none cursor-pointer px-4 py-[0.875rem] flex gap-3 items-start transition-colors duration-[120ms] hover:bg-[var(--bg-elevated)]"
              >
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-orange)] border-2 border-orange-500/30 shrink-0" />
                  {i < commits.length - 1 && (
                    <div className="w-px h-7 bg-[var(--border-subtle)] mt-[3px]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <p className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)] leading-[1.35] m-0 break-words">
                    {c.title}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center flex-wrap gap-2 mt-[0.3rem]">
                    <span className="font-body text-[0.6875rem] text-[var(--text-muted)] shrink-0">{c.author}</span>
                    <span className="text-[var(--border-subtle)] text-[0.6875rem]">·</span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)] shrink-0">{timeAgo(c.date)}</span>
                    <span className="text-[var(--border-subtle)] text-[0.6875rem]">·</span>
                    <code className="text-[0.625rem] text-[var(--accent-orange)] bg-orange-500/10 px-[0.3rem] py-[0.0625rem] rounded font-mono">
                      {shortSha}
                    </code>
                  </div>

                  {/* Expanded description */}
                  {isOpen && c.description && (
                    <p className="mt-2 text-[0.8rem] text-[var(--text-secondary)] leading-[1.55] whitespace-pre-wrap break-words bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md px-[0.625rem] py-2">
                      {c.description}
                    </p>
                  )}

                  {/* GitHub link when expanded */}
                  {isOpen && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--accent-orange)] no-underline font-display font-medium"
                    >
                      <ExternalLink size={11} />
                      View on GitHub
                    </a>
                  )}
                </div>

                {/* Expand indicator */}
                {c.description && (
                  <span
                    className="text-[var(--text-muted)] text-[0.625rem] shrink-0 mt-[5px] inline-block transition-transform duration-150"
                    style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                  >
                    ▾
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Empty */}
        {!loading && !error && commits.length === 0 && (
          <div className="py-10 px-4 text-center">
            <Bell size={22} className="mx-auto mb-[0.625rem] text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)] text-[0.8125rem]">No commits found.</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default NotificationsPanel;
