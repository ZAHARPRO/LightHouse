"use client";

import { useState } from "react";
import { Download, Lock, Loader2 } from "lucide-react";
import Link from "next/link";

type Props = {
  videoId: string;
  videoTitle: string;
  userTier?: string | null;
};

export default function DownloadVideoButton({ videoId, videoTitle, userTier }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDownload = userTier === "PRO" || userTier === "ELITE";

  if (!canDownload) {
    return (
      <Link
        href="/subscriptions"
        title="Pro or Elite plan required to download"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] text-sm font-display font-semibold opacity-70 no-underline hover:opacity-90 transition-opacity"
      >
        <Lock size={13} />
        Download
        <span className="text-[0.7rem] text-[#f97316] font-bold ml-0.5">Pro</span>
      </Link>
    );
  }

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/download`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }

      const a = document.createElement("a");
      a.href = data.url;
      a.download = `${videoTitle}.mp4`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm font-display font-semibold hover:text-[var(--text-primary)] hover:border-[var(--accent-orange)] transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        {loading ? "Preparing…" : "Download"}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
