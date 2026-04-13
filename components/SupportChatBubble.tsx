"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useSession } from "next-auth/react";
import { MessageCircle, X, Send, Headphones, ChevronDown } from "lucide-react";
import { sendSupportMessage, getUserConversation } from "@/actions/support";
import Link from "next/link";

type Msg = {
  id: string;
  content: string;
  isFromStaff: boolean;
  createdAt: Date;
  sender: { id: string; name: string | null };
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function SupportChatBubble() {
  const { data: session } = useSession();
  const [open, setOpen]         = useState(false);
  const [closing, setClosing]   = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [convId, setConvId]     = useState<string | null>(null);
  const [staffOnline, setStaffOnline] = useState(false);
  const [pending, start]        = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  /* load existing conversation */
  useEffect(() => {
    if (!session?.user?.id) return;
    getUserConversation().then((conv) => {
      if (conv) {
        setConvId(conv.id);
        setMessages(conv.messages as Msg[]);
      }
    });
  }, [session?.user?.id]);

  /* poll staff online status every 30 s */
  useEffect(() => {
    function check() {
      fetch("/api/support/status")
        .then((r) => r.json())
        .then((d) => setStaffOnline(d.online === true))
        .catch(() => {});
    }
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  function handleClose() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 180);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !session) return;
    const content = input.trim();
    setInput("");
    const optimistic: Msg = {
      id: `opt-${Date.now()}`,
      content,
      isFromStaff: false,
      createdAt: new Date(),
      sender: { id: session.user.id, name: session.user.name ?? "You" },
    };
    setMessages((p) => [...p, optimistic]);
    start(async () => {
      const res = await sendSupportMessage(content);
      if (res.message) {
        setConvId((res.message as { conversationId: string }).conversationId);
        setMessages((p) =>
          p.map((m) => m.id === optimistic.id ? (res.message as Msg) : m)
        );
      }
    });
  }

  /* don't render for staff — they have their own panel */
  if (session?.user?.role && ["ADMIN","OPERATOR","STAFF"].includes(session.user.role)) return null;

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => open ? handleClose() : setOpen(true)}
        className="fixed bottom-6 right-6 z-[4000] w-14 h-14 rounded-full bg-[var(--accent-orange)] text-white flex items-center justify-center shadow-[0_4px_24px_rgba(249,115,22,0.45)] transition-transform duration-200 hover:scale-110 border-none cursor-pointer"
        title="Support chat"
      >
        {open ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        {/* unread dot — staff reply received */}
        {!open && messages.some((m) => m.isFromStaff) && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white border-2 border-[var(--accent-orange)]" />
        )}
        {/* online indicator on bubble */}
        {!open && staffOnline && (
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white" />
        )}
      </button>

      {/* Chat popup */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[4000] w-[320px] flex flex-col rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-[var(--border-subtle)]"
          style={{
            height: 440,
            animation: closing ? "slideOutDown 0.18s ease both" : "slideInUp 0.2s ease both",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[var(--accent-orange)] shrink-0">
            <div className="relative w-8 h-8 shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Headphones size={15} color="white" />
              </div>
              {/* online dot on avatar */}
              <span
                className={[
                  "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--accent-orange)]",
                  staffOnline ? "bg-green-400" : "bg-white/40",
                ].join(" ")}
              />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold text-sm text-white leading-none">Support</p>
              <p className="flex items-center gap-1 text-[0.7rem] text-white/80 mt-0.5">
                <span
                  className={[
                    "w-1.5 h-1.5 rounded-full",
                    staffOnline ? "bg-green-400" : "bg-white/40",
                  ].join(" ")}
                />
                {staffOnline ? "Online — we'll reply shortly" : "Offline — leave a message"}
              </p>
            </div>
            <button onClick={handleClose} className="bg-transparent border-none cursor-pointer text-white/80 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[var(--bg-card)]">
            {messages.length === 0 && (
              <div className="text-center mt-6">
                <Headphones size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
                <p className="text-[var(--text-secondary)] text-[0.8rem]">Hi! How can we help?</p>
                <p className="text-[var(--text-muted)] text-[0.75rem] mt-1">Send a message and our team will reply.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={["flex flex-col", msg.isFromStaff ? "items-start" : "items-end"].join(" ")}
              >
                {msg.isFromStaff && (
                  <span className="text-[0.65rem] text-[var(--text-muted)] mb-0.5 ml-1">
                    {msg.sender.name ?? "Support"}
                  </span>
                )}
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl text-[0.8125rem] leading-snug break-words"
                  style={{
                    background: msg.isFromStaff ? "var(--bg-elevated)" : "var(--accent-orange)",
                    color: msg.isFromStaff ? "var(--text-primary)" : "white",
                    borderBottomLeftRadius: msg.isFromStaff ? 4 : undefined,
                    borderBottomRightRadius: msg.isFromStaff ? undefined : 4,
                  }}
                >
                  {msg.content}
                </div>
                <span className="text-[0.65rem] text-[var(--text-muted)] mt-0.5 mx-1">
                  {timeAgo(msg.createdAt)}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {session ? (
            <form
              onSubmit={handleSend}
              className="flex gap-2 px-3 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] shrink-0"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                maxLength={1000}
                className="input-field flex-1 text-[0.8125rem] h-9"
              />
              <button
                type="submit"
                disabled={!input.trim() || pending}
                className={[
                  "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] border-none text-white cursor-pointer transition-opacity duration-150",
                  !input.trim() || pending ? "opacity-50" : "opacity-100",
                ].join(" ")}
              >
                <Send size={14} />
              </button>
            </form>
          ) : (
            <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] shrink-0 text-center">
              <p className="text-[var(--text-muted)] text-[0.8rem] mb-2">Sign in to contact support</p>
              <Link href="/auth/signin" className="btn-primary no-underline py-1.5 px-4 text-sm">Sign In</Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
