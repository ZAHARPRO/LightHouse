"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { useTranslations } from "next-intl";
import type { Card } from "@/lib/durak";

type AdVideoData = { id: string; title: string; url: string; duration: number };
export type AdMode = "coins" | "discard";

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch { /* bad url */ }
  return null;
}

interface Props {
  mode: AdMode;
  roomId?: string;
  side?: "left" | "right";
  onClose: () => void;
  onCoinsEarned?: (newTotal: number) => void;
  onDiscardRevealed?: (cards: Card[]) => void;
}

export default function DurakAdPanel({
  mode, roomId, side = "right", onClose, onCoinsEarned, onDiscardRevealed,
}: Props) {
  const t = useTranslations("durak");
  const [video, setVideo] = useState<AdVideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [watched, setWatched] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [cooldownMin, setCooldownMin] = useState<number | null>(null);

  const ytRef = useRef<YouTubePlayerHandle>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchedRef = useRef(false);
  const closedRef = useRef(false);

  useEffect(() => {
    fetch("/api/hints/ad-video")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: AdVideoData) => { setVideo(d); setLoading(false); })
      .catch(() => { setError(t("noVideoAd")); setLoading(false); });
  }, [t]);

  // Tick while YouTube video is playing
  useEffect(() => {
    if (!video || watchedRef.current) return;
    const ytId = getYouTubeId(video.url);
    if (!ytId || !isPlaying) return;
    const target = Math.floor(video.duration * 0.9);
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
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
  }, [video, isPlaying]);

  // Auto-claim after watched
  useEffect(() => {
    if (!watched || closedRef.current || claimed) return;
    claimReward();
  }, [watched]); // eslint-disable-line

  async function claimReward() {
    if (!video || claiming || claimed) return;
    setClaiming(true);
    if (mode === "coins") {
      const res = await fetch("/api/durak-coins/watch-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });
      const d = await res.json() as { ok?: boolean; durakCoins?: number; error?: string; waitMin?: number };
      setClaiming(false);
      if (d.ok && d.durakCoins !== undefined) {
        setClaimed(true);
        onCoinsEarned?.(d.durakCoins);
      } else if (d.error === "cooldown") {
        setCooldownMin(d.waitMin ?? 15);
      } else {
        setError(t("adClaimError"));
      }
    } else {
      // discard mode — just fetch the discard pile (ad was the gate)
      const res = await fetch(`/api/durak-rooms/${roomId}/discard`);
      const d = await res.json() as { cards?: Card[]; error?: string };
      setClaiming(false);
      if (d.cards) {
        setClaimed(true);
        onDiscardRevealed?.(d.cards);
      } else {
        setError(t("adClaimError"));
      }
    }
  }

  const posClass = side === "left"
    ? "fixed left-2 top-1/2 -translate-y-1/2 z-40"
    : "fixed right-2 top-1/2 -translate-y-1/2 z-40";

  return (
    <div className={`${posClass} w-72 bg-[var(--bg-elevated)] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)] bg-amber-500/5">
        <div className="flex items-center gap-2">
          <span className="text-base">{mode === "coins" ? "🪙" : "🃏"}</span>
          <span className="font-display font-bold text-xs text-[var(--text-primary)]">
            {mode === "coins" ? t("earnCoins") : t("viewDiscard")}
          </span>
        </div>
        <button
          onClick={() => { closedRef.current = true; onClose(); }}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-xs text-center py-4">{error}</p>
        ) : cooldownMin !== null ? (
          <p className="text-yellow-400 text-xs text-center py-4">
            {t("cooldown", { min: cooldownMin })}
          </p>
        ) : claimed ? (
          <p className="text-emerald-400 text-xs text-center py-4 font-semibold">
            {mode === "coins" ? `🪙 +1 ${t("coinEarned")}` : `✓ ${t("discardRevealed")}`}
          </p>
        ) : video ? (
          <>
            <p className="text-[var(--text-muted)] text-[0.65rem] mb-2">
              {mode === "coins" ? t("watchAdForCoins") : t("watchAdForDiscard")}
            </p>
            {(() => {
              const ytId = getYouTubeId(video.url);
              const target = Math.floor(video.duration * 0.9);
              if (ytId) {
                return (
                  <>
                    <div className="rounded-xl overflow-hidden mb-2" style={{ aspectRatio: "16/9" }}>
                      <YouTubePlayer
                        ref={ytRef}
                        videoId={ytId}
                        adMode
                        onPlayPause={setIsPlaying}
                        onClose={() => { closedRef.current = true; onClose(); }}
                        onEnded={() => {
                          if (!watchedRef.current) { watchedRef.current = true; setWatched(true); }
                        }}
                        className="w-full h-full"
                      />
                    </div>
                    {!watched && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[0.6rem] text-[var(--text-muted)] shrink-0">
                          {Math.max(0, target - elapsed)}s
                        </span>
                      </div>
                    )}
                    {watched && claiming && (
                      <div className="flex items-center justify-center gap-1.5 mt-2 text-amber-400 text-[0.65rem]">
                        <Loader2 size={11} className="animate-spin" />
                        {t("claiming")}
                      </div>
                    )}
                  </>
                );
              }
              // Native video fallback
              return (
                <video
                  src={video.url}
                  controls
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (el.currentTime >= video.duration * 0.9 && !watchedRef.current) {
                      watchedRef.current = true;
                      setWatched(true);
                    }
                  }}
                  onEnded={() => { watchedRef.current = true; setWatched(true); }}
                  className="w-full rounded-xl mb-2 bg-black"
                  style={{ maxHeight: 150 }}
                />
              );
            })()}
          </>
        ) : null}
      </div>
    </div>
  );
}
