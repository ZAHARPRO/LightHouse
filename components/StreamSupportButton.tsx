"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, Send, X } from "lucide-react";

interface Props {
  streamId: string;
  isLoggedIn: boolean;
}

export default function StreamSupportButton({ streamId, isLoggedIn }: Props) {
  const [open, setOpen]       = useState(false);
  const [text, setText]       = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const res = await fetch(`/api/streams/${streamId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, isSupport: true }),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setText("");
      setTimeout(() => { setSent(false); setOpen(false); }, 1800);
    }
  }

  if (!isLoggedIn) {
    return (
      <button
        disabled
        className="flex items-center gap-[0.4rem] py-[0.4rem] px-[0.875rem] rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-semibold text-sm opacity-50 cursor-not-allowed"
      >
        <Heart size={15} />
        Support
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-[0.4rem] py-[0.4rem] px-[0.875rem] rounded-lg",
          "font-display font-semibold text-sm transition-all duration-150",
          open
            ? "bg-pink-500/15 border border-pink-500/40 text-pink-400"
            : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-pink-500/40 hover:text-pink-400",
        ].join(" ")}
      >
        <Heart size={15} fill={open ? "currentColor" : "none"} />
        Support
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-40 w-72 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[12px] shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-pink-400" fill="currentColor" />
              <span className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)]">
                Support the stream
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={14} />
            </button>
          </div>

          <p className="text-[0.75rem] text-[var(--text-muted)] leading-relaxed">
            Send a highlighted message to show your support!
          </p>

          {sent ? (
            <div className="flex items-center justify-center gap-2 py-2 text-pink-400 font-display font-semibold text-sm">
              <Heart size={14} fill="currentColor" />
              Thanks for your support!
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                maxLength={100}
                placeholder="Write a support message…"
                className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-[0.4rem] text-[0.8125rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-pink-500/40 transition-colors"
              />
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-500 text-white disabled:opacity-30 transition-opacity hover:opacity-80 shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
