"use client";

import { useState, useEffect, useRef } from "react";
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
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: `${TIER_COLORS[tier] ?? "#666"}22`,
      border: `2px solid ${TIER_COLORS[tier] ?? "#666"}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.6875rem", color: TIER_COLORS[tier] }}>
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}

interface ChatPopupProps {
  onClose: () => void;
  /** x offset from left edge of viewport in px — used to align with the sidebar */
  leftOffset?: number;
}

export default function ChatPopup({ onClose, leftOffset = 0 }: ChatPopupProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startClose() {
    setIsClosing(true);
    setTimeout(onClose, 180);
  }

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

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Left buffer: within 10px to the left of the panel — don't close
    if (e.clientX < rect.left && e.clientX >= rect.left - 10) return;
    // Right buffer: less than 10px past the right edge — don't close
    if (e.clientX > rect.right && e.clientX <= rect.right + 10) return;
    leaveTimer.current = setTimeout(startClose, 120);
  }

  function handleMouseEnter() {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  return (
    <div
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        position: "fixed",
        left: leftOffset,
        top: 64,
        width: 300,
        height: "calc(100vh - 64px)",
        zIndex: 3000,
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "6px 0 40px rgba(0,0,0,0.45)",
        animation: isClosing
          ? "slideOutLeft 0.18s ease both"
          : "slideInLeft 0.2s ease both",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-elevated)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <MessageSquare size={14} color="var(--accent-orange)" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            Global Chat
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {/* Full-screen button → /chat */}
          <Link
            href="/chat"
            title="Open full chat"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              textDecoration: "none", color: "var(--text-secondary)",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-orange)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(249,115,22,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-subtle)";
            }}
          >
            <Maximize2 size={13} />
          </Link>

          {/* Close */}
          <button
            onClick={startClose}
            title="Close chat"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)",
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {sorted.map((msg) => {
          const tier = TIER_LABELS[msg.author.tier] ?? TIER_LABELS.FREE;
          const isMe = msg.author.id === session?.user?.id;
          return (
            <div key={msg.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexDirection: isMe ? "row-reverse" : "row" }}>
              <Link href={`/profile/${msg.author.id}`} style={{ textDecoration: "none" }}>
                <Avatar name={msg.author.name ?? "?"} tier={msg.author.tier} />
              </Link>
              <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.2rem", flexDirection: isMe ? "row-reverse" : "row" }}>
                  <Link href={`/profile/${msg.author.id}`} style={{ textDecoration: "none", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.6875rem" }}>
                    {isMe ? "You" : msg.author.name}
                  </Link>
                  <span style={{ fontSize: "0.5625rem", fontWeight: 600, padding: "0.1rem 0.3rem", borderRadius: 3, background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}>
                    {tier.label}
                  </span>
                </div>
                <div style={{
                  background: isMe ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                  border: isMe ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                  borderRadius: isMe ? "10px 3px 10px 10px" : "3px 10px 10px 10px",
                  padding: "0.5rem 0.625rem",
                  fontSize: "0.8125rem",
                  color: "var(--text-primary)",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {session ? (
        <form
          onSubmit={handleSend}
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "0.625rem 0.875rem",
            display: "flex", gap: "0.5rem",
            background: "var(--bg-secondary)",
            flexShrink: 0,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say something…"
            maxLength={500}
            className="input-field"
            style={{ flex: 1, background: "var(--bg-elevated)", fontSize: "0.8125rem", height: 36 }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={{
              background: "var(--accent-orange)", border: "none", borderRadius: 7,
              padding: "0 0.625rem", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: !input.trim() || sending ? 0.5 : 1, transition: "opacity 0.2s",
              flexShrink: 0, height: 36,
            }}
          >
            <Send size={15} color="white" />
          </button>
        </form>
      ) : (
        <div style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "0.75rem 0.875rem",
          background: "var(--bg-secondary)",
          flexShrink: 0,
        }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Zap size={12} color="var(--accent-orange)" />
            Sign in to chat
          </p>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <Link href="/auth/signin" className="btn-ghost" style={{ textDecoration: "none", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", flex: 1, textAlign: "center" }}>Sign In</Link>
            <Link href="/auth/register" className="btn-primary" style={{ textDecoration: "none", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", flex: 1, textAlign: "center" }}>Join</Link>
          </div>
        </div>
      )}
    </div>
  );
}
