"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getDMMessages, sendDirectMessage } from "@/actions/dm";
import { ArrowLeft, Reply, Send, X, ShieldOff } from "lucide-react";
import Link from "next/link";

type DMSender = { id: string; name: string | null; tier: string };
type ReplyInfo = { id: string; content: string; sender: { id: string; name: string | null } } | null;
type DMsg = {
  id: string;
  content: string;
  createdAt: Date;
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

  const [messages, setMessages] = useState<DMsg[]>([]);
  const [myId, setMyId]         = useState<string>("");
  const [otherBan, setOtherBan] = useState<{ reason: string | null; bannedAt: Date | null } | null>(null);
  const [input, setInput]       = useState("");
  const [replyTo, setReplyTo]   = useState<{ id: string; name: string; content: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pending, start]        = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDMMessages(convId).then((res) => {
      if ("messages" in res) {
        setMessages(res.messages as DMsg[]);
        setMyId(res.myId ?? "");
        setOtherBan(res.otherBan ?? null);
      }
    });
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get the "other" user from messages
  const other = messages.find((m) => m.sender.id !== myId)?.sender ?? null;

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pending) return;
    const content = input.trim();
    const replyToId = replyTo?.id;
    const optimistic: DMsg = {
      id: `opt-${Date.now()}`,
      content,
      createdAt: new Date(),
      sender: { id: myId, name: "You", tier: "FREE" },
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, sender: { id: myId, name: "You" } } : null,
    };
    setMessages((p) => [...p, optimistic]);
    setInput("");
    setReplyTo(null);
    start(async () => {
      const res = await sendDirectMessage(convId, content, replyToId);
      if ("message" in res && res.message) {
        setMessages((p) =>
          p.map((m) => (m.id === optimistic.id ? (res.message as DMsg) : m))
        );
      }
    });
  }

  return (
    <div className="max-w-[700px] mx-auto px-4 py-6 h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link
          href="/dm"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline transition-colors"
        >
          <ArrowLeft size={15} />
        </Link>
        {other && (
          <>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0"
              style={{
                background: `${TIER_COLORS[other.tier] ?? "#888"}20`,
                border: `2px solid ${TIER_COLORS[other.tier] ?? "#888"}40`,
                color: TIER_COLORS[other.tier] ?? "#888",
              }}
            >
              {(other.name ?? "?")[0].toUpperCase()}
            </div>
            <Link href={`/profile/${other.id}`} className="no-underline">
              <p className="font-display font-bold text-[var(--text-primary)] hover:text-[var(--accent-orange)] transition-colors">
                {other.name}
              </p>
            </Link>
          </>
        )}
      </div>

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
            {otherBan.reason && (
              <span className="ml-1.5">Reason: {otherBan.reason}.</span>
            )}
            {otherBan.bannedAt && (
              <span className="ml-1.5 opacity-70">
                — {new Date(otherBan.bannedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-2">
        {messages.map((msg) => {
          const isMe = msg.sender.id === myId;
          const color = TIER_COLORS[msg.sender.tier] ?? "#888";
          return (
            <div
              key={msg.id}
              className={["flex items-end gap-2 group", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
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
                {msg.replyTo && (
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
                <div
                  className="px-3 py-2 text-[0.875rem] leading-snug break-words"
                  style={{
                    background: isMe ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                    border: isMe ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                    borderRadius: isMe ? "12px 3px 12px 12px" : "3px 12px 12px 12px",
                    color: "var(--text-primary)",
                  }}
                >
                  {msg.content}
                </div>

                <span className="text-[0.65rem] text-[var(--text-muted)] mt-0.5 mx-1">
                  {timeAgo(msg.createdAt)}
                </span>
              </div>

              {/* Reply button — shown on hover */}
              {hoveredId === msg.id && (
                <button
                  onClick={() => {
                    setReplyTo({ id: msg.id, name: msg.sender.name ?? "?", content: msg.content });
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-orange)] hover:border-orange-500/30 transition-colors cursor-pointer mb-5"
                >
                  <Reply size={11} />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border-subtle)] pt-3">
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
      </div>
    </div>
  );
}
