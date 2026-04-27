"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Save, Crown } from "lucide-react";
import { updatePost } from "@/actions/posts";
import { useTranslations } from "next-intl";

export default function EditPostPage({ params }: { params: { id: string } }) {
  const t = useTranslations("post");
  const { id } = params;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [title, setTitle]     = useState("");
  const [content, setContent] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setTitle(data.title);
        setContent(data.content);
        setIsPremium(data.isPremium);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load post"); setLoading(false); });
  }, [id]);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-[740px] mx-auto px-6 py-10">
        <div className="h-8 w-32 bg-[var(--bg-elevated)] rounded animate-pulse mb-6" />
        <div className="h-64 bg-[var(--bg-elevated)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!session) {
    router.replace("/auth/signin");
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("content", content);
    if (isPremium) fd.set("isPremium", "on");
    start(async () => {
      const res = await updatePost(id, fd);
      if (res && "error" in res) { setError(res.error ?? "Error"); return; }
      router.push(`/post/${id}`);
    });
  }

  return (
    <div className="max-w-[740px] mx-auto px-6 py-10">
      <Link
        href={`/post/${id}`}
        className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-7 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeft size={13} /> {t("backToPost")}
      </Link>

      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl px-10 py-8">
        <h1 className="font-display font-extrabold text-[1.5rem] tracking-[-0.02em] text-[var(--text-primary)] mb-6">
          {t("editPost")}
        </h1>

        {error && (
          <p className="text-red-500 text-sm mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="font-display font-semibold text-sm text-[var(--text-secondary)]">
              {t("titleLabel")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="input-field"
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="font-display font-semibold text-sm text-[var(--text-secondary)]">
              {t("contentLabel")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              required
              className="input-field leading-relaxed"
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Premium toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
            <div
              onClick={() => setIsPremium((v) => !v)}
              className={[
                "w-10 h-[22px] rounded-full relative transition-colors duration-200",
                isPremium ? "bg-[var(--accent-orange)]" : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                  isPremium ? "translate-x-[22px]" : "translate-x-[3px]",
                ].join(" ")}
              />
            </div>
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] font-display font-semibold">
              <Crown size={13} className="text-[#fbbf24]" /> {t("premiumToggle")}
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={pending || !title.trim() || !content.trim()}
              className={[
                "flex items-center gap-2 px-6 py-2.5 rounded-lg font-display font-semibold text-sm",
                "bg-[var(--accent-orange)] border-none text-white transition-opacity duration-150",
                pending || !title.trim() || !content.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <Save size={15} />
              {pending ? t("saving") : t("saveChanges")}
            </button>
            <Link
              href={`/post/${id}`}
              className="px-5 py-2.5 rounded-lg font-display font-semibold text-sm no-underline bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
