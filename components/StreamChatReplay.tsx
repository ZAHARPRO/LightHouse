"use client";

import { useRef, useEffect } from "react";

type ChatMsg = {
  id: string;
  text: string;
  userName: string;
  userId: string;
  isSupport?: boolean;
  at: number;
};

function timeLabel(at: number) {
  const d = new Date(at);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  messages: ChatMsg[];
}

export default function StreamChatReplay({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] flex flex-col overflow-hidden" style={{ height: 420 }}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2 shrink-0">
        <span className="font-display font-bold text-[0.8rem] text-[var(--text-primary)]">Chat Replay</span>
        <span className="text-[0.65rem] text-[var(--text-muted)]">({messages.length} messages)</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {messages.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] text-xs py-6">No chat messages saved.</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className="flex gap-2 items-start text-[0.75rem]">
              <span className="text-[var(--text-muted)] shrink-0 mt-px text-[0.6rem] tabular-nums">
                {timeLabel(m.at)}
              </span>
              <div className={m.isSupport ? "bg-pink-500/10 rounded px-1.5 py-0.5 flex-1" : "flex-1"}>
                <span className={["font-display font-semibold mr-1.5", m.isSupport ? "text-pink-400" : "text-[var(--accent-orange)]"].join(" ")}>
                  {m.userName}
                  {m.isSupport && " 💝"}
                </span>
                <span className="text-[var(--text-secondary)] break-words">{m.text}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
