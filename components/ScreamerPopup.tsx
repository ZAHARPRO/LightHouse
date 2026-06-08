"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useSession } from "next-auth/react";

type Screamer = { id: string; videoUrl: string; bypassed: boolean; sender: { name: string | null } };

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export default function ScreamerPopup() {
  const { data: session } = useSession();
  const [current, setCurrent] = useState<Screamer | null>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const fetchPending = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/screamer/pending");
      const data: Screamer[] = await res.json();
      if (data.length > 0 && !visible) {
        setReady(false);
        setCurrent(data[0]);
        setVisible(true);
      }
    } catch { /* ignore */ }
  }, [session?.user?.id, visible]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  async function dismiss() {
    if (!current) return;
    setVisible(false);
    setReady(false);
    await fetch("/api/screamer/pending", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id }),
    });
    setTimeout(() => { setCurrent(null); fetchPending(); }, 400);
  }

  if (!visible || !current) return null;

  const ytId = isYouTube(current.videoUrl) ? extractYouTubeId(current.videoUrl) : null;

  return (
    <>
      {/* Hidden preload layer — video renders here, invisible until ready */}
      {!ready && (
        <div className="fixed inset-0 z-[99998] pointer-events-none opacity-0">
          {ytId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&mute=0`}
              allow="autoplay; fullscreen"
              className="absolute inset-0 w-full h-full border-none"
              onLoad={() => setReady(true)}
            />
          ) : (
            <video
              src={current.videoUrl}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onCanPlay={() => setReady(true)}
              onEnded={dismiss}
            />
          )}
        </div>
      )}

      {/* Visible popup — shown only once ready */}
      {ready && (
        <div
          className="fixed inset-0 z-[99999] bg-black flex items-center justify-center"
          style={{ animation: "fadeIn 0.15s ease both" }}
        >
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 z-[100001] flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
            title="Close"
          >
            <X size={14} />
          </button>

          {ytId ? (
            <div className="relative w-full h-full pointer-events-none">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&mute=0`}
                allow="autoplay; fullscreen"
                className="absolute inset-0 w-full h-full border-none"
                style={{ pointerEvents: "none" }}
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-black" />
              <div className="absolute inset-x-0 top-0 h-20 bg-black" />
            </div>
          ) : (
            <video
              src={current.videoUrl}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onEnded={dismiss}
            />
          )}

          <div className="absolute inset-0 z-[100000] pointer-events-none" />
        </div>
      )}
    </>
  );
}
