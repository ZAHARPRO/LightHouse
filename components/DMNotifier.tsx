"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, MessageCircle } from "lucide-react";
import UserAvatar from "./UserAvatar";

const STORAGE_KEY = "lh_dm_seen_at";
const AUTO_DISMISS_MS = 6000;
const POLL_MS = 15_000;

type DMToast = {
  id: string;
  convId: string;
  senderName: string | null;
  senderImage: string | null;
  senderTier: string;
  content: string;
  createdAt: string;
};

function ToastItem({ item, onDone }: { item: DMToast; onDone: () => void }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function dismiss() {
    setLeaving(true);
    setTimeout(onDone, 320);
  }

  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = item.content.length > 60
    ? item.content.slice(0, 60) + "…"
    : item.content;

  return (
    <div
      className="relative flex items-center gap-3 w-[300px] sm:w-[320px] rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
      style={{
        background: "var(--bg-card)",
        border: "1.5px solid rgba(99,102,241,0.25)",
        animation: leaving
          ? "slideOutRight 0.32s ease both"
          : "slideInRight 0.32s ease both",
      }}
    >
      {/* Countdown bar */}
      <div
        className="absolute bottom-0 left-0 h-[3px] rounded-b-2xl"
        style={{
          background: "linear-gradient(90deg, #6366f1, #6366f188)",
          animation: `badgeProgress ${AUTO_DISMISS_MS}ms linear forwards`,
        }}
      />

      {/* Clickable area → DM conversation */}
      <button
        onClick={() => { dismiss(); router.push(`/dm/${item.convId}`); }}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left bg-transparent border-none cursor-pointer"
      >
        <div className="relative shrink-0">
          <UserAvatar
            image={item.senderImage}
            name={item.senderName ?? "?"}
            tier={item.senderTier}
            size="md"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6366f1] flex items-center justify-center border-2 border-[var(--bg-card)]">
            <MessageCircle size={8} className="text-white" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[#818cf8] mb-[0.1rem]">
            New message
          </p>
          <p className="font-display font-extrabold text-[0.875rem] text-[var(--text-primary)] truncate">
            {item.senderName ?? "Someone"}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)] truncate">
            {preview}
          </p>
        </div>
      </button>

      {/* Close */}
      <button
        onClick={dismiss}
        className="shrink-0 w-7 h-7 mr-3 rounded-lg flex items-center justify-center cursor-pointer bg-transparent border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors duration-150"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function DMNotifier() {
  const [queue, setQueue] = useState<DMToast[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function check() {
    const seenAt = localStorage.getItem(STORAGE_KEY) ?? "0";
    fetch(`/api/dm/unread?since=${seenAt}`)
      .then((r) => r.json())
      .then((data: { id: string; conversationId: string; content: string; createdAt: string; sender: { id: string; name: string | null; image: string | null; tier: string } }[]) => {
        if (!Array.isArray(data) || data.length === 0) return;

        // Advance the seen cursor to the latest message we got
        const latest = data.reduce((max, m) =>
          new Date(m.createdAt) > new Date(max.createdAt) ? m : max
        );
        localStorage.setItem(STORAGE_KEY, String(new Date(latest.createdAt).getTime()));

        const toasts: DMToast[] = data.map((m) => ({
          id: m.id,
          convId: m.conversationId,
          senderName: m.sender.name,
          senderImage: m.sender.image,
          senderTier: m.sender.tier,
          content: m.content,
          createdAt: m.createdAt,
        }));

        setQueue((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const fresh = toasts.filter((t) => !existingIds.has(t.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      })
      .catch(() => {});
  }

  useEffect(() => {
    // Small delay so localStorage is available and page is settled
    const first = setTimeout(check, 1500);
    pollingRef.current = setInterval(check, POLL_MS);
    return () => {
      clearTimeout(first);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="fixed top-[76px] right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {queue.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastItem
            item={item}
            onDone={() => setQueue((prev) => prev.filter((t) => t.id !== item.id))}
          />
        </div>
      ))}
    </div>
  );
}
