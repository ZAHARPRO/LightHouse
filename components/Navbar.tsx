"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Zap, Bell, User, Search, LogOut, Menu, X,
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import SideDrawer from "./SideDrawer";
import ChatPopup from "./ChatPopup";

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Side drawer state
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);

  function openDrawer()  { if (!drawerClosing) setDrawerOpen(true); }
  function closeDrawer() {
    if (!drawerOpen) return;
    setDrawerClosing(true);
    setTimeout(() => { setDrawerOpen(false); setDrawerClosing(false); }, 180);
  }
  function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer(); }

  // Chat popup state (opened from drawer)
  const [chatOpen, setChatOpen] = useState(false);

  function openChat() {
    closeDrawer();          // close drawer first
    setChatOpen(true);
  }
  function closeChat() { setChatOpen(false); }

  // Notifications state
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifClosing, setNotifClosing] = useState(false);
  const [hasNew, setHasNew]             = useState(false);
  const bellRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const storageKey = `lh_last_seen_commit_${session?.user?.id ?? "guest"}`;

  // Re-check dot whenever the logged-in user changes
  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) setHasNew(true);
    else setHasNew(false);
  }, [storageKey]);

  // Close on click outside
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

  // Called by panel once commits are loaded — sha of the newest commit
  function handleCommitsLoaded(latestSha: string | null) {
    if (!latestSha) return;
    const seen = localStorage.getItem(storageKey);
    if (seen !== latestSha) setHasNew(true);
  }

  function openNotif() {
    if (notifClosing) return;
    setNotifOpen(true);
    // Mark as seen immediately when panel opens
    setHasNew(false);
  }

  function closeNotif() {
    if (!notifOpen) return;
    setNotifClosing(true);
    setTimeout(() => {
      setNotifOpen(false);
      setNotifClosing(false);
    }, 180);
  }

  function toggleNotif() {
    notifOpen ? closeNotif() : openNotif();
  }

  // Anchor panel to the right side of the bell button
  function getAnchorRight() {
    if (!bellRef.current) return 16;
    const rect = bellRef.current.getBoundingClientRect();
    return window.innerWidth - rect.right;
  }

  return (
    <>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: 64,
            display: "grid",
            gridTemplateColumns: "220px 1fr auto",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          {/* Logo column: hamburger + logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <button
            onClick={toggleDrawer}
            title="Menu"
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: drawerOpen ? "rgba(249,115,22,0.1)" : "var(--bg-elevated)",
              border: drawerOpen ? "1px solid rgba(249,115,22,0.35)" : "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
              color: drawerOpen ? "var(--accent-orange)" : "var(--text-secondary)",
            }}
          >
            <Menu size={17} />
          </button>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 32, height: 32,
                background: "var(--accent-orange)",
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Zap size={18} color="white" strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "1.25rem",
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Light<span style={{ color: "var(--accent-orange)" }}>House</span>
            </span>
          </Link>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              type="text"
              placeholder="Search"
              className="input-field"
              style={{ paddingLeft: 40, height: 42, borderRadius: 10 }}
            />
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            {/* Nav links */}
            <div className="hidden md:flex" style={{ display: "flex", alignItems: "center", gap: "0.125rem" }}>
              {[
                { href: "/feed",          label: "Feed" },
                { href: "/subscriptions", label: "Plans" },
                { href: "/contact",       label: "Contact" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    padding: "0.4rem 0.875rem",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Notifications bell — only for logged-in users */}
            {session && (
              <button
                ref={bellRef}
                onClick={toggleNotif}
                style={{
                  width: 38, height: 38,
                  borderRadius: 8,
                  background: notifOpen ? "rgba(249,115,22,0.1)" : "var(--bg-elevated)",
                  border: notifOpen
                    ? "1px solid rgba(249,115,22,0.35)"
                    : "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.15s, border-color 0.05s",
                }}
              >
                <Bell size={16} color={notifOpen ? "var(--accent-orange)" : "var(--text-secondary)"} />
                {hasNew && (
                  <span style={{
                    position: "absolute", top: 6, right: 6,
                    width: 7, height: 7, borderRadius: "50%",
                    background: "var(--accent-orange)",
                    border: "1.5px solid var(--bg-primary)",
                  }} />
                )}
              </button>
            )}

            {/* User */}
            {session ? (
              <>
                <Link
                  href="/profile"
                  style={{
                    width: 38, height: 38,
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    textDecoration: "none",
                    overflow: "hidden",
                  }}
                  title={session.user?.name ?? "Profile"}
                >
                  {session.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <User size={16} color="var(--accent-orange)" />
                  )}
                </Link>
                <button
                  onClick={() => signOut()}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex", alignItems: "center",
                    padding: "0.375rem", borderRadius: 6,
                  }}
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="btn-ghost" style={{ padding: "0.4rem 1rem", fontSize: "0.875rem", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Sign In
                </Link>
                <Link href="/auth/register" className="btn-primary" style={{ padding: "0.4rem 1rem", fontSize: "0.875rem", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Join Free
                </Link>
              </>
            )}

            {/* Mobile toggle */}
            <button
              className="flex md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border-subtle)", padding: "1rem" }}>
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
                style={{
                  display: "flex",
                  padding: "0.75rem 1rem",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Side drawer */}
      {(drawerOpen || drawerClosing) && (
        <SideDrawer onClose={closeDrawer} isClosing={drawerClosing} onOpenChat={openChat} />
      )}

      {/* Chat popup — opened from drawer */}
      {chatOpen && <ChatPopup onClose={closeChat} />}

      {/* Notifications panel — outside <nav> to escape stacking context */}
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
