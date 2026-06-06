"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import {
  createAnnouncementMessage,
  toggleAnnouncementMessage,
  deleteAnnouncementMessage,
} from "@/actions/announcement-messages";

type Message = {
  id: string;
  text: string;
  emoji: string;
  color: string;
  enabled: boolean;
  createdAt: Date;
};

const PRESET_COLORS = [
  "#f97316", "#ef4444", "#8b5cf6", "#0ea5e9", "#22c55e", "#f59e0b",
];

export default function AnnouncementMessagesSection({ initial }: { initial: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState("#f97316");
  const [emoji, setEmoji] = useState("📢");

  function handleCreate(formData: FormData) {
    formData.set("color", color);
    formData.set("emoji", emoji);
    startTransition(async () => {
      await createAnnouncementMessage(formData);
      formRef.current?.reset();
      setEmoji("📢");
      // optimistic: server revalidates
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)));
    startTransition(() => toggleAnnouncementMessage(id, enabled));
  }

  function handleDelete(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    startTransition(() => deleteAnnouncementMessage(id));
  }

  return (
    <div className="mt-10">
      <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1">
        Pop-up Messages
      </h2>
      <p className="text-[var(--text-muted)] text-sm mb-4">
        These appear as notification toasts at random intervals for all logged-in users.
        Enable/disable individual messages without deleting them.
      </p>

      {/* Create form */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-5">
        <form ref={formRef} action={handleCreate} className="flex flex-col gap-3">
          <div className="flex gap-2">
            {/* Emoji picker */}
            <input
              name="emoji_display"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📢"
              className="w-14 text-center text-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-2 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
            />
            <input
              name="text"
              required
              placeholder="Pop-up message text…"
              className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-orange)]"
            />
          </div>

          {/* Color swatches */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: color === c ? "white" : "transparent",
                  boxShadow: color === c ? `0 0 0 1px ${c}` : undefined,
                }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              title="Custom color"
            />
            <div
              className="ml-auto px-3 py-1 rounded-lg text-xs font-bold"
              style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}
            >
              {emoji} Preview
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 self-start px-4 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add message
          </button>
        </form>
      </div>

      {/* List */}
      {messages.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No pop-up messages yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3"
              style={{ borderColor: m.enabled ? `${m.color}40` : undefined }}
            >
              <span className="text-xl shrink-0">{m.emoji}</span>
              <p
                className="flex-1 text-sm min-w-0 truncate"
                style={{ color: m.enabled ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {m.text}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(m.id, !m.enabled)}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                  title={m.enabled ? "Disable" : "Enable"}
                >
                  {m.enabled
                    ? <ToggleRight size={20} style={{ color: m.color }} />
                    : <ToggleLeft size={20} className="text-[var(--text-muted)]" />}
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
