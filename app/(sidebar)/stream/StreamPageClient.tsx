"use client";

import { useState } from "react";
import { Monitor, Radio, Clock, ExternalLink } from "lucide-react";
import StreamBroadcaster from "@/components/StreamBroadcaster";
import StreamChatPanel from "@/components/StreamChatPanel";

interface Props {
  userId: string;
  userName: string;
}

function elapsed(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StreamPageClient({ userId, userName }: Props) {
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

        <div className="lg:sticky lg:top-[calc(64px+1.5rem)]">
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
        </div>
      </div>
    </div>
  );
}
