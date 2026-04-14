"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getDMMessages, sendDirectMessage,
  editDirectMessage, deleteDirectMessage, pinDirectMessage,
  blockUser, unblockUser,
} from "@/actions/dm";
import {
  ArrowLeft, Reply, Send, X, ShieldOff, Pin, PinOff,
  Pencil, Trash2, MoreHorizontal, Check, ChevronUp, ChevronDown,
  UserX, UserCheck,
} from "lucide-react";
import Link from "next/link";

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

const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#818cf8", FREE: "#888",
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

export default function DMConversationPage({ params }: { params: { id: string } }) {
  const convId = params.id;

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
  const [pending, start]              = useTransition();

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const editRef    = useRef<HTMLInputElement>(null);
  const msgRefs    = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const handler = () => setMenuId(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuId]);

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
    <div className="max-w-[700px] mx-auto px-4 py-6 h-[calc(100vh-64px)] flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        {/* Back */}
        <Link
          href="/dm"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </Link>

        {other && (
          <>
            {/* Block button — left of avatar */}
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

            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 overflow-hidden"
              style={{
                background: `${TIER_COLORS[other.tier] ?? "#888"}20`,
                border: `2px solid ${TIER_COLORS[other.tier] ?? "#888"}40`,
                color: TIER_COLORS[other.tier] ?? "#888",
              }}
            >
              {other.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.image} alt={other.name ?? "avatar"} className="w-full h-full object-cover" />
              ) : (
                (other.name ?? "?")[0].toUpperCase()
              )}
            </div>

            {/* Name + username */}
            <Link href={`/profile/${other.id}`} className="no-underline flex-1 min-w-0">
              <p className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] hover:text-[var(--accent-orange)] transition-colors leading-tight">
                {other.name}
              </p>
              {other.username && (
                <p className="text-[0.72rem] text-[var(--text-muted)] leading-tight">@{other.username}</p>
              )}
            </Link>
          </>
        )}
      </div>

      {/* Block banners */}
      {isBlockedByMe && (
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-3 text-[0.8rem]"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>
          <UserX size={14} style={{ color: "#f87171", flexShrink: 0 }} />
          <span>You have blocked this user. They can&apos;t send you messages.</span>
          <button onClick={handleUnblock} disabled={pending} className="ml-auto text-[0.75rem] font-display font-semibold text-green-400 hover:text-green-300 bg-transparent border-none cursor-pointer disabled:opacity-50">
            Unblock
          </button>
        </div>
      )}
      {isBlockedByThem && !isBlockedByMe && (
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-3 text-[0.8rem]"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>
          <UserX size={14} style={{ color: "#f87171", flexShrink: 0 }} />
          <span>You can&apos;t send messages to this user.</span>
        </div>
      )}

      {/* Ban notice */}
      {otherBan && (
        <div
          className="shrink-0 flex items-start gap-2.5 px-4 py-3 rounded-xl mb-3 text-[0.8125rem]"
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
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-2">
        {messages.map((msg) => {
          const isMe  = msg.sender.id === myId;
          const color = TIER_COLORS[msg.sender.tier] ?? "#888";

          return (
            <div
              key={msg.id}
              ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}
              className={["flex items-end gap-2 group rounded-xl transition-[background]", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}
            >
              {/* Avatar */}
              {!isMe && (
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-[0.625rem] mb-0.5"
                  style={{ background: `${color}20`, border: `1.5px solid ${color}40`, color }}
                >
                  {(msg.sender.name ?? "?")[0].toUpperCase()}
                </div>
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
                      {msg.isDeleted ? "Message deleted" : msg.content}
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
                        <Pin size={7} /> pinned
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
                        bottom: "110%",
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
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border-subtle)] pt-3">
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
