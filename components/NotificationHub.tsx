"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, MessageCircle, Radio, Film, FileText } from "lucide-react";
import { BADGE_DEFS } from "@/lib/badges";
import UserAvatar from "./UserAvatar";
import type { NotifEvent } from "@/lib/notifications-sse";

/* ─── Types ─── */

type BadgeToast = NotifEvent & { type: "badge" };
type DMToast    = NotifEvent & { type: "dm" };
type StreamToast = NotifEvent & { type: "stream_live" };

type ContentToast =
  | { kind: "post";  id: string; title: string; authorName: string | null; authorImage: string | null; authorTier: string; createdAt: string }
  | { kind: "video"; id: string; title: string; authorName: string | null; authorImage: string | null; authorTier: string; createdAt: string };

type AnyToast =
  | { _key: string; _tag: "badge";  data: BadgeToast }
  | { _key: string; _tag: "dm";     data: DMToast }
  | { _key: string; _tag: "stream"; data: StreamToast }
  | { _key: string; _tag: "content"; data: ContentToast };

/* ─── Constants ─── */

const BADGE_SEEN_KEY   = "lh_badge_seen_at";
const DM_SEEN_KEY      = "lh_dm_seen_at";
const CONTENT_SEEN_KEY = "lh_content_seen_at";
const AUTO_DISMISS_MS  = 7000;
const DM_FALLBACK_MS   = 30_000;
const CONTENT_POLL_MS  = 5 * 60_000;

const BADGE_META = Object.fromEntries(
  Object.entries(BADGE_DEFS).map(([type, d]) => [type, { icon: d.icon, color: d.color, label: d.label }])
);

/* ─── Individual toast renderers ─── */

function useAutoDismiss(dismiss: () => void) {
  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function ToastShell({
  color,
  leaving,
  children,
  onClose,
}: {
  color: string;
  leaving: boolean;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="relative flex items-center gap-3 w-[300px] sm:w-[320px] rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
      style={{
        background: "var(--bg-card)",
        border: `1.5px solid ${color}35`,
        animation: leaving ? "slideOutRight 0.32s ease both" : "slideInRight 0.32s ease both",
      }}
    >
      <div
        className="absolute bottom-0 left-0 h-[3px] rounded-b-2xl"
        style={{
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          animation: `badgeProgress ${AUTO_DISMISS_MS}ms linear forwards`,
        }}
      />
      {children}
      <button
        onClick={onClose}
        className="shrink-0 w-7 h-7 mr-3 rounded-lg flex items-center justify-center cursor-pointer bg-transparent border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors duration-150"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function BadgeToastItem({ data, onDone }: { data: BadgeToast; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const meta = BADGE_META[data.rewardType] ?? { icon: "🎖️", color: "#f97316", label: data.rewardType };
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  return (
    <ToastShell color={meta.color} leaving={leaving} onClose={dismiss}>
      <Link
        href="/profile?tab=badges"
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[1.5rem]"
          style={{ background: `${meta.color}18`, border: `1.5px solid ${meta.color}40` }}
        >
          {meta.icon}
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[var(--accent-orange)] mb-[0.1rem]">
            Badge earned!
          </p>
          <p className="font-display font-extrabold text-[0.9rem] text-[var(--text-primary)] truncate">
            {meta.label}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)] truncate">
            +{data.pointsValue} pts · {data.description}
          </p>
        </div>
      </Link>
    </ToastShell>
  );
}

function DMToastItem({ data, onDone }: { data: DMToast; onDone: () => void }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);
  const preview = data.content.length > 60 ? data.content.slice(0, 60) + "…" : data.content;

  return (
    <ToastShell color="#6366f1" leaving={leaving} onClose={dismiss}>
      <button
        onClick={() => { dismiss(); router.push(`/dm/${data.convId}`); }}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left bg-transparent border-none cursor-pointer"
      >
        <div className="relative shrink-0">
          <UserAvatar image={data.senderImage} name={data.senderName ?? "?"} tier={data.senderTier} size="md" />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6366f1] flex items-center justify-center border-2 border-[var(--bg-card)]">
            <MessageCircle size={8} className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[#818cf8] mb-[0.1rem]">
            New message
          </p>
          <p className="font-display font-extrabold text-[0.875rem] text-[var(--text-primary)] truncate">
            {data.senderName ?? "Someone"}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)] truncate">{preview}</p>
        </div>
      </button>
    </ToastShell>
  );
}

