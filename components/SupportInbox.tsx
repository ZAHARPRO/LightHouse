"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { X, Send, CheckCircle, Inbox, ChevronLeft } from "lucide-react";
import {
  getOperatorInbox,
  getConversationById,
  staffReply,
  closeConversation,
  pingStaffPresence,
} from "@/actions/support";

type ConvSummary = {
  id: string;
  updatedAt: Date;
  user: { id: string; name: string | null; email: string | null };
  messages: { content: string; isFromStaff: boolean; sender: { name: string | null } }[];
};

type FullMsg = {
  id: string;
  content: string;
  isFromStaff: boolean;
  createdAt: Date;
  sender: { id: string; name: string | null };
};

type FullConv = {
  id: string;
  user: { id: string; name: string | null; email: string | null };
  messages: FullMsg[];
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

interface Props {
  onClose: () => void;
  isClosing: boolean;
  anchorRight: number;
}

export default function SupportInbox({ onClose, isClosing, anchorRight }: Props) {
  const [convs, setConvs]       = useState<ConvSummary[]>([]);
  const [selected, setSelected] = useState<FullConv | null>(null);
  const [input, setInput]       = useState("");
  const [pending, start]        = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getOperatorInbox().then((data) => setConvs(data as ConvSummary[]));
    // Mark staff as online immediately and keep pinging every 2 min
    pingStaffPresence("Support Inbox");
    const timer = setInterval(() => pingStaffPresence("Support Inbox"), 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  function openConv(id: string) {
    getConversationById(id).then((data) => setSelected(data as FullConv | null));
  }

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selected) return;
    const content = input.trim();
    setInput("");
    const optimistic: FullMsg = {
      id: `opt-${Date.now()}`,
      content,
      isFromStaff: true,
      createdAt: new Date(),
      sender: { id: "me", name: "You" },
    };
    setSelected((s) => s ? { ...s, messages: [...s.messages, optimistic] } : s);
    start(async () => {
      const res = await staffReply(selected.id, content);
      if (res.message) {
        setSelected((s) => s ? {
          ...s,
          messages: s.messages.map((m) =>
            m.id === optimistic.id ? (res.message as FullMsg) : m
          ),
        } : s);
      }
    });
  }

  function handleClose(convId: string) {
    start(async () => {
      await closeConversation(convId);
      setConvs((p) => p.filter((c) => c.id !== convId));
      setSelected(null);
    });
  }

  return (
    <div
      className="fixed top-16 z-[3000] w-[360px] flex flex-col bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-b-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
      style={{
        right: anchorRight,
        height: "calc(100vh - 64px)",
        animation: isClosing ? "slideOutRight 0.18s ease both" : "slideInRight 0.2s ease both",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] mr-1"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <Inbox size={14} className="text-[var(--accent-orange)]" />
          <span className="font-display font-bold text-sm text-[var(--text-primary)]">
            {selected ? `${selected.user.name ?? "User"}'s ticket` : "Support Inbox"}
          </span>
          {!selected && convs.length > 0 && (
            <span className="ml-1 text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-orange)] text-white">
              {convs.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      {selected ? (
        /* ── Conversation view ── */
        <div className="flex flex-col flex-1 min-h-0">
          {/* User info bar */}
          <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] shrink-0">
            <p className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">{selected.user.name}</p>
            <p className="text-[0.75rem] text-[var(--text-muted)]">{selected.user.email}</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {selected.messages.map((msg) => (
              <div
                key={msg.id}
                className={["flex flex-col", msg.isFromStaff ? "items-end" : "items-start"].join(" ")}
              >
                {!msg.isFromStaff && (
                  <span className="text-[0.65rem] text-[var(--text-muted)] mb-0.5 ml-1">
                    {selected.user.name ?? "User"}
                  </span>
                )}
                {msg.isFromStaff && (
                  <span className="text-[0.65rem] text-[var(--text-muted)] mb-0.5 mr-1">
                    {msg.sender.name ?? "Staff"}
                  </span>
                )}
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl text-[0.8125rem] leading-snug break-words"
                  style={{
                    background: msg.isFromStaff ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    border: msg.isFromStaff ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                    borderBottomRightRadius: msg.isFromStaff ? 4 : undefined,
                    borderBottomLeftRadius: msg.isFromStaff ? undefined : 4,
                  }}
                >
                  {msg.content}
                </div>
                <span className="text-[0.65rem] text-[var(--text-muted)] mt-0.5 mx-1">
                  {timeAgo(msg.createdAt)}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply + close */}
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0 p-3 flex flex-col gap-2">
            <form onSubmit={handleReply} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Reply to user…"
                maxLength={1000}
                className="input-field flex-1 text-[0.8125rem] h-9"
              />
              <button
                type="submit"
                disabled={!input.trim() || pending}
                className={[
                  "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] border-none text-white cursor-pointer transition-opacity",
                  !input.trim() || pending ? "opacity-50" : "opacity-100",
                ].join(" ")}
              >
                <Send size={14} />
              </button>
            </form>
            <button
              onClick={() => handleClose(selected.id)}
              disabled={pending}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] text-[0.8rem] font-display font-semibold cursor-pointer hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors"
            >
              <CheckCircle size={13} /> Close ticket
            </button>
          </div>
        </div>
      ) : (
        /* ── Inbox list ── */
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
              <Inbox size={32} className="opacity-40" />
              <p className="text-sm">No open tickets</p>
            </div>
          ) : (
            convs.map((conv) => {
              const last = conv.messages[0];
              return (
                <button
                  key={conv.id}
                  onClick={() => openConv(conv.id)}
                  className="w-full text-left px-4 py-3.5 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors duration-100 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-[0.875rem] text-[var(--text-primary)]">
                      {conv.user.name ?? conv.user.email ?? "Unknown"}
                    </span>
                    <span className="text-[0.65rem] text-[var(--text-muted)]">
                      {timeAgo(conv.updatedAt)}
                    </span>
                  </div>
                  {last && (
                    <p className="text-[0.8rem] text-[var(--text-muted)] truncate">
                      {last.isFromStaff ? "You: " : ""}{last.content}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
