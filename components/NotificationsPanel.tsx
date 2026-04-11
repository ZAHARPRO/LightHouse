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
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  anchorRight: number;
  onClose: () => void;
  isClosing: boolean;
  onCommitsLoaded: (latestSha: string | null) => void;
  storageKey: string;
}

const NotificationsPanel = forwardRef<HTMLDivElement, Props>(function NotificationsPanel({ anchorRight, onClose, isClosing, onCommitsLoaded, storageKey }, ref) {
  const [commits, setCommits]   = useState<Commit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
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
          // Save as seen — panel is open right now
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
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  return (
    <div
      ref={ref}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        position: "fixed",
        top: 64 + 8,
        right: anchorRight,
        width: 360,
        maxHeight: "calc(100vh - 88px)",
        zIndex: 3000,
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
        animation: isClosing
          ? "slideUpOut 0.18s ease both"
          : "slideDownIn 0.2s ease both",
        transformOrigin: "top right",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.875rem 1rem",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-elevated)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <GitCommit size={14} color="var(--accent-orange)" />
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "0.875rem", color: "var(--text-primary)",
          }}>
            Project Updates
          </span>
          {(() => {
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recent = commits.filter(c => new Date(c.date).getTime() >= weekAgo).length;
            return recent > 0 ? (
              <span style={{
                fontSize: "0.6875rem", fontWeight: 700,
                background: "rgba(249,115,22,0.15)", color: "var(--accent-orange)",
                borderRadius: 100, padding: "0.0625rem 0.4rem",
                fontFamily: "var(--font-display)",
                border: "1px solid rgba(249,115,22,0.25)",
              }}>
                {recent} this week
              </span>
            ) : null;
          })()}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <a
            href="https://github.com/ZAHARPRO/LightHouse/commits"
            target="_blank"
            rel="noopener noreferrer"
            title="View all on GitHub"
            style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              textDecoration: "none", color: "var(--text-muted)",
              fontSize: "0.75rem", fontFamily: "var(--font-display)", fontWeight: 500,
            }}
          >
            <ExternalLink size={12} />
            GitHub
          </a>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)",
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ overflowY: "auto", flex: 1 }}>

        {/* Loading */}
        {loading && (
          <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
            <Loader
              size={22}
              color="var(--accent-orange)"
              style={{ margin: "0 auto 0.75rem", animation: "spin 1s linear infinite" }}
            />
            <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Loading commits…</p>
          </div>
        )}

        {/* Needs token */}
        {!loading && needsToken && (
          <div style={{ padding: "1.5rem 1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <AlertCircle size={15} color="#f97316" />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                GitHub token required
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "1rem" }}>
              The repo is private. Add a Personal Access Token to{" "}
              <code style={{ fontSize: "0.75rem", color: "var(--accent-orange)", background: "rgba(249,115,22,0.1)", padding: "0.1rem 0.3rem", borderRadius: 4 }}>
                .env.local
              </code>
              :
            </p>
            <div style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              borderRadius: 8, padding: "0.625rem 0.875rem", marginBottom: "1rem",
            }}>
              <code style={{ fontSize: "0.75rem", color: "var(--accent-orange)", fontFamily: "monospace", display: "block", lineHeight: 1.6 }}>
                GITHUB_TOKEN=&quot;ghp_your_token_here&quot;
              </code>
            </div>
            <ol style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.7, paddingLeft: "1.25rem", margin: 0 }}>
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-orange)", textDecoration: "none" }}
                >
                  github.com/settings/tokens
                </a>
              </li>
              <li>Select <strong style={{ color: "var(--text-primary)" }}>Fine-grained token</strong></li>
              <li>Give it <strong style={{ color: "var(--text-primary)" }}>Contents: Read-only</strong> on this repo</li>
              <li>Paste it in <code style={{ fontSize: "0.75rem", color: "var(--accent-orange)", background: "rgba(249,115,22,0.1)", padding: "0.1rem 0.3rem", borderRadius: 4 }}>.env.local</code> and restart</li>
            </ol>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
            <AlertCircle size={22} color="#ef4444" style={{ margin: "0 auto 0.625rem" }} />
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{error}</p>
          </div>
        )}

        {/* Commits */}
        {!loading && !error && commits.map((c, i) => {
          const isOpen = expanded === c.sha;
          const shortSha = c.sha.slice(0, 7);

          return (
            <div
              key={c.sha}
              style={{
                borderBottom: i < commits.length - 1
                  ? "1px solid var(--border-subtle)"
                  : "none",
              }}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : c.sha)}
                style={{
                  width: "100%", textAlign: "left",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "0.875rem 1rem",
                  display: "flex", gap: "0.75rem", alignItems: "flex-start",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                {/* Dot / line */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 0, flexShrink: 0, marginTop: 4,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--accent-orange)",
                    border: "2px solid rgba(249,115,22,0.3)",
                    flexShrink: 0,
                  }} />
                  {i < commits.length - 1 && (
                    <div style={{
                      width: 1,
                      height: 28,
                      background: "var(--border-subtle)",
                      marginTop: 3,
                    }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <p style={{
                    fontFamily: "var(--font-display)", fontWeight: 600,
                    fontSize: "0.8125rem", color: "var(--text-primary)",
                    lineHeight: 1.35, margin: 0,
                    wordBreak: "break-word",
                  }}>
                    {c.title}
                  </p>

                  {/* Meta */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    marginTop: "0.3rem", flexWrap: "wrap",
                  }}>
                    <span style={{
                      fontFamily: "var(--font-body)", fontSize: "0.6875rem",
                      color: "var(--text-muted)", flexShrink: 0,
                    }}>
                      {c.author}
                    </span>
                    <span style={{ color: "var(--border-subtle)", fontSize: "0.6875rem" }}>·</span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", flexShrink: 0 }}>
                      {timeAgo(c.date)}
                    </span>
                    <span style={{ color: "var(--border-subtle)", fontSize: "0.6875rem" }}>·</span>
                    <code style={{
                      fontSize: "0.625rem", color: "var(--accent-orange)",
                      background: "rgba(249,115,22,0.1)",
                      padding: "0.0625rem 0.3rem", borderRadius: 4,
                      fontFamily: "monospace",
                    }}>
                      {shortSha}
                    </code>
                  </div>

                  {/* Expanded description */}
                  {isOpen && c.description && (
                    <p style={{
                      marginTop: "0.5rem",
                      fontSize: "0.8rem", color: "var(--text-secondary)",
                      lineHeight: 1.55, whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 6, padding: "0.5rem 0.625rem",
                    }}>
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
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "0.25rem",
                        marginTop: "0.5rem",
                        fontSize: "0.75rem", color: "var(--accent-orange)",
                        textDecoration: "none", fontFamily: "var(--font-display)", fontWeight: 500,
                      }}
                    >
                      <ExternalLink size={11} />
                      View on GitHub
                    </a>
                  )}
                </div>

                {/* Expand indicator */}
                {c.description && (
                  <span style={{
                    color: "var(--text-muted)", fontSize: "0.625rem",
                    flexShrink: 0, marginTop: 5,
                    transform: isOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s",
                    display: "inline-block",
                  }}>
                    ▾
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {!loading && !error && commits.length === 0 && (
          <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
            <Bell size={22} color="var(--text-muted)" style={{ margin: "0 auto 0.625rem" }} />
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>No commits found.</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default NotificationsPanel;
