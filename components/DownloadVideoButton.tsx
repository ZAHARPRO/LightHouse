"use client";

import { useState } from "react";
import { Download, Music, Lock, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { audioBufferToWav } from "@/lib/audioBufferToWav";

type Props = {
  videoId: string;
  userTier?: string | null;
};

type VideoInfo = {
  url: string;
  title: string;
  urlType: "youtube" | "gdrive" | "direct";
  filename: string;
  canEliteAudio: boolean;
};

type DownloadState = "idle" | "loading" | "done" | "error";

export default function DownloadVideoButton({ videoId, userTier }: Props) {
  const [videoState, setVideoState] = useState<DownloadState>("idle");
  const [audioState, setAudioState] = useState<DownloadState>("idle");
  const [audioProgress, setAudioProgress] = useState(0);
  const [info, setInfo] = useState<VideoInfo | null>(null);

  const isPro   = userTier === "PRO" || userTier === "ELITE";
  const isElite = userTier === "ELITE";

  // Not subscribed
  if (!isPro) {
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

  async function fetchInfo(): Promise<VideoInfo | null> {
    if (info) return info;
    const res  = await fetch(`/api/videos/${videoId}/download`);
    if (!res.ok) return null;
    const data = await res.json() as VideoInfo;
    setInfo(data);
    return data;
  }

  async function handleVideoDownload() {
    if (videoState !== "idle") return;
    setVideoState("loading");
    try {
      const meta = await fetchInfo();
      if (!meta) { setVideoState("error"); return; }

      if (meta.urlType !== "direct") {
        // YouTube / GDrive — open original in new tab
        window.open(meta.url, "_blank", "noopener,noreferrer");
        setVideoState("done");
        return;
      }

      // Direct URL — proxy stream download
      const a = document.createElement("a");
      a.href = `/api/videos/${videoId}/download?stream=true`;
      a.download = `${meta.filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setVideoState("done");
    } catch {
      setVideoState("error");
    }
    setTimeout(() => setVideoState("idle"), 3000);
  }

  async function handleAudioExtract() {
    if (audioState !== "idle") return;
    setAudioState("loading");
    setAudioProgress(0);
    try {
      const meta = await fetchInfo();
      if (!meta || !meta.canEliteAudio) {
        setAudioState("error");
        return;
      }

      // 1. Fetch video file via proxy
      setAudioProgress(10);
      const res = await fetch(`/api/videos/${videoId}/download?stream=true`);
      if (!res.ok || !res.body) { setAudioState("error"); return; }

      // Read full body (needed for AudioContext.decodeAudioData)
      setAudioProgress(30);
      const arrayBuffer = await res.arrayBuffer();

      // 2. Decode audio with Web Audio API
      setAudioProgress(60);
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      // 3. Convert to WAV
      setAudioProgress(85);
      const wavBlob = audioBufferToWav(audioBuffer);

      // 4. Trigger download
      const url = URL.createObjectURL(wavBlob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `${meta.filename}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setAudioProgress(100);
      setAudioState("done");
    } catch {
      setAudioState("error");
    }
    setTimeout(() => { setAudioState("idle"); setAudioProgress(0); }, 3000);
  }

  const videoLabel = () => {
    if (videoState === "loading") return <><Loader2 size={13} className="animate-spin" /> Preparing…</>;
    if (videoState === "done")    return <><Download size={13} className="text-green-400" /> Done!</>;
    if (videoState === "error")   return <><Download size={13} className="text-red-400" /> Error</>;
    // If YouTube/GDrive, show external icon hint
    if (info && info.urlType !== "direct") return <><ExternalLink size={13} /> Open video</>;
    return <><Download size={13} /> MP4</>;
  };

  const audioLabel = () => {
    if (audioState === "loading") return <><Loader2 size={13} className="animate-spin" /> {audioProgress}%</>;
    if (audioState === "done")    return <><Music size={13} className="text-green-400" /> Done!</>;
    if (audioState === "error")   return <><Music size={13} className="text-red-400" /> Error</>;
    return <><Music size={13} /> Audio</>;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Video download — Pro + Elite */}
      <button
        onClick={handleVideoDownload}
        disabled={videoState === "loading"}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm font-display font-semibold hover:text-[var(--text-primary)] hover:border-[#f97316] transition-colors disabled:opacity-50"
      >
        {videoLabel()}
      </button>

      {/* Audio extract — Elite only */}
      {isElite && (
        <button
          onClick={handleAudioExtract}
          disabled={audioState === "loading"}
          title={info && !info.canEliteAudio ? "Audio extraction only works for direct video URLs" : "Extract audio as WAV"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm font-display font-semibold hover:text-[var(--text-primary)] hover:border-[#fbbf24] transition-colors disabled:opacity-50"
        >
          {audioLabel()}
          <span className="text-[0.65rem] text-[#fbbf24] font-bold">Elite</span>
        </button>
      )}
    </div>
  );
}
