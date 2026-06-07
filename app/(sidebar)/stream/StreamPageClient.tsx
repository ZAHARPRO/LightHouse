"use client";

import { useState } from "react";
import { Monitor, Radio, Clock, ExternalLink, Eye, Play, Lock } from "lucide-react";
import Link from "next/link";
import StreamBroadcaster from "@/components/StreamBroadcaster";
import StreamChatPanel from "@/components/StreamChatPanel";

type RecommendedVideo = {
  id: string;
  title: string;
  duration: number | null;
  views: number;
  isPremium: boolean;
  author: { id: string; name: string | null };
};

const THUMB_COLORS = [
  ["#1a1a2e", "#f97316"],
  ["#0a1628", "#6366f1"],
  ["#1a0a0a", "#ef4444"],
  ["#0a1a0a", "#10b981"],
  ["#1a1a0a", "#fbbf24"],
];

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface Props {
  userId: string;
  userName: string;
  recommendations: RecommendedVideo[];
}

function elapsed(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StreamPageClient({ userId, userName, recommendations }: Props) {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [startedAt] = useState(() => new Date().toISOString());

  function handleStreamChange(id: string | null) {
    setStreamId(id);
  }

  const isLive = !!streamId;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-[10px] bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
          <Monitor size={17} className="text-[var(--accent-orange)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-extrabold text-[1.1rem] tracking-[-0.02em] text-[var(--text-primary)] leading-none">
              {isLive ? "Live" : "Go Live"}
            </h1>
            {isLive && (
              <span className="flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.15rem] px-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[0.6rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
              </span>
            )}
          </div>
          {isLive ? (
            <div className="flex items-center gap-3 mt-1 text-[0.75rem] text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><Radio size={11} /> Broadcasting</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {elapsed(startedAt)}</span>
              {streamId && (
                <button
                  onClick={() => window.open(`/stream/overlay/${streamId}`, "chatOverlay", "width=400,height=640,toolbar=no,location=no,menubar=no,resizable=yes")}
                  className="flex items-center gap-1 text-[var(--accent-orange)] hover:opacity-80 transition-opacity font-semibold"
                >
                  <ExternalLink size={11} /> Chat overlay
                </button>
              )}
            </div>
          ) : (
            <p className="text-[0.8rem] text-[var(--text-muted)] mt-0.5">
              Set up your stream, then click Start Streaming
            </p>
          )}
        </div>
      </div>

      {/* Main grid: video | chat */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-4">
          <StreamBroadcaster onStreamChange={handleStreamChange} />
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(64px+1.5rem)]">
          {isLive && streamId ? (
            <StreamChatPanel
              streamId={streamId}
              currentUserId={userId}
              currentUserName={userName}
              isStreamOwner
              initialMessages={[]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-8 text-[var(--text-muted)] min-h-[200px]">
              <Monitor size={32} strokeWidth={1.2} />
              <p className="text-sm font-display text-center">Chat will appear once you start streaming</p>
            </div>
          )}

          {/* Video recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-3">
              <p className="font-display font-bold text-[0.75rem] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-2.5">
                Up Next
              </p>
              <div className="flex flex-col gap-2">
                {recommendations.map((v, i) => {
                  const [sbg, sacc] = THUMB_COLORS[i % THUMB_COLORS.length];
                  return (
                    <Link
                      key={v.id}
                      href={`/watch/${v.id}`}
                      className="flex gap-2.5 no-underline rounded-[8px] p-1.5 hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      <div
                        style={{ background: `linear-gradient(135deg, ${sbg} 0%, ${sacc}33 100%)` }}
                        className="w-[88px] h-[50px] rounded-[6px] shrink-0 relative flex items-center justify-center overflow-hidden"
                      >
                        {v.isPremium ? (
                          <Lock size={13} color={sacc} />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                            <Play size={9} color="white" fill="white" className="ml-px" />
                          </div>
                        )}
                        {v.duration && (
                          <span className="absolute bottom-0.5 right-0.5 bg-black/70 rounded-[3px] px-1 text-[0.55rem] text-[#ddd]">
                            {formatDuration(v.duration)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-[0.75rem] text-[var(--text-primary)] leading-tight line-clamp-2 mb-0.5">
                          {v.title}
                        </p>
                        <p className="text-[0.65rem] text-[var(--text-muted)]">{v.author.name}</p>
                        <p className="flex items-center gap-1 text-[0.6rem] text-[var(--text-muted)] mt-0.5">
                          <Eye size={9} /> {formatViews(v.views)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
