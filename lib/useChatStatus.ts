"use client";

import { useState, useEffect, useRef } from "react";

export function useChatStatus(isOpen: boolean) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  const lastSeenRef = useRef<string | null>(null);

  // Init lastSeen from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("chatLastSeen");
    lastSeenRef.current = stored ?? new Date().toISOString();
    if (!stored) sessionStorage.setItem("chatLastSeen", lastSeenRef.current);
  }, []);

  // When chat opens: mark all as read
  useEffect(() => {
    if (!isOpen) return;
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    sessionStorage.setItem("chatLastSeen", now);
    setHasUnread(false);
  }, [isOpen]);

  // Poll presence every 30s
  useEffect(() => {
    const fetch_ = () =>
      fetch("/api/presence")
        .then((r) => r.json())
        .then((d: { count?: number }) => setOnlineCount(d.count ?? 0))
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 30_000);
    return () => clearInterval(t);
  }, []);

  // Poll for new messages while chat is closed
  useEffect(() => {
    if (isOpen) return;
    const check = () => {
      if (!lastSeenRef.current) return;
      fetch(`/api/chat-messages?since=${encodeURIComponent(lastSeenRef.current)}&limit=1`)
        .then((r) => r.json())
        .then((msgs: unknown[]) => {
          if (Array.isArray(msgs) && msgs.length > 0) setHasUnread(true);
        })
        .catch(() => {});
    };
    const t = setInterval(check, 8_000);
    return () => clearInterval(t);
  }, [isOpen]);

  return { onlineCount, hasUnread };
}
