"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { sendChatMessage, getChatMessages } from "@/actions/chat";
import { Send, MessageSquare, Users, Zap, ArrowLeft } from "lucide-react";

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
  const color = colors[tier] ?? "#666";
  return (
    <div
      style={{
        width: 34, height: 34,
        background: `${color}22`,
        border: `2px solid ${color}44`,
      }}
      className="rounded-full flex items-center justify-center shrink-0"
    >
      <span style={{ color }} className="font-[var(--font-display)] font-bold text-[0.75rem]">
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
            <h1 className="font-[var(--font-display)] font-extrabold text-[1.75rem] tracking-[-0.03em]">
              Global Chat
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">Live conversation — everyone can see your messages</p>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[0.8125rem]">
          <Users size={14} />
          <span>1,243 online</span>
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {sorted.map((msg) => {
            const tier = TIER_LABELS[msg.author.tier] ?? TIER_LABELS.FREE;
            const isMe = msg.author.id === session?.user?.id;

            return (
              <div
                key={msg.id}
                className={[
                  "animate-in flex gap-3 items-start",
                  isMe ? "flex-row-reverse" : "flex-row",
                ].join(" ")}
              >
                <Avatar name={msg.author.name ?? "?"} tier={msg.author.tier} />
                <div className={[
                  "max-w-[70%] flex flex-col",
                  isMe ? "items-end" : "items-start",
                ].join(" ")}>
                  <div className={[
                    "flex items-center gap-2 mb-1",
                    isMe ? "flex-row-reverse" : "flex-row",
                  ].join(" ")}>
                    <span className="font-[var(--font-display)] font-semibold text-[0.8125rem] text-[var(--text-primary)]">
                      {isMe ? "You" : msg.author.name}
                    </span>
                    <span
                      style={{ color: tier.color, background: `${tier.color}18`, border: `1px solid ${tier.color}30` }}
                      className="text-[0.6875rem] font-semibold py-0.5 px-1.5 rounded"
                    >
                      {tier.label}
                    </span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)]">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div
                    className={[
                      "py-[0.625rem] px-[0.875rem] text-[0.9rem] text-[var(--text-primary)] leading-relaxed break-words",
                      isMe
                        ? "bg-orange-500/[0.12] border border-orange-500/20 rounded-[12px_4px_12px_12px]"
                        : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[4px_12px_12px_12px]",
                    ].join(" ")}
                  >
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
            className="border-t border-[var(--border-subtle)] py-[0.875rem] px-5 flex gap-3 bg-[var(--bg-secondary)]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say something to the world…"
              maxLength={500}
              className="input-field flex-1 bg-[var(--bg-elevated)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className={[
                "bg-[var(--accent-orange)] border-none rounded-lg p-3 cursor-pointer flex items-center justify-center shrink-0 transition-opacity duration-200",
                !input.trim() || sending ? "opacity-50" : "opacity-100",
              ].join(" ")}
            >
              <Send size={18} color="white" />
            </button>
          </form>
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