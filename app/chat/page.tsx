"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { sendChatMessage, getChatMessages } from "@/actions/chat";
import { Send, MessageSquare, Users, Zap } from "lucide-react";

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    tier: string;
  };
};

const DEMO_MESSAGES: Message[] = [
  { id: "d1", content: "Welcome to the LightHouse global chat! 🔥", createdAt: new Date(Date.now() - 180000), author: { id: "bot", name: "LightHouse Bot", image: null, tier: "ELITE" } },
  { id: "d2", content: "The new video feed update looks amazing!", createdAt: new Date(Date.now() - 120000), author: { id: "u1", name: "Alex Chen", image: null, tier: "PRO" } },
  { id: "d3", content: "Just subscribed to Elite — totally worth it", createdAt: new Date(Date.now() - 60000), author: { id: "u2", name: "Sarah M.", image: null, tier: "ELITE" } },
  { id: "d4", content: "Anyone else here from the beta? 👋", createdAt: new Date(Date.now() - 20000), author: { id: "u3", name: "Marco V.", image: null, tier: "BASIC" } },
];

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  FREE:  { label: "Free",  color: "#888" },
  BASIC: { label: "Basic", color: "#818cf8" },
  PRO:   { label: "Pro",   color: "#fb923c" },
  ELITE: { label: "Elite", color: "#fbbf24" },
};

function Avatar({ name, tier }: { name: string; tier: string }) {
  const colors: Record<string, string> = {
    ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#6366f1", FREE: "#666",
  };
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: `${colors[tier] ?? "#666"}22`,
      border: `2px solid ${colors[tier] ?? "#666"}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.75rem", color: colors[tier] }}>
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}

export default function ChatPage() {
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
    getChatMessages(50).then((msgs) => {
      if (msgs.length > 0) setMessages(msgs as Message[]);
    });
  }, [session]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !session || sending) return;
    setSending(true);

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      content: input.trim(),
      createdAt: new Date(),
      author: {
        id: session.user?.id ?? "",
        name: session.user?.name ?? "You",
        image: session.user?.image ?? null,
        tier: "FREE",
      },
    };

    setMessages((prev) => [optimistic, ...prev]);
    setInput("");

    const result = await sendChatMessage(optimistic.content);
    if (result.message) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? (result.message as Message) : m))
      );
    }
    setSending(false);
  }

  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "2.5rem 1.5rem", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <MessageSquare size={18} color="var(--accent-orange)" />
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.75rem", letterSpacing: "-0.03em" }}>
              Global Chat
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Live conversation — everyone can see your messages</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
          <Users size={14} />
          <span>1,243 online</span>
        </div>
      </div>

      {/* Chat window */}
      <div
        style={{
          flex: 1,
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sorted.map((msg) => {
            const tier = TIER_LABELS[msg.author.tier] ?? TIER_LABELS.FREE;
            const isMe = msg.author.id === session?.user?.id;

            return (
              <div
                key={msg.id}
                className="animate-in"
                style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", flexDirection: isMe ? "row-reverse" : "row" }}
              >
                <Avatar name={msg.author.name ?? "?"} tier={msg.author.tier} />
                <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexDirection: isMe ? "row-reverse" : "row" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                      {isMe ? "You" : msg.author.name}
                    </span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.375rem", borderRadius: 4, background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}>
                      {tier.label}
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{
                    background: isMe ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                    border: isMe ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                    borderRadius: isMe ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                    padding: "0.625rem 0.875rem",
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
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
              padding: "0.875rem 1.25rem",
              display: "flex",
              gap: "0.75rem",
              background: "var(--bg-secondary)",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say something to the world…"
              maxLength={500}
              className="input-field"
              style={{ flex: 1, background: "var(--bg-elevated)" }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              style={{
                background: "var(--accent-orange)",
                border: "none",
                borderRadius: 8,
                padding: "0.75rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: !input.trim() || sending ? 0.5 : 1,
                transition: "opacity 0.2s",
                flexShrink: 0,
              }}
            >
              <Send size={18} color="white" />
            </button>
          </form>
        ) : (
          <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "1rem 1.25rem", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              <Zap size={14} color="var(--accent-orange)" style={{ display: "inline", marginRight: 6 }} />
              Sign in to join the conversation
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Link href="/auth/signin" className="btn-ghost" style={{ textDecoration: "none", padding: "0.375rem 1rem", fontSize: "0.875rem" }}>Sign In</Link>
              <Link href="/auth/register" className="btn-primary" style={{ textDecoration: "none", padding: "0.375rem 1rem", fontSize: "0.875rem" }}>Join Free</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
