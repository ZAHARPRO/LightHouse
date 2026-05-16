"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Zap } from "lucide-react";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { useTranslations } from "next-intl";

type AdVideoData = { id: string; title: string; url: string; duration: number };

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch { /* invalid url */ }
  return null;
}

interface Props {
  onClose: () => void;
  onRecharged: (newHintPoints: number) => void;
}

export default function HintVideoModal({ onClose, onRecharged }: Props) {
  const t = useTranslations("puzzles");
  const [video, setVideo]           = useState<AdVideoData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [watched, setWatched]       = useState(false);
  const [claiming, setClaiming]     = useState(false);
  const [claimed, setClaimed]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [cooldownMin, setCooldownMin] = useState<number | null>(null);
  const [ytElapsed, setYtElapsed]   = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const ytAdRef    = useRef<YouTubePlayerHandle>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const watchedRef = useRef(false);
  const closedRef  = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/hints/ad-video")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: AdVideoData) => { setVideo(d); setLoading(false); })
      .catch(() => { setError(t("noVideo")); setLoading(false); });
  }, [t]);

  // Timer ticks only while YouTube video is playing
  useEffect(() => {
    if (!video || watchedRef.current) return;
    const ytId = getYouTubeId(video.url);
    if (!ytId || !isVideoPlaying) return;
    const target = Math.floor(video.duration * 0.9);
    timerRef.current = setInterval(() => {
      setYtElapsed(prev => {
        const next = prev + 1;
        if (next >= target && !watchedRef.current) {
          watchedRef.current = true;
          setWatched(true);
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [video, isVideoPlaying]);

  // Auto-claim when watched
  useEffect(() => {
    if (!watched || closedRef.current || claimed) return;
    claimPoints();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched]);

  function handleClose() {
    closedRef.current = true;
    onClose();
  }

  function handleTimeUpdate() {
    if (!video || watchedRef.current) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.currentTime >= video.duration * 0.9) {
      watchedRef.current = true;
      setWatched(true);
    }
  }

  async function claimPoints() {
    if (!video || claiming || claimed) return;
    setClaiming(true);
    const res = await fetch("/api/hints/recharge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id }),
    });
    const data = await res.json() as { ok?: boolean; hintPoints?: number; error?: string; waitMin?: number };
    setClaiming(false);
    if (data.ok && data.hintPoints !== undefined) {
      setClaimed(true);
      onRecharged(data.hintPoints);
    } else if (data.error === "cooldown") {
      setCooldownMin(data.waitMin ?? 30);
    } else {
      setError(t("rechargeError"));
    }
  }

  const renderVideo = (v: AdVideoData) => {
    const ytId = getYouTubeId(v.url);
    const target = Math.floor(v.duration * 0.9);
    if (ytId) {
      return (
        <div className="mb-4">
          <YouTubePlayer
            ref={ytAdRef}
            videoId={ytId}
            adMode
            onPlayPause={setIsVideoPlaying}
            onClose={handleClose}
            onEnded={() => { if (!watchedRef.current) { watchedRef.current = true; setWatched(true); } }}
            className="rounded-xl"
          />
          {!watched && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (ytElapsed / target) * 100)}%` }}
                />
              </div>
              <span className="text-[0.65rem] text-[var(--text-muted)] shrink-0">{Math.max(0, target - ytElapsed)}s</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <video
        ref={videoRef}
        src={v.url}
        controls
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { watchedRef.current = true; setWatched(true); }}
        className="w-full rounded-xl mb-4 bg-black"
        style={{ maxHeight: 240 }}
      />
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[960] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-md relative">
        {video && !getYouTubeId(video.url) && (
          <button onClick={handleClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        )}
        {!video && !loading && (
          <button onClick={handleClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-amber-400" />
          <h3 className="font-display font-bold text-[var(--text-primary)]">{t("rechargeTitle")}</h3>
        </div>
        <p className="text-[var(--text-muted)] text-sm mb-4">{t("rechargeDesc")}</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-6">{error}</p>
        ) : cooldownMin !== null ? (
          <p className="text-yellow-400 text-sm text-center py-6">{t("cooldown", { min: cooldownMin })}</p>
        ) : video ? (
          <>
            <p className="text-[var(--text-secondary)] text-xs font-display font-semibold mb-2">{video.title}</p>
            {renderVideo(video)}
            {watched && (
              <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 font-display font-bold text-sm">
                {claiming ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {claiming ? t("claimPoint") : t("claimPoint")}
              </div>
            )}
            {!watched && !getYouTubeId(video.url) && (
              <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-display font-bold text-sm opacity-50">
                <Zap size={14} />{t("watchToUnlock")}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