function StreamToastItem({ data, onDone }: { data: StreamToast; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  return (
    <ToastShell color="#ef4444" leaving={leaving} onClose={dismiss}>
      <Link
        href={`/stream/${data.streamId}`}
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
          style={{ background: "#ef444418", border: "1.5px solid #ef444440" }}
        >
          <Radio size={22} className="text-[#ef4444]" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[#f87171] mb-[0.1rem]">
            Live now!
          </p>
          <p className="font-display font-extrabold text-[0.9rem] text-[var(--text-primary)] truncate">
            {data.title}
          </p>
        </div>
      </Link>
    </ToastShell>
  );
}

function ContentToastItem({ data, onDone }: { data: ContentToast; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  const isVideo = data.kind === "video";
  const color   = isVideo ? "#0ea5e9" : "#ec4899";
  const href    = isVideo ? `/video/${data.id}` : `/post/${data.id}`;
  const label   = isVideo ? "New video" : "New post";

  return (
    <ToastShell color={color} leaving={leaving} onClose={dismiss}>
      <Link
        href={href}
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        <div className="relative shrink-0">
          <UserAvatar image={data.authorImage} name={data.authorName ?? "?"} tier={data.authorTier} size="md" />
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[var(--bg-card)]"
            style={{ background: color }}
          >
            {isVideo ? <Film size={8} className="text-white" /> : <FileText size={8} className="text-white" />}
          </div>
        </div>
        <div className="min-w-0">
          <p
            className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] mb-[0.1rem]"
            style={{ color }}
          >
            {label}
          </p>
          <p className="font-display font-extrabold text-[0.875rem] text-[var(--text-primary)] truncate">
            {data.authorName ?? "Creator"}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)] truncate">{data.title}</p>
        </div>
      </Link>
    </ToastShell>
  );
}

/* ─── Main Hub ─── */

