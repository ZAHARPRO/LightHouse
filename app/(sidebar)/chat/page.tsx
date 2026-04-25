"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { sendChatMessage } from "@/actions/chat";
import { Send, MessageSquare, Users, Zap, ArrowLeft, Reply, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

type Message = {
  id: string;
  content: string;
  createdAt: string | Date;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    tier: string;
    lastActiveAt?: string | Date | null;
  };
  isError?: boolean;
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  FREE:  { label: "Free",  color: "#888" },
  BASIC: { label: "Basic", color: "#818cf8" },
  PRO:   { label: "Pro",   color: "#fb923c" },
  ELITE: { label: "Elite", color: "#fbbf24" },
};

function isOnline(lastActiveAt?: string | Date | null): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 2 * 60 * 1000;
}

function getSessionStart(): string {
  const key = "chatSessionStart";
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const now = new Date().toISOString();
  sessionStorage.setItem(key, now);
  return now;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sinceRef = useRef<string | null>(null);
  const optimisticsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sinceRef.current = getSessionStart();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    if (!sinceRef.current) return;
    try {
      const res = await fetch(`/api/chat-messages?since=${encodeURIComponent(sinceRef.current)}&limit=50`);
      if (!res.ok) return;
      const data: Message[] = await res.json();
      setMessages((prev) => {
        const optimistics = prev.filter((m) => optimisticsRef.current.has(m.id));
        const serverIds = new Set(data.map((m) => m.id));
        const unconfirmed = optimistics.filter((m) => !serverIds.has(m.id));
        return [...data, ...unconfirmed];
      });
    } catch {
      // keep existing state on network error
    }
  }, []);

  // Poll messages every 3s
  useEffect(() => {
    if (!session) return;
    const first = setTimeout(fetchMessages, 50);
    const interval = setInterval(fetchMessages, 3000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [session, fetchMessages]);

  // Ping presence + fetch online count every 30s
  useEffect(() => {
    if (!session) return;
    const tick = async () => {
      await fetch("/api/presence", { method: "POST" });
      const res = await fetch("/api/presence");
      if (res.ok) {
        const { count } = await res.json();
        setOnlineCount(count);
      }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [session]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !session || sending) return;
    setSending(true);

    const content = replyTo ? `@${replyTo.name} ${input.trim()}` : input.trim();
    const optId = `opt-${Date.now()}`;
    const optimistic: Message = {
      id: optId,
      content,
      createdAt: new Date().toISOString(),
      author: { id: session.user?.id ?? "", name: session.user?.name ?? "You", image: session.user?.image ?? null, tier: "FREE" },
    };

    optimisticsRef.current.add(optId);
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setReplyTo(null);

    const result = await sendChatMessage(optimistic.content);
    optimisticsRef.current.delete(optId);
    if (result.message) {
      setMessages((prev) => prev.map((m) => (m.id === optId ? (result.message as Message) : m)));
    } else if (result.error) {
      const errId = `err-${Date.now()}`;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optId),
        { id: errId, content: result.error!, createdAt: new Date().toISOString(), author: { id: "system", name: "System", image: null, tier: "FREE" }, isError: true },
      ]);
      setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== errId)), 6000);
    }
    setSending(false);
  }

  return (
    <div className="max-w-[860px] mx-auto px-6 py-10 h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/feed"
            className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-3 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-colors duration-150 hover:text-[var(--text-primary)] hover:border-[var(--border-default)]"
          >
            <ArrowLeft size={13} />
            Back to Feed
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={18} color="var(--accent-orange)" />
            <h1 className="font-display font-extrabold text-[1.75rem] tracking-[-0.03em]">Global Chat</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">Live conversation — messages clear when you leave</p>
        </div>
        {onlineCount !== null && (
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[0.8125rem]">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <Users size={14} />
            <span>{onlineCount} online</span>
          </div>
        )}
      </div>

      {/* Chat window */}
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.length === 0 && session && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <MessageSquare size={32} className="text-[var(--text-muted)] opacity-30" />
              <p className="text-[var(--text-muted)] text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const tier = TIER_LABELS[msg.author.tier] ?? TIER_LABELS.FREE;
            const isMe = msg.author.id === session?.user?.id;

            if (msg.isError) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.78rem] font-display font-semibold"
                    style={{ background: "rgba(239,68,68,0.10)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                    ⚠ {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={["animate-in flex gap-3 items-start group", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}
                onMouseEnter={() => setHoveredId(msg.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <UserAvatar
                  name={msg.author.name ?? "?"}
                  image={msg.author.image}
                  tier={msg.author.tier}
                  size="md"
                  online={!isMe && isOnline(msg.author.lastActiveAt)}
                />

                <div className={["max-w-[70%] flex flex-col", isMe ? "items-end" : "items-start"].join(" ")}>
                  <div className={["flex items-center gap-2 mb-1", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}>
                    <span className="font-display font-semibold text-[0.8125rem] text-[var(--text-primary)]">
                      {isMe ? "You" : msg.author.name}
                    </span>
                    <span style={{ color: tier.color, background: `${tier.color}18`, border: `1px solid ${tier.color}30` }}
                      className="text-[0.6875rem] font-semibold py-0.5 px-1.5 rounded">
                      {tier.label}
                    </span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)]">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className={["flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}>
                    <div className={["py-[0.625rem] px-[0.875rem] text-[0.9rem] text-[var(--text-primary)] leading-relaxed break-words",
                      isMe ? "bg-orange-500/[0.12] border border-orange-500/20 rounded-[12px_4px_12px_12px]"
                           : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[4px_12px_12px_12px]"].join(" ")}>
                      {msg.content}
                    </div>

                    {!isMe && session && hoveredId === msg.id && (
                      <button
                        onClick={() => { setReplyTo({ id: msg.id, name: msg.author.name ?? "?" }); setTimeout(() => inputRef.current?.focus(), 50); }}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors duration-150 mb-[2px]"
                        title={`Reply to ${msg.author.name}`}
                      >
                        <Reply size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {session ? (
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            {replyTo && (
              <div className="flex items-center justify-between px-5 pt-3 pb-1">
                <span className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--accent-orange)]">
                  <Reply size={13} />
                  Replying to <strong>{replyTo.name}</strong>
                </span>
                <button onClick={() => setReplyTo(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-150">
                  <X size={14} />
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="py-[0.875rem] px-5 flex gap-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Say something to the world…"}
                maxLength={500}
                className="input-field flex-1 bg-[var(--bg-elevated)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className={["bg-[var(--accent-orange)] border-none rounded-lg p-3 cursor-pointer flex items-center justify-center shrink-0 transition-opacity duration-200",
                  !input.trim() || sending ? "opacity-50" : "opacity-100"].join(" ")}
              >
                <Send size={18} color="white" />
              </button>
            </form>
          </div>
        ) : (
          <div className="border-t border-[var(--border-subtle)] py-4 px-5 bg-[var(--bg-secondary)] flex items-center justify-between">
            <span className="text-[var(--text-secondary)] text-[0.9rem] flex items-center gap-1.5">
              <Zap size={14} color="var(--accent-orange)" />
              Sign in to join the conversation
            </span>
            <div className="flex gap-2">
              <Link href="/auth/signin" className="btn-ghost no-underline py-1.5 px-4 text-sm">Sign In</Link>
              <Link href="/auth/register" className="btn-primary no-underline py-1.5 px-4 text-sm">Join Free</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
