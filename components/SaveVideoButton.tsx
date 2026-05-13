"use client";

import { useState } from "react";
import { Bookmark , Loader2  } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  videoId: string;
  initialSaved: boolean; // передаётся с сервера
  isLoggedIn: boolean;
}

export default function SaveVideoButton({ videoId, initialSaved, isLoggedIn }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("saveButton");
  const bookMarkCheck = <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bookmark-check-icon lucide-bookmark-check"><path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/><path d="m9 10 2 2 4-4"/></svg>

  async function handleToggle() {
    if (!isLoggedIn || loading) return;

    // Оптимистичное обновление — UI меняется сразу, не ждём сервер
    setSaved((s) => !s);
    setLoading(true);

    try {
      await fetch("/api/saved", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
    } catch {
      // Откатываем если запрос упал
      setSaved((s) => !s);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={!isLoggedIn || loading}
      title={!isLoggedIn ? t("signInToSave") : saved ? t("saved") : t("save")}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-display font-semibold transition-colors",
        saved
          ? "border-pink-500/40 bg-pink-500/10 text-pink-400"
          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-pink-400",
        (!isLoggedIn || loading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : saved ? (
        bookMarkCheck
      ) : (
        <Bookmark size={13} />
      )}
      {saved ? t("saved") : t("save")}
    </button>
  );
}
