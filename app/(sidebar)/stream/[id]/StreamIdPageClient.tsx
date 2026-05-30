"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Radio, Users, Clock } from "lucide-react";
import StreamBroadcaster from "@/components/StreamBroadcaster";
import StreamViewer from "@/components/StreamViewer";
import StreamChatPanel from "@/components/StreamChatPanel";
import StreamReactionButtons from "@/components/StreamReactionButtons";
import StreamSupportButton from "@/components/StreamSupportButton";
import SubscribeButton from "@/components/SubscribeButton";
import ReportButton from "@/components/ReportButton";

type InitialStream = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  isActive: boolean;
  startedAt: string;
  viewerCount: number;
  adminId: string;
  admin: { id: string; name: string | null; image: string | null };
};

type ChatMsg = {
  id: string;
  text: string;
  userName: string;
  userId: string;
  isSupport?: boolean;
  at: number;
};

interface Props {
  isStreamOwner: boolean;
  streamId: string;
  userId: string;
  userName: string;
  isLoggedIn: boolean;
  initialStream: InitialStream;
  initialMessages: ChatMsg[];
  initialLikes: number;
  initialDislikes: number;
  initialUserReaction: "LIKE" | "DISLIKE" | null;
  initialFollowing: boolean;
}

function elapsed(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StreamIdPageClient({
  isStreamOwner, streamId, userId, isLoggedIn,
  initialStream, initialMessages,
  initialLikes, initialDislikes, initialUserReaction, initialFollowing,
}: Props) {
  const router = useRouter();
  const [isEnded,      setIsEnded]      = useState(!initialStream.isActive);
  const [viewerCount,  setViewerCount]  = useState(initialStream.viewerCount);

  useEffect(() => {
    const es = new EventSource(`/api/streams/${streamId}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "viewer_count") setViewerCount(data.count as number);
        if (data.type === "stream_ended") setIsEnded(true);
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [streamId]);

  function handleStreamChange(id: string | null) {
    if (!id) setIsEnded(true);
  }

  return (
    <div className="max-w-[1400px] mx-auto">

      {/* ── Main grid: video left | chat right ── */}
      {/* On mobile: single column, video → meta → chat stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 lg:gap-4 items-start">

        {/* Left column */}
        <div className="flex flex-col gap-3">

          {/* Video card */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[12px] sm:rounded-[14px] p-2 sm:p-4">
            {isStreamOwner
              ? <StreamBroadcaster existingStreamId={streamId} onStreamChange={handleStreamChange} />
              : <StreamViewer streamId={streamId} />
            }
          </div>

          {/* Stream meta + actions (below video) */}
          <div className="px-1">
            {/* Title row */}
            <div className="flex items-start gap-2.5">
              {initialStream.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={initialStream.thumbnail}
                  alt=""
                  className="w-14 h-8 sm:w-16 sm:h-9 rounded-[6px] object-cover border border-[var(--border-subtle)] shrink-0 mt-0.5"
                />
              ) : (
                <div className="w-8 h-8 rounded-[8px] bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor size={15} className="text-[var(--accent-orange)]" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-extrabold text-[1rem] sm:text-[1.1rem] tracking-[-0.02em] text-[var(--text-primary)] leading-tight">
                    {initialStream.title}
                  </h1>
                  {initialStream.isActive && !isEnded && (
                    <span className="flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.15rem] px-2 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-[0.6rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[0.7rem] sm:text-[0.75rem] text-[var(--text-muted)] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Radio size={10} /> {initialStream.admin.name}
                  </span>
                  {initialStream.isActive && !isEnded && (
                    <>
                      <span className="flex items-center gap-1">
                        <Users size={10} /> {viewerCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {elapsed(initialStream.startedAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {initialStream.description && (
              <p className="text-[0.8rem] text-[var(--text-secondary)] mt-2 leading-relaxed line-clamp-3 sm:line-clamp-2">
                {initialStream.description}
              </p>
            )}

            {/* Action buttons */}
            {!isStreamOwner && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <StreamReactionButtons
                  streamId={streamId}
                  initialLikes={initialLikes}
                  initialDislikes={initialDislikes}
                  initialUserReaction={initialUserReaction}
                  isOwner={false}
                  isLoggedIn={isLoggedIn}
                />
                <SubscribeButton
                  creatorId={initialStream.adminId}
                  initialFollowing={initialFollowing}
                />
                {initialStream.isActive && !isEnded && (
                  <StreamSupportButton streamId={streamId} isLoggedIn={isLoggedIn} />
                )}
                <ReportButton
                  targetId={initialStream.adminId}
                  targetName={initialStream.admin.name ?? "this stream"}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right column — chat */}
        <div className="lg:sticky lg:top-[calc(64px+1.5rem)]">
          {!isEnded ? (
            <StreamChatPanel
              streamId={streamId}
              currentUserId={userId}
              initialMessages={initialMessages}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-8 text-[var(--text-muted)] min-h-[160px] sm:min-h-[200px]">
              <Monitor size={28} strokeWidth={1.2} />
              <p className="text-sm font-display text-center">Stream has ended</p>
              <button onClick={() => router.push("/feed")} className="btn-primary text-sm py-1.5 px-4">
                Back to Feed
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
