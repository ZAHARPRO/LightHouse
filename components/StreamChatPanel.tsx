"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Heart } from "lucide-react";

type ChatMsg = {
  id: string;
  text: string;
  userName: string;
  userId: string;
  isSupport?: boolean;
  at: number;
};

interface Props {
  streamId: string;
  currentUserId: string;
  initialMessages?: ChatMsg[];
}

export default function StreamChatPanel({
  streamId,
  currentUserId,
  initialMessages = [],
}: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  useEffect(() => {
    if (!streamId) return;
    const es = new EventSource(`/api/streams/${streamId}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "chat") setMsgs((prev) => [...prev, data as ChatMsg]);
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [streamId]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    await fetch(`/api/streams/${streamId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    }).catch(() => {});
    setSending(false);
    inputRef.current?.focus();
  }

  function formatTime(ms: number) {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] overflow-hidden h-full min-h-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <MessageSquare size={14} className="text-[var(--accent-orange)]" />
        <span className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)]">Live Chat</span>
        <span className="ml-auto text-[0.6875rem] text-[var(--text-muted)]">{msgs.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--border-subtle)_transparent]">
        {msgs.length === 0 && (
          <p className="text-[0.75rem] text-[var(--text-muted)] italic text-center mt-4">
            No messages yet. Be the first to say hi!
          </p>
        )}

        {msgs.map((m) => {
          const isMe = m.userId === currentUserId;

          if (m.isSupport) {
            return (
              <div key={m.id} className="flex flex-col items-center my-1">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] max-w-[95%] text-center"
                  style={{ background: "linear-gradient(135deg,#831843 0%,#9d174d 100%)", border: "1px solid rgba(244,114,182,0.3)" }}
                >
                  <Heart size={11} className="text-pink-300 shrink-0" fill="currentColor" />
                  <span className="text-[0.6875rem] font-display font-bold text-pink-200 truncate max-w-[80px]">{m.userName}</span>
                  <span className="text-[0.6875rem] text-pink-100 break-words leading-snug">{m.text}</span>
                  <Heart size={11} className="text-pink-300 shrink-0" fill="currentColor" />
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                {!isMe && (
                  <span className="text-[0.6875rem] font-display font-semibold text-[var(--accent-orange)] truncate max-w-[120px]">
                    {m.userName}
                  </span>
                )}
                <span className="text-[0.6rem] text-[var(--text-muted)]">{formatTime(m.at)}</span>
              </div>
              <div
                className="px-3 py-1.5 rounded-2xl text-[0.8125rem] max-w-[85%] break-words leading-snug"
                style={{
                  background: isMe ? "var(--accent-orange)" : "var(--bg-elevated)",
                  color: isMe ? "#fff" : "var(--text-primary)",
                  border: isMe ? "none" : "1px solid var(--border-subtle)",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--border-subtle)] shrink-0">
        <input
          ref={inputRef}
          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-[0.4rem] text-[0.8125rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-orange-500/40 transition-colors"
          placeholder="Say something…"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] text-white disabled:opacity-30 transition-opacity hover:opacity-80 shrink-0"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
