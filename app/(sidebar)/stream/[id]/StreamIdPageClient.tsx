"use client";

import { useState } from "react";
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
  const [isEnded, setIsEnded] = useState(!initialStream.isActive);

  function handleStreamChange(id: string | null) {
    if (!id) setIsEnded(true);
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        {initialStream.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initialStream.thumbnail}
            alt=""
            className="w-16 h-9 rounded-[8px] object-cover border border-[var(--border-subtle)] shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-[10px] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Monitor size={17} className="text-[var(--accent-orange)]" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-extrabold text-[1.1rem] tracking-[-0.02em] text-[var(--text-primary)] leading-none truncate">
              {initialStream.title}
            </h1>
            {initialStream.isActive && !isEnded && (
              <span className="flex items-center gap-1.5 bg-red-600 rounded-[5px] py-[0.15rem] px-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[0.6rem] font-bold text-white font-display tracking-[0.06em] uppercase">Live</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-[0.75rem] text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><Radio size={11} /> {initialStream.admin.name}</span>
            {initialStream.isActive && !isEnded && (
              <>
                <span className="flex items-center gap-1"><Users size={11} /> {initialStream.viewerCount} viewers</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {elapsed(initialStream.startedAt)}</span>
              </>
            )}
          </div>

          {initialStream.description && (
            <p className="text-[0.8rem] text-[var(--text-secondary)] mt-1 leading-relaxed line-clamp-2">
              {initialStream.description}
            </p>
          )}

          {/* Action buttons row */}
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

      {/* Main grid: video | chat */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-4">
          {isStreamOwner
            ? <StreamBroadcaster existingStreamId={streamId} onStreamChange={handleStreamChange} />
            : <StreamViewer streamId={streamId} />
          }
        </div>

        <div className="lg:sticky lg:top-[calc(64px+1.5rem)]">
          {!isEnded ? (
            <StreamChatPanel
              streamId={streamId}
              currentUserId={userId}
              initialMessages={initialMessages}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-8 text-[var(--text-muted)] min-h-[200px]">
              <Monitor size={32} strokeWidth={1.2} />
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
