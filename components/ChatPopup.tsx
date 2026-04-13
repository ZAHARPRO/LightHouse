"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { sendChatMessage, getChatMessages } from "@/actions/chat";
import { Send, Maximize2, X, MessageSquare, Zap } from "lucide-react";

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

const DEMO_MESSAGES: Message[] = [
  { id: "d1", content: "Welcome to the LightHouse global chat! 🔥", createdAt: new Date(Date.now() - 180000), author: { id: "bot", name: "LightHouse Bot", image: null, tier: "ELITE" } },
  { id: "d2", content: "The new video feed update looks amazing!", createdAt: new Date(Date.now() - 120000), author: { id: "u1", name: "Alex Chen", image: null, tier: "PRO" } },
  { id: "d3", content: "Just subscribed to Elite — totally worth it", createdAt: new Date(Date.now() - 60000), author: { id: "u2", name: "Sarah M.", image: null, tier: "ELITE" } },
  { id: "d4", content: "Anyone here from the beta? 👋", createdAt: new Date(Date.now() - 20000), author: { id: "u3", name: "Marco V.", image: null, tier: "BASIC" } },
];

const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#6366f1", FREE: "#666",
};
const TIER_LABELS: Record<string, { label: string; color: string }> = {
  FREE:  { label: "Free",  color: "#888" },
  BASIC: { label: "Basic", color: "#818cf8" },
  PRO:   { label: "Pro",   color: "#fb923c" },
  ELITE: { label: "Elite", color: "#fbbf24" },
};

function Avatar({ name, tier }: { name: string; tier: string }) {
  const color = TIER_COLORS[tier] ?? "#666";
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{ background: `${color}22`, border: `2px solid ${color}44` }}
    >
      <span className="font-display font-bold text-[0.6875rem]" style={{ color }}>
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}

interface ChatPopupProps {
  onClose: () => void;
  isClosing: boolean;
  leftOffset?: number;
}

const ChatPopup = forwardRef<HTMLDivElement, ChatPopupProps>(function ChatPopup({ onClose, isClosing, leftOffset = 0 }, ref) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!session) return;
    getChatMessages(30).then((msgs) => {
      if (msgs.length > 0) setMessages(msgs as Message[]);
    });
  }, [session]);

  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !session || sending) return;
    setSending(true);
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      content: input.trim(),
      createdAt: new Date(),
      author: { id: session.user?.id ?? "", name: session.user?.name ?? "You", image: null, tier: "FREE" },
    };
    setMessages((prev) => [optimistic, ...prev]);
    setInput("");
    const result = await sendChatMessage(optimistic.content);
    if (result.message) {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? (result.message as Message) : m));
    }
    setSending(false);
  }

  return (
    <div
      ref={ref}
      /* On mobile: full-width, starts below navbar. On sm+: fixed 300px width */
      className="fixed top-16 flex flex-col w-full sm:w-[300px] bg-[var(--bg-card)] border-r border-[var(--border-subtle)] shadow-[6px_0_40px_rgba(0,0,0,0.45)] z-[3000]"
      style={{
        left: leftOffset,
        height: "calc(100vh - 64px)",
        animation: isClosing ? "slideOutLeft 0.18s ease both" : "slideInLeft 0.2s ease both",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[var(--accent-orange)]" />
          <span className="font-display font-bold text-sm text-[var(--text-primary)]">
            Global Chat
          </span>
        </div>

        <div className="flex items-center gap-[0.375rem]">
          {/* Full-screen → /chat */}
          <Link
            href="/chat"
            title="Open full chat"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors duration-150"
          >
            <Maximize2 size={13} />
          </Link>

          {/* Close */}
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
        {sorted.map((msg) => {
          const tier = TIER_LABELS[msg.author.tier] ?? TIER_LABELS.FREE;
          const isMe = msg.author.id === session?.user?.id;
          return (
            <div
              key={msg.id}
              className={["flex gap-2 items-start", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}
            >
              <Link href={`/profile/${msg.author.id}`} className="no-underline">
                <Avatar name={msg.author.name ?? "?"} tier={msg.author.tier} />
              </Link>

              <div className={["max-w-[75%] flex flex-col", isMe ? "items-end" : "items-start"].join(" ")}>
                {/* Name + badge */}
                <div className={["flex items-center gap-[0.375rem] mb-[0.2rem]", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}>
                  <Link
                    href={`/profile/${msg.author.id}`}
                    className="no-underline text-[var(--text-primary)] font-semibold text-[0.6875rem]"
                  >
                    {isMe ? "You" : msg.author.name}
                  </Link>
                  <span
                    className="text-[0.5625rem] font-semibold px-[0.3rem] py-[0.1rem] rounded-[3px]"
                    style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}
                  >
                    {tier.label}
                  </span>
                </div>

                {/* Bubble */}
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
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {session ? (
        <form
          onSubmit={handleSend}
          className="flex gap-2 px-[0.875rem] py-[0.625rem] border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say something…"
            maxLength={500}
            className="input-field flex-1 bg-[var(--bg-elevated)] text-[0.8125rem] h-9"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className={[
              "flex items-center justify-center shrink-0 h-9 px-[0.625rem] rounded-[7px]",
              "bg-[var(--accent-orange)] border-none cursor-pointer text-white transition-opacity duration-200",
              !input.trim() || sending ? "opacity-50" : "opacity-100",
            ].join(" ")}
          >
            <Send size={15} />
          </button>
        </form>
      ) : (
        <div className="border-t border-[var(--border-subtle)] px-[0.875rem] py-3 bg-[var(--bg-secondary)] shrink-0">
          <p className="flex items-center gap-[0.375rem] text-[var(--text-secondary)] text-[0.8125rem] mb-2">
            <Zap size={12} className="text-[var(--accent-orange)]" />
            Sign in to chat
          </p>
          <div className="flex gap-[0.375rem]">
            <Link href="/auth/signin" className="btn-ghost no-underline py-[0.3rem] px-[0.75rem] text-[0.8125rem] flex-1 text-center">
              Sign In
            </Link>
            <Link href="/auth/register" className="btn-primary no-underline py-[0.3rem] px-[0.75rem] text-[0.8125rem] flex-1 text-center">
              Join
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatPopup;
