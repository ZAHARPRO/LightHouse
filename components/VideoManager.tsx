"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Play, Eye, ThumbsUp, Edit2, Trash2, Upload, X, Check,
  Clock, Crown, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { updateVideo, deleteVideo, reuploadVideo } from "@/actions/videos";

type Video = {
  id: string; title: string; description: string | null;
  url: string; thumbnail: string | null; duration: number | null;
  views: number; isPremium: boolean; createdAt: Date;
  _count: { likes: number };
};

const THUMB_COLORS = [
  ["#1a1a2e","#f97316"],["#0a1628","#6366f1"],["#1a0a0a","#ef4444"],
  ["#0a1a0a","#10b981"],["#1a1a0a","#fbbf24"],
];

function fmt(secs: number) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  if (h>0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

function fmtViews(n: number) {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n>=1_000) return `${(n/1_000).toFixed(0)}K`;
  return String(n);
}

export default function VideoManager({ initialVideos }: { initialVideos: Video[] }) {
  const [videos, setVideos] = useState(initialVideos);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reuploadId, setReuploadId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function flash(msg: string, type: "ok" | "err") {
    if (type === "ok") { setSuccess(msg); setTimeout(() => setSuccess(null), 2500); }
    else               { setError(msg);   setTimeout(() => setError(null),   3000); }
  }

  function handleEdit(id: string) {
    setExpanded(e => e === id ? null : id);
    setReuploadId(null);
  }

  function handleSave(videoId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateVideo(videoId, fd);
      if (res && "error" in res) { flash(res.error ?? "Unknown error", "err"); return; }
      setVideos(vs => vs.map(v =>
        v.id !== videoId ? v : {
          ...v,
          title:       (fd.get("title") as string)?.trim() || v.title,
          description: (fd.get("description") as string)?.trim() || null,
          thumbnail:   (fd.get("thumbnail") as string)?.trim() || null,
          isPremium:   fd.get("isPremium") === "on",
        }
      ));
      setExpanded(null);
      flash("Video updated", "ok");
    });
  }

  function handleDelete(videoId: string) {
    startTransition(async () => {
      const res = await deleteVideo(videoId);
      if (res && "error" in res) { flash(res.error ?? "Unknown error", "err"); return; }
      setVideos(vs => vs.filter(v => v.id !== videoId));
      setConfirmDelete(null);
      flash("Video deleted", "ok");
    });
  }

  function handleReupload(videoId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = (new FormData(e.currentTarget).get("newUrl") as string)?.trim();
    if (!url) return;
    startTransition(async () => {
      const res = await reuploadVideo(videoId, url);
      if (res && "error" in res) { flash(res.error ?? "Unknown error", "err"); return; }
      setVideos(vs => vs.map(v =>
        v.id !== videoId ? v : { ...v, url, views: 0, duration: null, _count: { likes: 0 } }
      ));
      setReuploadId(null);
      flash("Video re-uploaded — stats reset", "ok");
    });
  }

  if (videos.length === 0) return (
    <div className="card p-12 text-center">
      <Play size={32} color="var(--text-muted)" className="mx-auto mb-4" />
      <p className="text-[var(--text-secondary)] mb-5">No videos yet</p>
      <Link href="/upload" className="btn-primary no-underline py-2 px-5">
        Upload First Video
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">

      {/* Flash messages */}
      {success && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/25 text-emerald-500 text-sm">
          <Check size={14}/> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-red-500/[0.08] border border-red-500/25 text-red-500 text-sm">
          <X size={14}/> {error}
        </div>
      )}

      {videos.map((video, i) => {
        const [bg, accent] = THUMB_COLORS[i % THUMB_COLORS.length];
        const isOpen = expanded === video.id;
        const isReup = reuploadId === video.id;
        const isDel  = confirmDelete === video.id;

        return (
          <div key={video.id} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
            {/* Row */}
            <div className="flex items-center gap-3.5 py-3.5 px-4">
              {/* Thumb */}
              <Link href={`/watch/${video.id}`} className="shrink-0 no-underline">
                <div
                  style={{ background: `linear-gradient(135deg,${bg},${accent}33)` }}
                  className="w-[88px] h-[50px] rounded-[7px] overflow-hidden flex items-center justify-center relative"
                >
                  <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                    <Play size={10} color="white" fill="white" className="ml-px"/>
                  </div>
                  {video.duration && (
                    <span className="absolute bottom-[3px] right-1 bg-black/70 rounded-[3px] px-[3px] text-[0.5625rem] text-[#ddd]">
                      {fmt(video.duration)}
                    </span>
                  )}
                  {video.isPremium && (
                    <Crown size={9} color="#fbbf24" className="absolute top-1 left-1"/>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-[var(--font-display)] font-bold text-sm text-[var(--text-primary)] truncate">
                  {video.title}
                </p>
                <div className="flex gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[0.75rem] text-[var(--text-muted)]">
                    <Eye size={11}/> {fmtViews(video.views)}
                  </span>
                  <span className="flex items-center gap-1 text-[0.75rem] text-[var(--text-muted)]">
                    <ThumbsUp size={11}/> {video._count.likes}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { handleEdit(video.id); setReuploadId(null); setConfirmDelete(null); }}
                  className={btnClass(isOpen ? "orange" : "default")} title="Edit">
                  {isOpen ? <ChevronUp size={14}/> : <Edit2 size={14}/>}
                </button>
                <button onClick={() => { setReuploadId(r => r===video.id ? null : video.id); setExpanded(null); setConfirmDelete(null); }}
                  className={btnClass(isReup ? "orange" : "default")} title="Re-upload">
                  <Upload size={14}/>
                </button>
                <button onClick={() => { setConfirmDelete(d => d===video.id ? null : video.id); setExpanded(null); setReuploadId(null); }}
                  className={btnClass(isDel ? "red" : "default")} title="Delete">
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>

            {/* Edit form */}
            {isOpen && (
              <form onSubmit={(e) => handleSave(video.id, e)}
                className="border-t border-[var(--border-subtle)] py-5 px-4 flex flex-col gap-3.5 bg-[var(--bg-elevated)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <FieldLabel>Title *</FieldLabel>
                    <input name="title" defaultValue={video.title} required className="input-field h-[38px]"/>
                  </div>
                  <div>
                    <FieldLabel>Thumbnail URL</FieldLabel>
                    <input name="thumbnail" type="url" defaultValue={video.thumbnail ?? ""} className="input-field h-[38px]" placeholder="https://..."/>
                  </div>
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea name="description" defaultValue={video.description ?? ""} rows={3} className="input-field resize-y"/>
                </div>
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" name="isPremium" defaultChecked={video.isPremium} className="w-[15px] h-[15px] accent-[var(--accent-orange)]"/>
                    <Crown size={13} color="var(--accent-orange)"/> Premium
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => setExpanded(null)} className={btnClass("default")}>
                      <X size={13}/> Cancel
                    </button>
                    <button type="submit" disabled={pending} className={btnClass("orange")}>
                      <Check size={13}/> {pending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Re-upload form */}
            {isReup && (
              <form onSubmit={(e) => handleReupload(video.id, e)}
                className="border-t border-[var(--border-subtle)] py-5 px-4 bg-orange-500/[0.04]">
                <div className="flex items-center gap-2 mb-3 text-[#f97316] text-[0.8125rem] font-[var(--font-display)] font-bold">
                  <AlertTriangle size={14}/> Re-uploading will reset views &amp; likes to zero
                </div>
                <div className="flex gap-2">
                  <input name="newUrl" type="url" required placeholder="New video URL…" className="input-field h-[38px] flex-1"/>
                  <button type="button" onClick={() => setReuploadId(null)} className={btnClass("default")}><X size={13}/></button>
                  <button type="submit" disabled={pending} className={btnClass("orange")}>
                    <Upload size={13}/> {pending ? "…" : "Replace"}
                  </button>
                </div>
              </form>
            )}

            {/* Delete confirm */}
            {isDel && (
              <div className="border-t border-[var(--border-subtle)] py-4 px-4 flex items-center justify-between bg-red-500/[0.05]">
                <span className="text-sm text-[var(--text-secondary)]">
                  Delete <b className="text-[var(--text-primary)]">{video.title}</b>? This can&apos;t be undone.
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(null)} className={btnClass("default")}><X size={13}/> Cancel</button>
                  <button onClick={() => handleDelete(video.id)} disabled={pending} className={btnClass("red")}><Trash2 size={13}/> {pending ? "…" : "Delete"}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-[var(--font-display)] font-semibold text-[0.75rem] text-[var(--text-muted)] mb-1.5">
      {children}
    </p>
  );
}

function btnClass(variant: "default" | "orange" | "red"): string {
  const base = "flex items-center gap-[0.3rem] py-1.5 px-2.5 rounded-[7px] cursor-pointer font-[var(--font-display)] font-semibold text-[0.8rem] transition-all duration-150 border";
  if (variant === "orange") return `${base} bg-orange-500/[0.12] border-orange-500/35 text-[var(--accent-orange)]`;
  if (variant === "red")    return `${base} bg-red-500/10 border-red-500/30 text-red-500`;
  return `${base} bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]`;
}