"use client";

import { useState, useEffect, useRef, forwardRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { sendChatMessage } from "@/actions/chat";
import { Send, Maximize2, X, MessageSquare, Zap, Reply } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

type Message = {
  id: string;
  content: string;
  createdAt: string | Date;
  author: { id: string; name: string | null; image: string | null; tier: string; lastActiveAt?: string | Date | null };
  isError?: boolean;
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  FREE: { label: "Free", color: "#888" },
  BASIC: { label: "Basic", color: "#818cf8" },
  PRO: { label: "Pro", color: "#fb923c" },
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

interface ChatPopupProps {
  onClose: () => void;
  isClosing: boolean;
  leftOffset?: number;
}

const ChatPopup = forwardRef<HTMLDivElement, ChatPopupProps>(function ChatPopup({ onClose, isClosing, leftOffset = 0 }, ref) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Stable ref to the session-start ISO string — set once on mount
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
        // Keep any optimistic messages that haven't been confirmed yet
        const optimistics = prev.filter((m) => optimisticsRef.current.has(m.id));
        const serverIds = new Set(data.map((m) => m.id));
        const unconfirmed = optimistics.filter((m) => !serverIds.has(m.id));
        return [...data, ...unconfirmed];
      });
    } catch {
      // network error — keep existing state
    }
  }, []);

  // Poll every 3 seconds while popup is open
  useEffect(() => {
    if (!session) return;
    // Small delay so sinceRef is set by the time first fetch runs
    const first = setTimeout(fetchMessages, 50);
    const interval = setInterval(fetchMessages, 3000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [session, fetchMessages]);

  // Ping presence every 30s
  useEffect(() => {
    if (!session) return;
    const ping = () => fetch("/api/presence", { method: "POST" });
    ping();
    const t = setInterval(ping, 30000);
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
      author: { id: session.user?.id ?? "", name: session.user?.name ?? "You", image: null, tier: "FREE" },
    };
    optimisticsRef.current.add(optId);
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setReplyTo(null);

    const result = await sendChatMessage(optimistic.content);
    optimisticsRef.current.delete(optId);
    if (result.message) {
      setMessages((prev) => prev.map((m) => m.id === optId ? (result.message as Message) : m));
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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640); // tailwind sm
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [position, setPosition] = useState({ x: leftOffset, y: 64 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

function onMouseDown(e: React.MouseEvent) {
  if (isMobile) return;

  dragging.current = true;

  dragOffset.current = {
    x: e.clientX - position.x,
    y: e.clientY - position.y,
  };
}

function onMouseUp() {
  dragging.current = false;
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.current || isMobile) return;

  const maxX = window.innerWidth - 320;
  const maxY = window.innerHeight - 100;

  setPosition({
    x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, maxX)),
    y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, maxY)),
  });
}



  useEffect(() => {
  if (isMobile) return;

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  return () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}, [isMobile]);


  return (
    <div
      ref={ref}
      className="fixed top-16 flex flex-col w-full sm:w-[300px] bg-[var(--bg-card)] border-r border-[var(--border-subtle)] shadow-[6px_0_40px_rgba(0,0,0,0.45)] z-[3000]"
      style={{
        left: isMobile ? leftOffset : position.x,
        top: isMobile ? undefined : position.y,
        height:"calc(100vh - 64px)",
        animation: isClosing ? "slideOutLeft 0.18s ease both" : "slideInLeft 0.2s ease both",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={onMouseDown}
  style={{
  cursor: dragging.current ? "grabbing" : "grab"
}}
      className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[var(--accent-orange)]" />
          <span className="font-display font-bold text-sm text-[var(--text-primary)]">Global Chat</span>
        </div>
        <div className="flex items-center gap-[0.375rem]">
          <Link
            href="/chat"
            title="Open full chat"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors duration-150"
          >
            <Maximize2 size={13} />
          </Link>
          <button
            onClick={onClose}
            title="Close chat"
            className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-[0.875rem] flex flex-col gap-3">
        {messages.length === 0 && session && (
          <p className="text-[var(--text-muted)] text-xs italic text-center py-8">No messages yet. Say something!</p>
        )}
        {messages.map((msg) => {
          const tier = TIER_LABELS[msg.author.tier] ?? TIER_LABELS.FREE;
          const isMe = msg.author.id === session?.user?.id;

          if (msg.isError) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.75rem] font-display font-semibold"
                  style={{ background: "rgba(239,68,68,0.10)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                  ⚠ {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={["flex gap-2 items-start group relative", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Link href={`/profile/${msg.author.id}`} className="no-underline">
                <UserAvatar
                  name={msg.author.name ?? "?"}
                  tier={msg.author.tier}
                  image={msg.author.image}
                  online={!isMe && isOnline(msg.author.lastActiveAt)}
                />
              </Link>

              <div className={["max-w-[75%] flex flex-col", isMe ? "items-end" : "items-start"].join(" ")}>
                <div className={["flex items-center gap-[0.375rem] mb-[0.2rem]", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}>
                  <Link href={`/profile/${msg.author.id}`} className="no-underline text-[var(--text-primary)] font-semibold text-[0.6875rem]">
                    {isMe ? "You" : msg.author.name}
                  </Link>
                  <span className="text-[0.5625rem] font-semibold px-[0.3rem] py-[0.1rem] rounded-[3px]"
                    style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}>
                    {tier.label}
                  </span>
                </div>

                <div className={["flex items-end gap-1.5", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}>
                  <div
                    className="px-[0.625rem] py-2 text-[0.8125rem] text-[var(--text-primary)] leading-[1.45] break-words"
                    style={{
                      background: isMe ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                      border: isMe ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                      borderRadius: isMe ? "10px 3px 10px 10px" : "3px 10px 10px 10px",
                    }}
                  >
                    {msg.content}
                  </div>

                  {!isMe && session && hoveredId === msg.id && (
                    <button
                      onClick={() => { setReplyTo({ id: msg.id, name: msg.author.name ?? "?" }); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors duration-150 mb-[2px]"
                      title={`Reply to ${msg.author.name}`}
                    >
                      <Reply size={11} />
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
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between px-[0.875rem] pt-[0.5rem] pb-[0.25rem]">
              <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--accent-orange)]">
                <Reply size={11} />
                Replying to <strong>{replyTo.name}</strong>
              </span>
              <button onClick={() => setReplyTo(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-150">
                <X size={12} />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2 px-[0.875rem] py-[0.625rem]">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Say something…"}
              maxLength={500}
              className="input-field flex-1 bg-[var(--bg-elevated)] text-[0.8125rem] h-9"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className={["flex items-center justify-center shrink-0 h-9 px-[0.625rem] rounded-[7px] bg-[var(--accent-orange)] border-none cursor-pointer text-white transition-opacity duration-200",
                !input.trim() || sending ? "opacity-50" : "opacity-100"].join(" ")}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      ) : (
        <div className="border-t border-[var(--border-subtle)] px-[0.875rem] py-3 bg-[var(--bg-secondary)] shrink-0">
          <p className="flex items-center gap-[0.375rem] text-[var(--text-secondary)] text-[0.8125rem] mb-2">
            <Zap size={12} className="text-[var(--accent-orange)]" />
            Sign in to chat
          </p>
          <div className="flex gap-[0.375rem]">
            <Link href="/auth/signin" className="btn-ghost no-underline py-[0.3rem] px-[0.75rem] text-[0.8125rem] flex-1 text-center">Sign In</Link>
            <Link href="/auth/register" className="btn-primary no-underline py-[0.3rem] px-[0.75rem] text-[0.8125rem] flex-1 text-center">Join</Link>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatPopup;
