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
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.875rem 1rem", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444", fontSize: "0.875rem",
          }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label style={labelStyle}>
            <FileText size={14} color="var(--accent-orange)" />
            Title
            <span style={{ color: "var(--accent-orange)" }}>*</span>
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
          <label style={labelStyle}>
            <AlignLeft size={14} color="var(--accent-orange)" />
            Content
            <span style={{ color: "var(--accent-orange)" }}>*</span>
            <span style={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              color: content.length > MAX * 0.9 ? "#ef4444" : "var(--text-muted)",
              fontWeight: 500,
            }}>
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
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1rem 1.25rem", borderRadius: 10, cursor: "pointer",
            background: isPremium ? "rgba(249,115,22,0.07)" : "var(--bg-elevated)",
            border: isPremium ? "1px solid rgba(249,115,22,0.3)" : "1px solid var(--border-subtle)",
            transition: "background 0.2s, border-color 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Crown size={17} color={isPremium ? "var(--accent-orange)" : "var(--text-muted)"} />
            <div>
              <p style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem",
                color: isPremium ? "var(--text-primary)" : "var(--text-secondary)",
              }}>
                Premium Content
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                Only subscribers can read this post
              </p>
            </div>
          </div>
          {/* Toggle */}
          <div style={{
            width: 44, height: 24, borderRadius: 12, flexShrink: 0, position: "relative",
            background: isPremium ? "var(--accent-orange)" : "var(--bg-card)",
            border: isPremium ? "none" : "1px solid var(--border-default)",
            transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: isPremium ? 3 : 2, left: isPremium ? 23 : 2,
              width: 18, height: 18, borderRadius: "50%", background: "white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)", transition: "left 0.2s, top 0.2s",
            }} />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            padding: "0.75rem", fontSize: "0.9375rem", borderRadius: 10,
            opacity: pending ? 0.6 : 1, cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          <Send size={16} />
          {pending ? "Publishing…" : "Publish Post"}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem",
  color: "var(--text-secondary)", marginBottom: "0.5rem",
};
