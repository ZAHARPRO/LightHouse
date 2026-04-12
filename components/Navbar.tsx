"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Zap, Bell, User, Search, LogOut, Menu, X, Plus, Video, FileText,
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import SideDrawer from "./SideDrawer";
import ChatPopup from "./ChatPopup";

export default function Navbar() {
  const { data: session } = useSession();
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

  // Chat popup
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatClosing, setChatClosing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  function openChat() {
    closeDrawer();
    setChatOpen(true);
  }
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

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    setHasNew(!seen);
  }, [storageKey]);

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

  function handleCommitsLoaded(latestSha: string | null) {
    if (!latestSha) return;
    const seen = localStorage.getItem(storageKey);
    if (seen !== latestSha) setHasNew(true);
  }

  function openNotif()  { if (!notifClosing) { setNotifOpen(true); setHasNew(false); } }
  function closeNotif() {
    if (!notifOpen) return;
    setNotifClosing(true);
    setTimeout(() => { setNotifOpen(false); setNotifClosing(false); }, 180);
  }
  function toggleNotif() { notifOpen ? closeNotif() : openNotif(); }

  function getAnchorRight() {
    if (!bellRef.current) return 16;
    const rect = bellRef.current.getBoundingClientRect();
    return window.innerWidth - rect.right;
  }

  const iconBtn = (active: boolean) => [
    "flex items-center justify-center w-[38px] h-[38px] rounded-lg cursor-pointer transition-[background,border-color] duration-150",
    "border",
    active
      ? "bg-orange-500/10 border-orange-500/35 text-[var(--accent-orange)]"
      : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]",
  ].join(" ");

  return (
    <>
      <nav className="sticky top-0 z-[100] bg-[rgba(10,10,10,0.95)] backdrop-blur-[20px] border-b border-[var(--border-subtle)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 grid items-center gap-4 sm:gap-6"
          style={{ gridTemplateColumns: "auto 1fr auto" }}>

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-[0.625rem]">
            <button onClick={toggleDrawer} title="Menu" className={iconBtn(drawerOpen)}>
              <Menu size={17} />
            </button>

            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] shrink-0">
                <Zap size={18} color="white" strokeWidth={2.5} />
              </div>
              <span className="hidden sm:block font-display font-extrabold text-xl tracking-tight text-[var(--text-primary)]">
                Light<span className="text-[var(--accent-orange)]">House</span>
              </span>
            </Link>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]"
            />
            <input
              type="text"
              placeholder="Search"
              className="input-field w-full pl-10 h-[42px] rounded-[10px]"
            />
          </div>

          {/* Right */}
          <div className="flex items-center gap-[0.625rem]">

            {/* Nav links — hidden on mobile */}
            <div className="hidden md:flex items-center gap-0.5">
              {[
                { href: "/feed",          label: "Feed" },
                { href: "/subscriptions", label: "Plans" },
                { href: "/contact",       label: "Contact" },
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
                      ? "bg-orange-500/10 border-orange-500/35 text-[var(--accent-orange)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]",
                  ].join(" ")}
                >
                  <Plus size={15} />
                  <span className="hidden sm:inline">Create</span>
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
                <button
                  onClick={() => signOut()}
                  className="flex items-center p-[0.375rem] rounded-md bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-red-500 transition-colors duration-150"
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="btn-ghost hidden sm:inline-flex no-underline py-[0.4rem] px-4 text-sm whitespace-nowrap">
                  Sign In
                </Link>
                <Link href="/auth/register" className="btn-primary no-underline py-[0.4rem] px-4 text-sm whitespace-nowrap">
                  Join Free
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
            {!session && (
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
          anchorRight={getAnchorRight()}
          onClose={closeNotif}
          isClosing={notifClosing}
          onCommitsLoaded={handleCommitsLoaded}
          storageKey={storageKey}
        />
      )}
    </>
  );
}
