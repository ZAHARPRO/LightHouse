"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Zap, Bell, User, Search, LogOut, Menu, X, Plus, Video, FileText, Inbox, LayoutDashboard, Play, Users, Music2,
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import SideDrawer from "./SideDrawer";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import ChatPopup from "./ChatPopup";
import SupportInbox from "./SupportInbox";
import MusicPlayer from "./MusicPlayer";
import { useTranslations } from "next-intl";

const STAFF_ROLES = ["ADMIN", "OPERATOR", "STAFF"];

export default function Navbar() {
  const { data: session } = useSession();
  const isStaff = session?.user?.role && STAFF_ROLES.includes(session.user.role);
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");

  const router = useRouter();
  const [searchQ, setSearchQ]       = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const searchRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type Suggestion = {
    type: "video" | "creator" | "post";
    id: string; label: string; sub: string | null; href: string;
    image?: string | null; tier?: string;
  };


  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      router.push(suggestions[activeIdx].href);
      closeSuggest();
      return;
    }
    if (q) { router.push(`/search?q=${encodeURIComponent(q)}`); closeSuggest(); }
  }

  function closeSuggest() { setSuggestOpen(false); setActiveIdx(-1); }

  function handleSearchChange(val: string) {
    setSearchQ(val);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); setSuggestOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(val.trim())}`).then(r => r.json()).catch(() => []);
      setSuggestions(res);
      setSuggestOpen(res.length > 0);
    }, 220);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!suggestOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === "Escape")    { closeSuggest(); }
  }

  useEffect(() => {
    if (!suggestOpen) return;
    function onDown(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) closeSuggest();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestOpen]);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    video:   <Play size={13} className="shrink-0 text-[var(--accent-orange)]" />,
    creator: <Users size={13} className="shrink-0 text-[#6366f1]" />,
    post:    <FileText size={13} className="shrink-0 text-[#10b981]" />,
  };
  const TYPE_LABEL: Record<string, string> = { video: "Video", creator: "Creator", post: "Post" };

  const [mobileOpen, setMobileOpen] = useState(false);

  // Side drawer
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);

  function openDrawer()  { if (!drawerClosing) setDrawerOpen(true); }
  function closeDrawer() {
    if (!drawerOpen) return;
    setDrawerClosing(true);
    setTimeout(() => { setDrawerOpen(false); setDrawerClosing(false); }, 180);
  }
  function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer(); }

  // Spotify player
  const [spotifyOpen, setSpotifyOpen] = useState(false);

  // Chat popup
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatClosing, setChatClosing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  function openChat() { closeDrawer(); setChatOpen(true); }
  function closeChat() {
    if (!chatOpen) return;
    setChatClosing(true);
    setTimeout(() => { setChatOpen(false); setChatClosing(false); }, 180);
  }

  useEffect(() => {
    if (!chatOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (chatRef.current?.contains(e.target as Node)) return;
      closeChat();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [chatOpen]);

  // Create dropdown
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!createOpen) return;
    function onDown(e: MouseEvent) {
      if (!createRef.current?.contains(e.target as Node)) setCreateOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [createOpen]);

  // Notifications
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifClosing, setNotifClosing] = useState(false);
  const [hasNew, setHasNew]             = useState(false);
  const bellRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const storageKey = `lh_last_seen_commit_${session?.user?.id ?? "guest"}`;

  // Dates of static site-news items — keep in sync with NotificationsPanel
  const SITE_NEWS_DATES = ["2026-04-13", "2026-04-12"];

  // Background unread check — runs on mount and whenever session changes.
  // Does NOT require the panel to be open.
  useEffect(() => {
    const siteNewsSeenAt = parseInt(localStorage.getItem("lh_notif_sitenews_seen") ?? "0", 10);
    const devNewsSeenAt  = parseInt(localStorage.getItem("lh_notif_devnews_seen")  ?? "0", 10);
    const postsSeenAt    = parseInt(localStorage.getItem("lh_notif_posts_seen")    ?? "0", 10);
    const videosSeenAt   = parseInt(localStorage.getItem("lh_notif_videos_seen")   ?? "0", 10);

    // 1. Check static site news immediately (no fetch needed)
    const siteNewsUnread = SITE_NEWS_DATES.some(
      (d) => new Date(d).getTime() > siteNewsSeenAt
    );
    if (siteNewsUnread) { setHasNew(true); return; }

    // 2. Fetch the rest in background
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    Promise.all([
      fetch("/api/github-commits").then((r) => r.json()).catch(() => []),
      fetch("/api/notifications/posts").then((r) => r.json()).catch(() => []),
      fetch("/api/notifications/videos").then((r) => r.json()).catch(() => []),
    ]).then(([commits, posts, videos]) => {
      const unread =
        (Array.isArray(commits) && commits.some(
          (c: { date: string }) =>
            new Date(c.date).getTime() > devNewsSeenAt &&
            new Date(c.date).getTime() >= weekAgo
        )) ||
        (Array.isArray(posts) && posts.some(
          (p: { createdAt: string }) => new Date(p.createdAt).getTime() > postsSeenAt
        )) ||
        (Array.isArray(videos) && videos.some(
          (v: { createdAt: string }) => new Date(v.createdAt).getTime() > videosSeenAt
        ));
      setHasNew(unread);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (!notifOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        bellRef.current?.contains(e.target as Node)
      ) return;
      closeNotif();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  // Called by NotificationsPanel when commits load — used to mark SHA as seen
  function handleCommitsLoaded(latestSha: string | null) {
    if (!latestSha) return;
    localStorage.setItem(storageKey, latestSha);
  }

  function openNotif()  { if (!notifClosing) setNotifOpen(true); }
  function closeNotif() {
    if (!notifOpen) return;
    setNotifClosing(true);
    setTimeout(() => { setNotifOpen(false); setNotifClosing(false); }, 180);
  }
  function toggleNotif() { notifOpen ? closeNotif() : openNotif(); }

  // Support inbox (staff only)
  const [inboxOpen, setInboxOpen]       = useState(false);
  const [inboxClosing, setInboxClosing] = useState(false);
  const [hasNewTickets, setHasNewTickets] = useState(false);
  const inboxBtnRef = useRef<HTMLButtonElement>(null);
  const inboxPanelRef = useRef<HTMLDivElement>(null);

  // Background unread-ticket check for staff
  useEffect(() => {
    if (!isStaff) return;
    function check() {
      fetch("/api/support/unread")
        .then((r) => r.json())
        .then((d) => setHasNewTickets((d?.count ?? 0) > 0))
        .catch(() => {});
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [isStaff]);

  function openInbox()  { if (!inboxClosing) setInboxOpen(true); }
  function closeInbox() {
    if (!inboxOpen) return;
    setInboxClosing(true);
    setTimeout(() => { setInboxOpen(false); setInboxClosing(false); }, 180);
  }
  function toggleInbox() { inboxOpen ? closeInbox() : openInbox(); }

  useEffect(() => {
    if (!inboxOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        inboxPanelRef.current?.contains(e.target as Node) ||
        inboxBtnRef.current?.contains(e.target as Node)
      ) return;
      closeInbox();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inboxOpen]);

  function getAnchorRight(ref: React.RefObject<HTMLButtonElement | null>) {
    if (!ref.current) return 16;
    const rect = ref.current.getBoundingClientRect();
    return window.innerWidth - rect.right;
  }

  const iconBtn = (active: boolean) => [
    "flex items-center justify-center w-[38px] h-[38px] rounded-lg cursor-pointer transition-[background,border-color] duration-150",
    "border",
    active
      ? "bg-[rgba(219,39,119,0.1)] border-[rgba(219,39,119,0.35)] text-[var(--accent-orange)]"
      : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]",
  ].join(" ");

  return (
    <>
      <nav className="sticky top-0 z-[950] bg-[rgba(10,10,10,0.95)] backdrop-blur-[20px] border-b border-[var(--border-subtle)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 grid items-center gap-4 sm:gap-6"
          style={{ gridTemplateColumns: "auto 1fr auto" }}>

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-[0.625rem]">
            <button onClick={toggleDrawer} title="Menu" className={iconBtn(drawerOpen)}>
              <Menu size={17} />
            </button>

            <Link href="/feed" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] shrink-0">
                <Zap size={18} color="white" strokeWidth={2.5} />
              </div>
              <span className="hidden md:block font-display font-extrabold text-xl tracking-tight text-[var(--text-primary)]">
                Light<span className="text-[var(--accent-orange)]">House</span>
              </span>
            </Link>
          </div>

{/* Overlay (mobile/tablet only) — rendered via portal so it covers the full screen */}
{searchQ.trim().length > 0 && typeof document !== "undefined" && createPortal(
  <div
    className="fixed inset-0 z-[900] bg-black/50 backdrop-blur-sm lg:hidden"
    onClick={() => {
      setSearchQ("");
      closeSuggest();
    }}
  />,
  document.body
)}

{/* Search */}
<div
  ref={searchRef}
  className={[
    "transition-all duration-300",

    // 📱 mobile/tablet: overlay mode
    searchQ.trim().length > 0
      ? "fixed left-1/2 -translate-x-1/2 top-[12px] z-[999] w-[85%]"
      : "relative w-full",

    // 💻 desktop: normal
    "lg:static lg:translate-x-0 lg:w-full",
  ].join(" ")}
>
  <form onSubmit={handleSearch} className="relative">
    <Search
      size={14}
      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]"
    />

    <input
      type="text"
      value={searchQ}
      onChange={(e) => handleSearchChange(e.target.value)}
      onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
      onKeyDown={handleKeyDown}
      placeholder={t("searchPlaceholder")}
      className="input-field w-full h-[42px] rounded-[10px] shadow-2xl"
      style={{ paddingLeft: "2.25rem" }}
      autoComplete="off"
    />
  </form>

  {/* Suggestions */}
  {suggestOpen && suggestions.length > 0 && (
    <div
      className={[

        "absolute left-0 right-0 top-[calc(100%+6px)] z-[1000]",

        "lg:absolute lg:left-0 lg:right-0 lg:top-[calc(100%+6px)]",

        "rounded-xl border border-[var(--border-subtle)]",
        "bg-[rgba(12,12,12,0.98)] backdrop-blur-xl shadow-2xl overflow-hidden",
        "flex flex-col",
      ].join(" ")}
      style={{ animation: "slideDownIn 0.15s ease both" }}
    >
      {/* Search for */}
      <button
        onMouseDown={() => {
          router.push(`/search?q=${encodeURIComponent(searchQ.trim())}`);
          closeSuggest();
        }}
        className="w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors border-b border-[var(--border-subtle)] cursor-pointer shrink-0"
      >
        <Search size={13} className="shrink-0 text-[var(--text-muted)]" />
        <span className="text-[0.8125rem] text-[var(--text-secondary)] truncate">
          {t("searchFor", { query: searchQ })}
          <span className="text-[var(--text-primary)] font-semibold font-display">
            &ldquo;{searchQ}&rdquo;
          </span>
        </span>
      </button>

      {/* Results */}
      <div className="overflow-y-auto max-h-[55vh] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.map((s, i) => (
          <button
            key={`${s.type}-${s.id}`}
            onMouseDown={() => {
              router.push(s.href);
              closeSuggest();
              setSearchQ(s.label);
            }}
            onMouseEnter={() => setActiveIdx(i)}
            className={[
              "w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left transition-colors cursor-pointer",
              i < suggestions.length - 1
                ? "border-b border-[var(--border-subtle)]"
                : "",
              activeIdx === i
                ? "bg-white/[0.06]"
                : "hover:bg-white/[0.04] active:bg-white/[0.06]",
            ].join(" ")}
          >
            <div className="shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center bg-white/[0.06]">
              {TYPE_ICON[s.type]}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[0.8125rem] font-display font-semibold text-[var(--text-primary)] truncate">
                {s.label}
              </p>
              {s.sub && (
                <p className="text-[0.72rem] text-[var(--text-muted)] truncate">
                  {s.sub}
                </p>
              )}
            </div>

            <span className="hidden sm:inline-block shrink-0 text-[0.65rem] font-display font-bold tracking-wide px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[var(--text-muted)]">
              {TYPE_LABEL[s.type]}
            </span>

            <span className="sm:hidden shrink-0 text-[0.6rem] font-display font-medium text-[var(--text-muted)]">
              {TYPE_LABEL[s.type]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )}
</div>

          {/* Right */}
          <div className="flex items-center gap-1 sm:gap-[0.625rem]">

            {/* Nav links — hidden on mobile */}
            <div className="hidden md:flex items-center gap-0.5">
              {[
                { href: "/games",         label: t("games") },
                { href: "/subscriptions", label: t("plans") },
                { href: "/contact",       label: t("contact") },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-[0.875rem] py-[0.4rem] rounded-lg no-underline text-[var(--text-secondary)] font-display font-medium text-sm whitespace-nowrap transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Admin panel link */}
            {session?.user?.role === "ADMIN" && (
              <Link
                href="/admin"
                title="Admin Panel"
                className={iconBtn(false)}
              >
                <LayoutDashboard size={16} />
              </Link>
            )}

            {/* Staff: Support Inbox button */}
            {isStaff && (
              <button
                ref={inboxBtnRef}
                onClick={() => { toggleInbox(); setHasNewTickets(false); }}
                title="Support Inbox"
                className={[iconBtn(inboxOpen), "relative"].join(" ")}
              >
                <Inbox size={16} />
                {hasNewTickets && !inboxOpen && (
                  <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-[var(--accent-orange)] border-[1.5px] border-[var(--bg-primary)]" />
                )}
              </button>
            )}

            {/* Create dropdown — logged-in only */}
            {session && (
              <div ref={createRef} className="relative">
                <button
                  onClick={() => setCreateOpen((o) => !o)}
                  className={[
                    "flex items-center gap-[0.375rem] h-[38px] px-3 rounded-lg cursor-pointer",
                    "font-display font-semibold text-[0.8125rem] whitespace-nowrap",
                    "border transition-[background,border-color,color] duration-150",
                    createOpen
                      ? "bg--[var(--accent-orange)]/10 border-[var(--accent-orange)]/35 text-[var(--accent-orange)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]",
                  ].join(" ")}
                >
                  <Plus size={15} />
                  <span className="hidden md:inline">{t("create")}</span>
                </button>

                {createOpen && (
                  <div
                    className="absolute top-[calc(100%+8px)] right-0 w-[180px] z-[200] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.45)] overflow-hidden"
                    style={{ animation: "slideDownIn 0.15s ease both" }}
                  >
                    {[
                      { href: "/upload",   icon: Video,    label: "Upload Video" },
                      { href: "/post/new", icon: FileText, label: "Write Post"   },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setCreateOpen(false)}
                        className="flex items-center gap-[0.625rem] px-4 py-3 no-underline text-[var(--text-secondary)] text-sm font-display font-medium transition-[background,color] duration-[120ms] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <Icon size={15} className="text-[var(--accent-orange)]" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Spotify player — logged-in only */}
            {session && (
              <button
                onClick={() => setSpotifyOpen(o => !o)}
                title="Spotify Player"
                className={iconBtn(spotifyOpen)}
              >
                <Music2 size={16} />
              </button>
            )}

            {/* Bell — logged-in only */}
            {session && (
              <button
                ref={bellRef}
                onClick={toggleNotif}
                className={[iconBtn(notifOpen), "relative"].join(" ")}
              >
                <Bell size={16} />
                {hasNew && (
                  <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-[var(--accent-orange)] border-[1.5px] border-[var(--bg-primary)]" />
                )}
              </button>
            )}

            {/* User */}
            {session ? (
              <>
                <Link
                  href="/profile"
                  className="w-[38px] h-[38px] rounded-lg flex items-center justify-center no-underline bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden"
                  title={session.user?.name ?? "Profile"}
                >
                  {session.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="text-[var(--accent-orange)]" />
                  )}
                </Link>
                <LanguageSwitcher current={locale} />
                <button
                  onClick={() => signOut()}
                  className="hidden sm:flex items-center p-[0.375rem] rounded-md bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-red-500 transition-colors duration-150"
                  title={t("logout")}
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="btn-ghost hidden md:inline-flex no-underline py-[0.4rem] px-4 text-sm whitespace-nowrap">
                  {t("signIn")}
                </Link>
                <Link href="/auth/register" className="btn-primary no-underline py-[0.4rem] px-4 text-sm whitespace-nowrap">
                  {t("joinFree")}
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              className="flex md:hidden items-center justify-center bg-transparent border-none cursor-pointer text-[var(--text-secondary)]"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] px-4 py-3">
            {[
              { href: "/feed",          label: "Feed" },
              { href: "/chat",          label: "Chat" },
              { href: "/games", label: "Games" },
              { href: "/subscriptions", label: "Plans" },
              { href: "/contact",       label: "Contact" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex px-4 py-3 rounded-lg no-underline text-[var(--text-secondary)] font-display font-medium text-[0.95rem] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors duration-150"
              >
                {label}
              </Link>
            ))}
            {session ? (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-transparent border-none cursor-pointer text-[var(--text-muted)] font-display font-medium text-[0.95rem] hover:bg-red-500/10 hover:text-red-500 transition-colors duration-150"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <Link href="/auth/signin" className="btn-ghost no-underline flex-1 text-center py-2 text-sm">Sign In</Link>
                <Link href="/auth/register" className="btn-primary no-underline flex-1 text-center py-2 text-sm">Join Free</Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Side drawer */}
      {(drawerOpen || drawerClosing) && (
        <SideDrawer onClose={closeDrawer} isClosing={drawerClosing} onOpenChat={openChat} />
      )}

      {/* Chat popup */}
      {(chatOpen || chatClosing) && (
        <ChatPopup ref={chatRef} onClose={closeChat} isClosing={chatClosing} />
      )}

      {/* Notifications panel */}
      {notifOpen && (
        <NotificationsPanel
          ref={panelRef}
          anchorRight={getAnchorRight(bellRef)}
          onClose={closeNotif}
          isClosing={notifClosing}
          onCommitsLoaded={handleCommitsLoaded}
          onAllSeen={() => setHasNew(false)}
          storageKey={storageKey}
        />
      )}

      {/* Support inbox (staff only) */}
      {isStaff && (inboxOpen || inboxClosing) && (
        <div ref={inboxPanelRef}>
          <SupportInbox
            onClose={closeInbox}
            isClosing={inboxClosing}
            anchorRight={getAnchorRight(inboxBtnRef)}
          />
        </div>
      )}

      {/* Music player popup */}
      {spotifyOpen && <MusicPlayer onClose={() => setSpotifyOpen(false)} />}
    </>
  );
}
