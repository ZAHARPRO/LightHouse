"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare } from "lucide-react";

export type ChatMsg = { userId: string; name: string; text: string; at: number };

interface GameChatProps {
  msgs: ChatMsg[];
  myUserId: string;
  roomId: string;
  apiBase: string; // "/api/chess-rooms" or "/api/ms-rooms"
}

export default function GameChat({ msgs, myUserId, roomId, apiBase }: GameChatProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    await fetch(`${apiBase}/${roomId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    }).catch(() => {});
    setSending(false);
  }

  return (
    <div className="flex flex-col border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-elevated)]" style={{ height: 220 }}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border-subtle)]">
        <MessageSquare size={12} className="text-[var(--text-muted)]" />
        <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5 min-h-0">
        {msgs.length === 0 && (
          <p className="text-[0.7rem] text-[var(--text-muted)] italic mt-1">No messages yet</p>
        )}
        {msgs.map((m, i) => {
          const isMe = m.userId === myUserId;
          return (
            <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <span className="text-[0.6rem] text-[var(--text-muted)] mb-0.5">{isMe ? "You" : m.name}</span>
              <div
                className="px-2.5 py-1.5 rounded-xl text-[0.75rem] max-w-[85%] break-words leading-snug"
                style={{
                  background: isMe ? "var(--accent-orange)" : "var(--bg-card)",
                  color: isMe ? "#fff" : "var(--text-primary)",
                  border: isMe ? "none" : "1px solid var(--border-subtle)",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border-subtle)]">
        <input
          className="flex-1 bg-transparent text-[0.8rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Message…"
          value={text}
          maxLength={200}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="text-[var(--accent-orange)] disabled:opacity-30 transition-opacity hover:opacity-70"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
