"use client";

import { useState, useTransition } from "react";
import { createNewsPost } from "@/actions/news";
import { Loader2, Send } from "lucide-react";

export default function NewsAdminForm() {
  const [title, setTitle]     = useState("");
  const [content, setContent] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start]      = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    start(async () => {
      const res = await createNewsPost(title, content);
      if ("error" in res) {
        setError(res.error ?? "Something went wrong");
      } else {
        setTitle("");
        setContent("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] font-display font-semibold text-[var(--text-muted)]">
          Title
        </label>
        <input
          className="input-field text-sm"
          placeholder="Announcement title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] font-display font-semibold text-[var(--text-muted)]">
          Content
        </label>
        <textarea
          className="input-field text-sm leading-relaxed"
          placeholder="Write the announcement body… (supports line breaks)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          style={{ resize: "vertical" }}
          required
        />
      </div>

      {error && (
        <p className="text-red-400 text-[0.8125rem] font-display">{error}</p>
      )}
      {success && (
        <p className="text-emerald-400 text-[0.8125rem] font-display">
          ✓ Published successfully
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !title.trim() || !content.trim()}
          className={[
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm",
            "bg-[var(--accent-orange)] text-white border-none cursor-pointer",
            "disabled:opacity-50 disabled:cursor-not-allowed transition-opacity",
          ].join(" ")}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Publish
        </button>
      </div>
    </form>
  );
}
