"use client";

import { useRef, useState, useTransition } from "react";
import { createPost } from "@/actions/posts";
import { Send, FileText, AlignLeft, Crown, AlertCircle } from "lucide-react";

export default function PostForm() {
  const [isPremium, setIsPremium]  = useState(false);
  const [error, setError]          = useState<string | null>(null);
  const [content, setContent]      = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const MAX = 10000;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(formRef.current!);
    if (isPremium) fd.set("isPremium", "on");
    startTransition(async () => {
      const res = await createPost(fd);
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="flex flex-col gap-5">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-[0.625rem] px-4 py-[0.875rem] rounded-lg bg-red-500/10 border border-red-500/25 text-red-500 text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className={labelClass}>
            <FileText size={14} className="text-[var(--accent-orange)]" />
            Title
            <span className="text-[var(--accent-orange)]">*</span>
          </label>
          <input
            name="title"
            type="text"
            placeholder="What's this post about?"
            required
            maxLength={200}
            className="input-field"
          />
        </div>

        {/* Content */}
        <div>
          <label className={labelClass}>
            <AlignLeft size={14} className="text-[var(--accent-orange)]" />
            Content
            <span className="text-[var(--accent-orange)]">*</span>
            <span className={[
              "ml-auto text-xs font-medium",
              content.length > MAX * 0.9 ? "text-red-500" : "text-[var(--text-muted)]",
            ].join(" ")}>
              {content.length} / {MAX.toLocaleString()}
            </span>
          </label>
          <textarea
            name="content"
            placeholder="Share your thoughts, insights, or story…"
            required
            rows={12}
            maxLength={MAX}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input-field"
            style={{ resize: "vertical", minHeight: 280, lineHeight: 1.7 }}
          />
        </div>

        {/* Premium toggle */}
        <div
          onClick={() => setIsPremium((v) => !v)}
          className={[
            "flex items-center justify-between px-5 py-4 rounded-[10px] cursor-pointer",
            "transition-[background,border-color] duration-200",
            isPremium
              ? "bg-orange-500/[0.07] border border-orange-500/30"
              : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <Crown size={17} className={isPremium ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"} />
            <div>
              <p className={[
                "font-display font-bold text-[0.9rem]",
                isPremium ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
              ].join(" ")}>
                Premium Content
              </p>
              <p className="text-[0.8rem] text-[var(--text-muted)] mt-[0.1rem]">
                Only subscribers can read this post
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className={[
            "w-11 h-6 rounded-full shrink-0 relative transition-colors duration-200",
            isPremium
              ? "bg-[var(--accent-orange)] border-0"
              : "bg-[var(--bg-card)] border border-[var(--border-default)]",
          ].join(" ")}>
            <div className={[
              "absolute w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-all duration-200",
              isPremium ? "top-[3px] left-[23px]" : "top-[2px] left-[2px]",
            ].join(" ")} />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className={[
            "btn-primary flex items-center justify-center gap-2",
            "py-3 text-[0.9375rem] rounded-[10px]",
            pending ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          <Send size={16} />
          {pending ? "Publishing…" : "Publish Post"}
        </button>
      </div>
    </form>
  );
}

const labelClass = [
  "flex items-center gap-[0.375rem]",
  "font-display font-semibold text-[0.8125rem]",
  "text-[var(--text-secondary)] mb-2",
].join(" ");