export default function NotificationHub() {
  const { status } = useSession();
  const [queue, setQueue] = useState<AnyToast[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const errorCountRef = useRef(0);

  const removeToast = useCallback((key: string) => {
    setQueue(prev => prev.filter(t => t._key !== key));
  }, []);

  const addToast = useCallback((toast: AnyToast) => {
    setQueue(prev => {
      if (prev.some(t => t._key === toast._key)) return prev;
      return [...prev, toast];
    });
  }, []);

  /* ── Badge check ── */
  const checkBadges = useCallback(() => {
    const seenAt = localStorage.getItem(BADGE_SEEN_KEY) ?? "0";
    fetch(`/api/check-new-badges?since=${seenAt}`)
      .then(r => r.json())
      .then((data: { id: string; type: string; pointsValue: number; description: string; earnedAt: string }[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const latest = data[data.length - 1].earnedAt;
        localStorage.setItem(BADGE_SEEN_KEY, String(new Date(latest).getTime()));
        data.forEach(b => addToast({
          _key: `badge-${b.id}`,
          _tag: "badge",
          data: { type: "badge", id: b.id, rewardType: b.type, pointsValue: b.pointsValue, description: b.description, earnedAt: b.earnedAt },
        }));
      })
      .catch(() => {});
  }, [addToast]);

  /* ── DM check ── */
  const checkDMs = useCallback(() => {
    const seenAt = localStorage.getItem(DM_SEEN_KEY) ?? "0";
    fetch(`/api/dm/unread?since=${seenAt}`)
      .then(r => r.json())
      .then((data: { id: string; conversationId: string; content: string; createdAt: string; sender: { name: string | null; image: string | null; tier: string } }[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const latest = data.reduce((m, x) => new Date(x.createdAt) > new Date(m.createdAt) ? x : m);
        localStorage.setItem(DM_SEEN_KEY, String(new Date(latest.createdAt).getTime()));
        data.forEach(m => addToast({
          _key: `dm-${m.id}`,
          _tag: "dm",
          data: { type: "dm", id: m.id, convId: m.conversationId, senderName: m.sender.name, senderImage: m.sender.image, senderTier: m.sender.tier, content: m.content },
        }));
      })
      .catch(() => {});
  }, [addToast]);

  /* ── Content check (posts + videos) ── */
  const checkContent = useCallback(() => {
    const seenAt = localStorage.getItem(CONTENT_SEEN_KEY);
    if (!seenAt) {
      localStorage.setItem(CONTENT_SEEN_KEY, String(Date.now()));
      return;
    }
    const since = new Date(parseInt(seenAt, 10));
    localStorage.setItem(CONTENT_SEEN_KEY, String(Date.now()));

    Promise.all([
      fetch("/api/notifications/posts").then(r => r.json()).catch(() => []),
      fetch("/api/notifications/videos").then(r => r.json()).catch(() => []),
    ]).then(([posts, videos]) => {
      const freshPosts = (posts as { id: string; title: string; createdAt: string; author: { name: string | null; image: string | null; tier: string } }[])
        .filter(p => new Date(p.createdAt) > since);
      const freshVideos = (videos as { id: string; title: string; createdAt: string; author: { name: string | null; image: string | null; tier: string } }[])
        .filter(v => new Date(v.createdAt) > since);

      freshPosts.forEach(p => addToast({
        _key: `post-${p.id}`,
        _tag: "content",
        data: { kind: "post", id: p.id, title: p.title, authorName: p.author.name, authorImage: p.author.image, authorTier: p.author.tier, createdAt: p.createdAt },
      }));
      freshVideos.forEach(v => addToast({
        _key: `video-${v.id}`,
        _tag: "content",
        data: { kind: "video", id: v.id, title: v.title, authorName: v.author.name, authorImage: v.author.image, authorTier: v.author.tier, createdAt: v.createdAt },
      }));
    });
  }, [addToast]);

  /* ── SSE connection ── */
  useEffect(() => {
    if (status !== "authenticated") return;

    function connect() {
      const es = new EventSource("/api/notifications/sse");
      esRef.current = es;

      es.onopen = () => { errorCountRef.current = 0; };

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as NotifEvent;
          if (event.type === "badge") {
            const seenAt = localStorage.getItem(BADGE_SEEN_KEY) ?? "0";
            if (new Date(event.earnedAt).getTime() > parseInt(seenAt, 10)) {
              localStorage.setItem(BADGE_SEEN_KEY, String(new Date(event.earnedAt).getTime()));
            }
            addToast({ _key: `badge-${event.id}`, _tag: "badge", data: event });
          } else if (event.type === "dm") {
            const now = String(Date.now());
            localStorage.setItem(DM_SEEN_KEY, now);
            addToast({ _key: `dm-${event.id}`, _tag: "dm", data: event });
          } else if (event.type === "stream_live") {
            addToast({ _key: `stream-${event.streamId}`, _tag: "stream", data: event });
          }
        } catch { }
      };

      es.onerror = () => {
        errorCountRef.current += 1;
        if (errorCountRef.current >= 5) {
          es.close();
          esRef.current = null;
        }
      };
    }

    connect();
    return () => { esRef.current?.close(); esRef.current = null; };
  }, [status, addToast]);

  /* ── Initial checks on mount ── */
  useEffect(() => {
    if (status !== "authenticated") return;
    const t = setTimeout(() => {
      checkBadges();
      checkDMs();
    }, 1000);
    return () => clearTimeout(t);
  }, [status, checkBadges, checkDMs]);

  /* ── Fallback DM poll ── */
  useEffect(() => {
    if (status !== "authenticated") return;
    const t = setInterval(checkDMs, DM_FALLBACK_MS);
    return () => clearInterval(t);
  }, [status, checkDMs]);

  /* ── Content poll ── */
  useEffect(() => {
    if (status !== "authenticated") return;
    const t = setInterval(checkContent, CONTENT_POLL_MS);
    return () => clearInterval(t);
  }, [status, checkContent]);

  /* ── Re-check on focus ── */
  useEffect(() => {
    if (status !== "authenticated") return;
    function onFocus() { checkBadges(); checkDMs(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, checkBadges, checkDMs]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed top-[76px] right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {queue.map(toast => (
        <div key={toast._key} className="pointer-events-auto">
          {toast._tag === "badge" && (
            <BadgeToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
          {toast._tag === "dm" && (
            <DMToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
          {toast._tag === "stream" && (
            <StreamToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
          {toast._tag === "content" && (
            <ContentToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
        </div>
      ))}
    </div>
  );
}
