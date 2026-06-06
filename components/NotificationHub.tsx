"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, MessageCircle, Radio, Film, FileText, Swords, Gamepad2 } from "lucide-react";
import { BADGE_DEFS } from "@/lib/badges";
import UserAvatar from "./UserAvatar";
import type { NotifEvent, MatchGame } from "@/lib/notifications-sse";
import type { ActiveGame } from "@/app/api/active-games/route";

/* ─── Types ─── */

type BadgeToast   = NotifEvent & { type: "badge" };
type DMToast      = NotifEvent & { type: "dm" };
type StreamToast  = NotifEvent & { type: "stream_live" };
type MatchToast   = NotifEvent & { type: "match_result" };

type ContentToast =
  | { kind: "post";  id: string; title: string; authorName: string | null; authorImage: string | null; authorTier: string; createdAt: string }
  | { kind: "video"; id: string; title: string; authorName: string | null; authorImage: string | null; authorTier: string; createdAt: string };

type NewsToast = { id: string; title: string; createdAt: string };
type PopupToast = { id: string; text: string; emoji: string; color: string };

type AnyToast =
  | { _key: string; _tag: "badge";       data: BadgeToast }
  | { _key: string; _tag: "dm";          data: DMToast }
  | { _key: string; _tag: "stream";      data: StreamToast }
  | { _key: string; _tag: "content";     data: ContentToast }
  | { _key: string; _tag: "match";       data: MatchToast }
  | { _key: string; _tag: "active_game"; data: ActiveGame }
  | { _key: string; _tag: "news";        data: NewsToast }
  | { _key: string; _tag: "popup";       data: PopupToast };

const GAME_META: Record<MatchGame, { icon: string; label: string; color: string }> = {
  chess:       { icon: "♟️", label: "Chess",       color: "#f59e0b" },
  checkers:    { icon: "🔴", label: "Checkers",    color: "#8b5cf6" },
  billiards:   { icon: "🎱", label: "Billiards",   color: "#10b981" },
  battleship:  { icon: "🚢", label: "Battleship",  color: "#0ea5e9" },
};

const OUTCOME_META: Record<"win" | "loss" | "draw", { label: string; color: string }> = {
  win:  { label: "Victory!",  color: "#22c55e" },
  loss: { label: "Defeat",    color: "#ef4444" },
  draw: { label: "Draw",      color: "#6b7280" },
};

const REASON_LABELS: Record<string, string> = {
  checkmate:         "by checkmate",
  stalemate:         "draw by stalemate",
  timeout:           "on time",
  resigned:          "by resignation",
  no_moves:          "no legal moves",
  all_sunk:          "all ships sunk",
  pocketed_eight:    "8-ball pocketed",
  scratch_on_eight:  "scratch on 8-ball",
  wrong_eight_pocket:"wrong pocket for 8",
  eight_on_break:    "8-ball on break",
};

function gameRoomUrl(game: MatchGame, roomId: string): string {
  return `/games/${game}/online/${roomId}`;
}

function fmtTimeLeft(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

/* ─── Constants ─── */

const BADGE_SEEN_KEY          = "lh_badge_seen_at";
const ACTIVE_GAME_SESSION_KEY = "lh_active_game_notified";
const DM_SEEN_KEY             = "lh_dm_seen_at";
const CONTENT_SEEN_KEY        = "lh_content_seen_at";
const NEWS_SEEN_KEY           = "lh_news_seen_at";
const AUTO_DISMISS_MS         = 7000;
const DM_FALLBACK_MS          = 30_000;
const CONTENT_POLL_MS         = 5 * 60_000;
// Random interval for pop-up messages: 10–25 minutes
const POPUP_MIN_MS            = 10 * 60_000;
const POPUP_RANGE_MS          = 15 * 60_000;

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
        {/* Author avatar or fallback Radio icon */}
        {data.authorImage ? (
          <div className="relative shrink-0">
            <img src={data.authorImage} alt="" className="w-11 h-11 rounded-xl object-cover" />
            <span className="absolute -bottom-1 -right-1 bg-[#ef4444] rounded-full p-0.5">
              <Radio size={10} className="text-white" />
            </span>
          </div>
        ) : (
          <div
            className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: "#ef444418", border: "1.5px solid #ef444440" }}
          >
            <Radio size={22} className="text-[#ef4444]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[#f87171] mb-[0.1rem]">
            🔴 Live now{data.authorName ? ` · ${data.authorName}` : ""}
          </p>
          <p className="font-display font-extrabold text-[0.9rem] text-[var(--text-primary)] truncate">
            {data.title}
          </p>
          <p className="text-[0.65rem] text-[var(--text-muted)] mt-0.5">
            {data.viewerCount} watching · {data.likeCount} likes
          </p>
        </div>
      </Link>
    </ToastShell>
  );
}

