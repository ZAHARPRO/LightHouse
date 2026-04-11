"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, MessageSquare, Maximize2, Users } from "lucide-react";

type Sub = { id: string; name: string; tier: string };

const TIER_COLORS: Record<string, string> = {
  FREE: "#888", BASIC: "#818cf8", PRO: "#f97316", ELITE: "#fbbf24",
};

const SUB_COLORS = [
  "#f97316", "#6366f1", "#10b981", "#fbbf24",
  "#ef4444", "#818cf8", "#ec4899", "#14b8a6",
];

interface Props {
  onClose: () => void;
  isClosing: boolean;
  onOpenChat: () => void;
}

export default function SideDrawer({ onClose, isClosing, onOpenChat }: Props) {
  const [subs, setSubs]       = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/my-subscriptions")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setSubs(data) : setSubs([]))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, []);

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX <= rect.right + 5) return; // 5px right buffer
    leaveTimer.current = setTimeout(onClose, 150);
  }
  function handleMouseEnter() {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 499,
          background: "rgba(0,0,0,0.35)",
          animation: isClosing ? "fadeOut 0.18s ease both" : "fadeInBg 0.18s ease both",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        style={{
          position: "fixed",
          left: 0, top: 0,
          width: 280,
          height: "100vh",
          zIndex: 500,
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "6px 0 40px rgba(0,0,0,0.5)",
          animation: isClosing
            ? "slideOutLeft 0.18s ease both"
            : "slideInLeft 0.2s ease both",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1rem",
          height: 64,
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-elevated)",
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem",
            color: "var(--text-primary)", letterSpacing: "-0.02em",
          }}>
            Light<span style={{ color: "var(--accent-orange)" }}>House</span>
          </span>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Chat button */}
        <div style={{ padding: "1rem 0.875rem 0.5rem" }}>
          <div
            onClick={onOpenChat}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.625rem 0.875rem",
              borderRadius: 10,
              background: "rgba(249,115,22,0.07)",
              border: "1px solid rgba(249,115,22,0.2)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "rgba(249,115,22,0.15)", border: "2px solid rgba(249,115,22,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MessageSquare size={16} color="var(--accent-orange)" />
              </div>
              <span style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem",
                color: "var(--text-primary)",
              }}>
                Global Chat
              </span>
            </div>
            <Link
              href="/chat"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              title="Open full chat"
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                display: "flex", alignItems: "center", justifyContent: "center",
                textDecoration: "none", color: "var(--text-secondary)",
              }}
            >
              <Maximize2 size={13} />
            </Link>
          </div>
        </div>

        {/* Subscriptions */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.875rem 1rem" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            marginBottom: "0.625rem", padding: "0 0.25rem",
          }}>
            <Users size={12} color="var(--text-muted)" />
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.6875rem",
              color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              Subscriptions
            </span>
          </div>

          {loading && (
            <div style={{ padding: "1rem 0.25rem" }}>
              {[1,2,3].map((n) => (
                <div key={n} style={{
                  display: "flex", gap: "0.625rem", alignItems: "center",
                  padding: "0.375rem 0.25rem", marginBottom: "0.25rem",
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg-elevated)" }} />
                  <div style={{ width: 80, height: 12, borderRadius: 4, background: "var(--bg-elevated)" }} />
                </div>
              ))}
            </div>
          )}

          {!loading && subs.length === 0 && (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", padding: "0.5rem 0.25rem", lineHeight: 1.5 }}>
              No subscriptions yet.{" "}
              <Link href="/feed" onClick={onClose} style={{ color: "var(--accent-orange)", textDecoration: "none" }}>
                Discover creators
              </Link>
            </p>
          )}

          {!loading && subs.map((sub, i) => {
            const color = SUB_COLORS[i % SUB_COLORS.length];
            const initials = (sub.name)
              .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link
                key={sub.id}
                href={`/profile/${sub.id}`}
                onClick={onClose}
                className="sidebar-sub-link"
                style={{
                  display: "flex", alignItems: "center", gap: "0.625rem",
                  padding: "0.375rem 0.25rem", borderRadius: 8,
                  textDecoration: "none", transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: `${color}22`, border: `1.5px solid ${color}50`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.625rem", fontWeight: 700, color,
                  fontFamily: "var(--font-display)",
                }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                    color: "var(--text-primary)", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {sub.name}
                  </p>
                  <p style={{
                    fontSize: "0.6875rem", fontWeight: 600,
                    color: TIER_COLORS[sub.tier] ?? "#888",
                  }}>
                    {sub.tier.charAt(0) + sub.tier.slice(1).toLowerCase()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
