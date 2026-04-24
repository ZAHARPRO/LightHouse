"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
  getDMMessages, sendDirectMessage,
  editDirectMessage, deleteDirectMessage, pinDirectMessage,
  blockUser, unblockUser,
} from "@/actions/dm";
import {
  ArrowLeft, ArrowDown, Reply, Send, X, ShieldOff, Pin, PinOff,
  Pencil, Trash2, MoreHorizontal, Check, ChevronUp, ChevronDown,
  UserX, UserCheck, Search,
} from "lucide-react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";

type DMSender = { id: string; name: string | null; username: string | null; tier: string; image: string | null };
type ReplyInfo = { id: string; content: string; sender: { id: string; name: string | null } } | null;
type DMsg = {
  id: string;
  content: string;
  createdAt: Date;
  isEdited: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  sender: DMSender;
  replyTo: ReplyInfo;
};


function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DMConversationPage() {
  const { id: convId } = useParams<{ id: string }>();

  const [messages, setMessages]       = useState<DMsg[]>([]);
  const [myId, setMyId]               = useState<string>("");
  const [otherBan, setOtherBan]       = useState<{ reason: string | null; bannedAt: Date | null } | null>(null);
  const [isBlockedByMe, setBlockedByMe]     = useState(false);
  const [isBlockedByThem, setBlockedByThem] = useState(false);
  const [input, setInput]             = useState("");
  const [replyTo, setReplyTo]         = useState<{ id: string; name: string; content: string } | null>(null);
  const [menuId, setMenuId]           = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editInput, setEditInput]     = useState("");
  const [pinnedIdx, setPinnedIdx]     = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIdx, setSearchIdx]     = useState(0);
  const [pending, start]              = useTransition();

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const editRef     = useRef<HTMLInputElement>(null);
  const msgRefs     = useRef<Map<string, HTMLDivElement>>(new Map());
  const messagesRef   = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDMMessages(convId).then((res) => {
      if ("messages" in res) {
        setMessages(res.messages as DMsg[]);
        setMyId(res.myId ?? "");
        setOtherBan(res.otherBan ?? null);
        setBlockedByMe(res.isBlockedByMe ?? false);
        setBlockedByThem(res.isBlockedByThem ?? false);
      }
    });
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollBtn(!entry.isIntersecting),
      { root: messagesRef.current, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [messages.length]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const handler = () => setMenuId(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuId]);

  /* ── Search ── */
  const searchResults = searchQuery.trim().length > 0
    ? messages
        .filter((m) => !m.isDeleted && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((m) => m.id)
    : [];

  function navigate(dir: 1 | -1) {
    if (!searchResults.length) return;
    const next = (searchIdx + dir + searchResults.length) % searchResults.length;
    setSearchIdx(next);
    scrollToMsg(searchResults[next]);
  }

  function closeSearch() {
    setSearchQuery("");
    setSearchIdx(0);
  }

  function highlight(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ background: "rgba(249,115,22,0.4)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>{part}</mark>
        : part
    );
  }

  const other   = messages.find((m) => m.sender.id !== myId)?.sender ?? null;
  const pinned  = messages.filter((m) => m.isPinned && !m.isDeleted);
  const safeIdx = pinned.length > 0 ? Math.min(pinnedIdx, pinned.length - 1) : 0;

  function scrollToMsg(id: string) {
    const el = msgRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash highlight
    el.style.transition = "background 0.3s";
    el.style.background = "rgba(249,115,22,0.15)";
    setTimeout(() => { el.style.background = ""; }, 1200);
  }

  /* ── Send ── */
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pending) return;
    const content   = input.trim();
    const replyToId = replyTo?.id;
    const optimistic: DMsg = {
      id: `opt-${Date.now()}`,
      content,
      createdAt: new Date(),
      isEdited: false, isPinned: false, isDeleted: false,
      sender: { id: myId, name: "You", username: null, tier: "FREE", image: null },
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, sender: { id: myId, name: "You" } } : null,
    };
    setMessages((p) => [...p, optimistic]);
    setInput("");
    setReplyTo(null);
    start(async () => {
      const res = await sendDirectMessage(convId, content, replyToId);
      if ("message" in res && res.message) {
        setMessages((p) => p.map((m) => m.id === optimistic.id ? (res.message as unknown as DMsg) : m));
      }
    });
  }

  /* ── Edit ── */
  function startEdit(msg: DMsg) {
    setEditingId(msg.id);
    setEditInput(msg.content);
    setMenuId(null);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editInput.trim()) return;
    const id      = editingId;
    const content = editInput.trim();
    setEditingId(null);
    setMessages((p) => p.map((m) => m.id === id ? { ...m, content, isEdited: true } : m));
    start(async () => { await editDirectMessage(id, content); });
  }

  /* ── Delete ── */
  function handleDelete(msgId: string) {
    setMenuId(null);
    setMessages((p) => p.map((m) => m.id === msgId ? { ...m, isDeleted: true, content: "" } : m));
    start(async () => { await deleteDirectMessage(msgId); });
  }

  /* ── Block / Unblock ── */
  function handleBlock() {
    if (!other) return;
    if (!confirm(`Block ${other.name ?? "this user"}? They won't be able to send you messages.`)) return;
    setBlockedByMe(true);
    start(async () => { await blockUser(other.id); });
  }

  function handleUnblock() {
    if (!other) return;
    setBlockedByMe(false);
    start(async () => { await unblockUser(other.id); });
  }

  /* ── Pin / Unpin ── */
  function handlePin(msg: DMsg) {
    setMenuId(null);
    const newPinned = !msg.isPinned;
    setMessages((p) => p.map((m) => m.id === msg.id ? { ...m, isPinned: newPinned } : m));
    if (newPinned) setPinnedIdx(0);
    start(async () => { await pinDirectMessage(msg.id, newPinned); });
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-0 flex flex-col overflow-hidden bg-[var(--bg-primary)] z-10">

      {/* ── Fixed top ── */}
      <div className="shrink-0 px-6 pt-5 pb-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Back */}
        <Link
          href="/dm"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </Link>

        {other && (
          <div className="flex w-full items-center gap-2.5">
            {/* Avatar */}
            <Link href={`/profile/${other.id}`} className="no-underline shrink-0">
              <UserAvatar name={other.name ?? "?"} image={other.image} tier={other.tier} size="md" />
            </Link>

            {/* Name + username */}
            <Link href={`/profile/${other.id}`} className="no-underline">
              <p className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] hover:text-[var(--accent-orange)] transition-colors leading-tight">
                {other.name}
              </p>
              {other.username && (
                <p className="text-[0.72rem] text-[var(--text-muted)] leading-tight">@{other.username}</p>
              )}
            </Link>

                        {/* Block button */}
            {isBlockedByMe ? (
              <button
                onClick={handleUnblock}
                disabled={pending}
                title="Unblock user"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-green-400 bg-green-500/8 hover:bg-green-500/15 border border-green-500/20 transition-colors cursor-pointer disabled:opacity-40 bg-transparent shrink-0"
              >
                <UserCheck size={15} />
              </button>
            ) : (
              <button
                onClick={handleBlock}
                disabled={pending}
                title="Block user"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/8 hover:border-red-500/20 border border-[var(--border-subtle)] transition-colors cursor-pointer disabled:opacity-40 bg-transparent shrink-0"
              >
                <UserX size={15} />
              </button>
            )}


          {/* Search bar */}
        <div className="flex w-3/4 items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <Search size={13} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeSearch();
              if (e.key === "Enter") { e.preventDefault(); navigate(e.shiftKey ? -1 : 1); }
            }}
            placeholder="Search messages…"
            className="flex-1 w3/4 bg-transparent text-[0.8125rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          {searchQuery.trim().length > 0 && (
            <span className="text-[0.7rem] text-[var(--text-muted)] shrink-0 font-display">
              {searchResults.length === 0 ? "0 / 0" : `${searchIdx + 1} / ${searchResults.length}`}
            </span>
          )}
          <button onClick={() => navigate(-1)} disabled={!searchResults.length}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 bg-transparent border-none cursor-pointer transition-colors">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => navigate(1)} disabled={!searchResults.length}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 bg-transparent border-none cursor-pointer transition-colors">
            <ChevronDown size={13} />
          </button>
          <button onClick={closeSearch}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-red-400 bg-transparent border-none cursor-pointer transition-colors">
            <X size={12} />
          </button>
        </div>
       </div>
        )}
      </div>



      {/* Block banners */}
      {isBlockedByMe && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[0.8rem]"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>
          <UserX size={14} style={{ color: "#f87171", flexShrink: 0 }} />
          <span>You have blocked this user. They can&apos;t send you messages.</span>
          <button onClick={handleUnblock} disabled={pending} className="ml-auto text-[0.75rem] font-display font-semibold text-green-400 hover:text-green-300 bg-transparent border-none cursor-pointer disabled:opacity-50">
            Unblock
          </button>
        </div>
      )}
      {isBlockedByThem && !isBlockedByMe && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[0.8rem]"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>
          <UserX size={14} style={{ color: "#f87171", flexShrink: 0 }} />
          <span>You can&apos;t send messages to this user.</span>
        </div>
      )}

      {/* Ban notice */}
      {otherBan && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[0.8125rem]"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          <ShieldOff size={15} className="shrink-0 mt-0.5" style={{ color: "#f87171" }} />
          <div>
            <span className="font-display font-semibold" style={{ color: "#f87171" }}>
              This user&apos;s account has been suspended.
            </span>
            {otherBan.reason && <span className="ml-1.5">Reason: {otherBan.reason}.</span>}
            {otherBan.bannedAt && (
              <span className="ml-1.5 opacity-70">
                — {new Date(otherBan.bannedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pinned messages bar */}
      {pinned.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.18)" }}
        >
          <Pin size={12} className="shrink-0" style={{ color: "var(--accent-orange)" }} />
          <button
            onClick={() => scrollToMsg(pinned[safeIdx].id)}
            className="flex-1 text-left text-[0.78rem] text-[var(--text-primary)] truncate bg-transparent border-none cursor-pointer p-0 hover:text-[var(--accent-orange)] transition-colors"
          >
            <span className="text-[var(--text-muted)] mr-1.5 text-[0.7rem]">
              {pinned.length > 1 ? `${safeIdx + 1}/${pinned.length}` : "Pinned"}
            </span>
            {pinned[safeIdx].content}
          </button>
          {pinned.length > 1 && (
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => setPinnedIdx((i) => Math.max(0, i - 1))}
                disabled={safeIdx === 0}
                className="w-5 h-4 flex items-center justify-center rounded bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 transition-colors"
              >
                <ChevronUp size={11} />
              </button>
              <button
                onClick={() => setPinnedIdx((i) => Math.min(pinned.length - 1, i + 1))}
                disabled={safeIdx === pinned.length - 1}
                className="w-5 h-4 flex items-center justify-center rounded bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent-orange)] disabled:opacity-30 transition-colors"
              >
                <ChevronDown size={11} />
              </button>
            </div>
          )}
        </div>
      )}

      </div>{/* end fixed top */}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <div ref={messagesRef} className="h-full overflow-y-auto flex flex-col gap-3 px-6 py-4">
        {messages.map((msg, msgIndex) => {
          const isMe      = msg.sender.id === myId;
          const menuBelow = msgIndex < 3;

          return (
            <div
              key={msg.id}
              ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}
              className={["flex items-end gap-2 group rounded-xl transition-[background]", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}
            >
              {/* Avatar */}
              {!isMe && (
                <UserAvatar name={msg.sender.name ?? "?"} image={msg.sender.image} tier={msg.sender.tier} size="sm" className="mb-0.5" />
              )}

              <div className={["flex flex-col max-w-[72%]", isMe ? "items-end" : "items-start"].join(" ")}>
                {/* Reply context */}
                {msg.replyTo && !msg.isDeleted && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md mb-1 text-[0.7rem] text-[var(--text-muted)] max-w-full"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                  >
                    <Reply size={10} className="shrink-0" />
                    <span className="font-semibold">{msg.replyTo.sender.name ?? "?"}</span>
                    <span className="truncate">{msg.replyTo.content}</span>
                  </div>
                )}

                {/* Bubble */}
                {editingId === msg.id ? (
                  /* Edit input */
                  <form onSubmit={handleEdit} className="flex items-center gap-1.5">
                    <input
                      ref={editRef}
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      maxLength={2000}
                      className="input-field text-[0.875rem] h-8 px-2"
                    />
                    <button type="submit" disabled={!editInput.trim()} className="w-7 h-7 rounded-lg bg-[var(--accent-orange)] border-none text-white flex items-center justify-center cursor-pointer disabled:opacity-50">
                      <Check size={13} />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer">
                      <X size={13} />
                    </button>
                  </form>
                ) : (
                  <div className="relative">
                    <div
                      className="px-3 py-2 text-[0.875rem] leading-snug break-words"
                      style={{
                        background: msg.isDeleted
                          ? "transparent"
                          : isMe ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                        border: msg.isDeleted
                          ? "1px dashed var(--border-subtle)"
                          : isMe ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                        borderRadius: isMe ? "12px 3px 12px 12px" : "3px 12px 12px 12px",
                        color: msg.isDeleted ? "var(--text-muted)" : "var(--text-primary)",
                        fontStyle: msg.isDeleted ? "italic" : undefined,
                      }}
                    >
                      {msg.isDeleted ? "Message deleted" : highlight(msg.content, searchQuery)}
                    </div>
                    {/* Pinned badge */}
                    {msg.isPinned && !msg.isDeleted && (
                      <span
                        className="absolute -top-2 flex items-center gap-0.5 text-[0.55rem] font-display font-bold px-1 py-[0.1rem] rounded-full"
                        style={{
                          background: "rgba(249,115,22,0.15)",
                          border: "1px solid rgba(249,115,22,0.3)",
                          color: "var(--accent-orange)",
                          left: isMe ? undefined : "6px",
                          right: isMe ? "6px" : undefined,
                        }}
                      >
                        <Pin size={14} />
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-0.5 mx-1">
                  <span className="text-[0.65rem] text-[var(--text-muted)]">{timeAgo(msg.createdAt)}</span>
                  {msg.isEdited && !msg.isDeleted && (
                    <span className="text-[0.6rem] text-[var(--text-muted)] opacity-60">edited</span>
                  )}
                </div>
              </div>

              {/* Context menu button — shown on hover */}
              {!msg.isDeleted && editingId !== msg.id && (
                <div className="relative mb-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === msg.id ? null : msg.id); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <MoreHorizontal size={12} />
                  </button>

                  {menuId === msg.id && (
                    <div
                      className="absolute z-50 w-40 py-1 rounded-xl shadow-lg"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        ...(menuBelow ? { top: "110%" } : { bottom: "110%" }),
                        [isMe ? "right" : "left"]: 0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Reply */}
                      <button
                        onClick={() => {
                          setReplyTo({ id: msg.id, name: msg.sender.name ?? "?", content: msg.content });
                          setMenuId(null);
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.8rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer bg-transparent border-none text-left"
                      >
                        <Reply size={12} /> Reply
                      </button>

                      {/* Pin / Unpin */}
                      <button
                        onClick={() => handlePin(msg)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.8rem] text-[var(--text-muted)] hover:text-[var(--accent-orange)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer bg-transparent border-none text-left"
                      >
                        {msg.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                        {msg.isPinned ? "Unpin" : "Pin"}
                      </button>

                      {/* Edit (own only) */}
                      {isMe && (
                        <button
                          onClick={() => startEdit(msg)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.8rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer bg-transparent border-none text-left"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.8rem] text-red-400 hover:bg-red-500/8 transition-colors cursor-pointer bg-transparent border-none text-left"
                      >
                        <Trash2 size={12} />
                        {isMe ? "Delete for everyone" : "Delete for me"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>{/* end messagesRef scroll */}

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-4 left-6 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-display font-semibold text-white shadow-lg transition-all duration-200"
          style={{ background: "var(--accent-orange)" }}
        >
          <ArrowDown size={13} />
        </button>
      )}
      </div>{/* end relative wrapper */}

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border-subtle)] px-6 py-3">
        {(isBlockedByMe || isBlockedByThem) ? (
          <div className="h-10 flex items-center justify-center text-[0.8rem] text-[var(--text-muted)] italic">
            {isBlockedByMe ? "Unblock this user to send messages." : "You can't reply to this conversation."}
          </div>
        ) : (
          <>
            {replyTo && (
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--accent-orange)]">
                  <Reply size={11} />
                  Replying to <strong>{replyTo.name}</strong>
                  <span className="text-[var(--text-muted)] truncate max-w-[160px]">— {replyTo.content}</span>
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Write a message…"}
                maxLength={2000}
                className="input-field flex-1 h-10"
              />
              <button
                type="submit"
                disabled={!input.trim() || pending}
                className="h-10 px-4 rounded-[9px] bg-[var(--accent-orange)] border-none text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-display font-semibold text-sm"
              >
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