function MatchResultToastItem({ data, onDone }: { data: MatchToast; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  const gm      = GAME_META[data.game];
  const outcome = OUTCOME_META[data.outcome];
  const reason  = REASON_LABELS[data.reason] ?? data.reason;

  return (
    <ToastShell color={outcome.color} leaving={leaving} onClose={dismiss}>
      <Link
        href={gameRoomUrl(data.game, data.roomId)}
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[1.4rem] relative"
          style={{ background: `${gm.color}18`, border: `1.5px solid ${gm.color}40` }}
        >
          {gm.icon}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[var(--bg-card)]"
            style={{ background: outcome.color }}
          >
            <Swords size={8} className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p
            className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] mb-[0.1rem]"
            style={{ color: outcome.color }}
          >
            {outcome.label}
          </p>
          <p className="font-display font-extrabold text-[0.875rem] text-[var(--text-primary)] truncate">
            {gm.label}{data.opponentName ? ` · vs ${data.opponentName}` : ""}
          </p>
          <p className="text-[0.75rem] text-[var(--text-muted)] truncate">{reason} · tap to view</p>
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

function ActiveGameToastItem({ data, onDone }: { data: ActiveGame; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    data.expiresAt !== null ? Math.max(0, data.expiresAt - Date.now()) : 5 * 60_000,
  );
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  useEffect(() => {
    const id = setInterval(() => {
      const left = data.expiresAt !== null ? Math.max(0, data.expiresAt - Date.now()) : 0;
      setTimeLeft(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [data.expiresAt]);

  const urgent = timeLeft < 60_000;
  const color  = urgent ? "#ef4444" : "#f97316";

  return (
    <ToastShell color={color} leaving={leaving} onClose={dismiss}>
      <Link
        href={data.url}
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[1.5rem] relative"
          style={{ background: `${color}18`, border: `1.5px solid ${color}40` }}
        >
          {data.icon}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[var(--bg-card)]"
            style={{ background: color }}
          >
            <Gamepad2 size={8} className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] mb-[0.1rem]" style={{ color }}>
            Active game!
          </p>
          <p className="font-display font-extrabold text-[0.875rem] text-[var(--text-primary)] truncate">
            {data.label}{data.opponentName ? ` · vs ${data.opponentName}` : ""}
          </p>
          <p className="text-[0.75rem] truncate" style={{ color: urgent ? "#f87171" : "var(--text-muted)" }}>
            {timeLeft > 0 ? `Forfeits in ${fmtTimeLeft(timeLeft)}` : "Forfeit imminent"} · tap to return
          </p>
        </div>
      </Link>
    </ToastShell>
  );
}

function NewsToastItem({ data, onDone }: { data: NewsToast; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  return (
    <ToastShell color="#f97316" leaving={leaving} onClose={dismiss}>
      <Link
        href={`/news/${data.id}`}
        onClick={dismiss}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 no-underline"
      >
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[1.4rem]"
          style={{ background: "#f9731618", border: "1.5px solid #f9731640" }}
        >
          📰
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] text-[var(--accent-orange)] mb-[0.1rem]">
            Site announcement
          </p>
          <p className="font-display font-extrabold text-[0.875rem] text-[var(--text-primary)] truncate">
            {data.title}
          </p>
          <p className="text-[0.7rem] text-[var(--text-muted)]">Tap to read →</p>
        </div>
      </Link>
    </ToastShell>
  );
}

function PopupToastItem({ data, onDone }: { data: PopupToast; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => { setLeaving(true); setTimeout(onDone, 320); };
  useAutoDismiss(dismiss);

  return (
    <ToastShell color={data.color} leaving={leaving} onClose={dismiss}>
      <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3">
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[1.5rem]"
          style={{ background: `${data.color}18`, border: `1.5px solid ${data.color}40` }}
        >
          {data.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.6875rem] font-display font-bold uppercase tracking-[0.06em] mb-[0.1rem]"
            style={{ color: data.color }}
          >
            From LightHouse
          </p>
          <p className="font-display font-semibold text-[0.875rem] text-[var(--text-primary)] leading-snug">
            {data.text}
          </p>
        </div>
      </div>
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

  /* ── Active games check (once per session) ── */
  const checkActiveGames = useCallback(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(ACTIVE_GAME_SESSION_KEY)) return;
    fetch("/api/active-games")
      .then(r => r.json())
      .then((games: ActiveGame[]) => {
        if (!Array.isArray(games) || games.length === 0) return;
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(ACTIVE_GAME_SESSION_KEY, "1");
        games.forEach(g => addToast({ _key: `active-${g.game}-${g.roomId}`, _tag: "active_game", data: g }));
      })
      .catch(() => {});
  }, [addToast]);

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
          } else if (event.type === "match_result") {
            addToast({ _key: `match-${event.game}-${event.roomId}`, _tag: "match", data: event });
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
      checkActiveGames();
    }, 1000);
    return () => clearTimeout(t);
  }, [status, checkBadges, checkDMs, checkActiveGames]);

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

  /* ── News announcements check ── */
  const checkNews = useCallback(() => {
    const seenAt = localStorage.getItem(NEWS_SEEN_KEY) ?? "0";
    fetch(`/api/notifications/news?since=${seenAt}`)
      .then(r => r.json())
      .then((posts: { id: string; title: string; createdAt: string }[]) => {
        if (!Array.isArray(posts) || posts.length === 0) return;
        const latest = posts.reduce((m, x) =>
          new Date(x.createdAt) > new Date(m.createdAt) ? x : m
        );
        localStorage.setItem(NEWS_SEEN_KEY, String(new Date(latest.createdAt).getTime()));
        posts.forEach(p => addToast({
          _key: `news-${p.id}`,
          _tag: "news",
          data: { id: p.id, title: p.title, createdAt: p.createdAt },
        }));
      })
      .catch(() => {});
  }, [addToast]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Check once on mount (with delay so it doesn't fire immediately on login)
    const t = setTimeout(checkNews, 3000);
    return () => clearTimeout(t);
  }, [status, checkNews]);

  /* ── Random pop-up messages ── */
  useEffect(() => {
    if (status !== "authenticated") return;
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = POPUP_MIN_MS + Math.random() * POPUP_RANGE_MS;
      timeoutId = setTimeout(() => {
        fetch("/api/notifications/random-message")
          .then(r => r.json())
          .then((msg: { id: string; text: string; emoji: string; color: string } | null) => {
            if (msg?.id) {
              addToast({ _key: `popup-${msg.id}-${Date.now()}`, _tag: "popup", data: msg });
            }
          })
          .catch(() => {})
          .finally(scheduleNext);
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [status, addToast]);

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
          {toast._tag === "match" && (
            <MatchResultToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
          {toast._tag === "active_game" && (
            <ActiveGameToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
          {toast._tag === "news" && (
            <NewsToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
          {toast._tag === "popup" && (
            <PopupToastItem data={toast.data} onDone={() => removeToast(toast._key)} />
          )}
        </div>
      ))}
    </div>
  );
}
