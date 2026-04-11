"use client";

import { useState, useTransition, useRef } from "react";
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
    <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
      <Play size={32} color="var(--text-muted)" style={{ margin: "0 auto 1rem" }} />
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>No videos yet</p>
      <Link href="/upload" className="btn-primary" style={{ textDecoration: "none", padding: "0.5rem 1.25rem" }}>
        Upload First Video
      </Link>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* Flash messages */}
      {success && (
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.75rem 1rem", borderRadius:8, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)", color:"#10b981", fontSize:"0.875rem" }}>
          <Check size={14}/> {success}
        </div>
      )}
      {error && (
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.75rem 1rem", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", fontSize:"0.875rem" }}>
          <X size={14}/> {error}
        </div>
      )}

      {videos.map((video, i) => {
        const [bg, accent] = THUMB_COLORS[i % THUMB_COLORS.length];
        const isOpen    = expanded === video.id;
        const isReup    = reuploadId === video.id;
        const isDel     = confirmDelete === video.id;

        return (
          <div key={video.id} style={{ background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:12, overflow:"hidden" }}>
            {/* Row */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.875rem", padding:"0.875rem 1rem" }}>
              {/* Thumb */}
              <Link href={`/watch/${video.id}`} style={{ flexShrink:0, textDecoration:"none" }}>
                <div style={{
                  width:88, height:50, borderRadius:7, overflow:"hidden",
                  background:`linear-gradient(135deg,${bg},${accent}33)`,
                  display:"flex", alignItems:"center", justifyContent:"center", position:"relative",
                }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Play size={10} color="white" fill="white" style={{ marginLeft:1 }}/>
                  </div>
                  {video.duration && (
                    <span style={{ position:"absolute", bottom:3, right:4, background:"rgba(0,0,0,0.7)", borderRadius:3, padding:"0 3px", fontSize:"0.5625rem", color:"#ddd" }}>
                      {fmt(video.duration)}
                    </span>
                  )}
                  {video.isPremium && (
                    <Crown size={9} color="#fbbf24" style={{ position:"absolute", top:4, left:4 }}/>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"0.875rem", color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {video.title}
                </p>
                <div style={{ display:"flex", gap:"0.75rem", marginTop:"0.25rem" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:"0.25rem", fontSize:"0.75rem", color:"var(--text-muted)" }}>
                    <Eye size={11}/> {fmtViews(video.views)}
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:"0.25rem", fontSize:"0.75rem", color:"var(--text-muted)" }}>
                    <ThumbsUp size={11}/> {video._count.likes}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", alignItems:"center", gap:"0.375rem", flexShrink:0 }}>
                <button onClick={() => { handleEdit(video.id); setReuploadId(null); setConfirmDelete(null); }}
                  style={btnStyle(isOpen ? "orange" : "default")} title="Edit">
                  {isOpen ? <ChevronUp size={14}/> : <Edit2 size={14}/>}
                </button>
                <button onClick={() => { setReuploadId(r => r===video.id ? null : video.id); setExpanded(null); setConfirmDelete(null); }}
                  style={btnStyle(isReup ? "orange" : "default")} title="Re-upload">
                  <Upload size={14}/>
                </button>
                <button onClick={() => { setConfirmDelete(d => d===video.id ? null : video.id); setExpanded(null); setReuploadId(null); }}
                  style={btnStyle(isDel ? "red" : "default")} title="Delete">
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>

            {/* Edit form */}
            {isOpen && (
              <form onSubmit={(e) => handleSave(video.id, e)}
                style={{ borderTop:"1px solid var(--border-subtle)", padding:"1.25rem 1rem", display:"flex", flexDirection:"column", gap:"0.875rem", background:"var(--bg-elevated)" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.875rem" }}>
                  <div>
                    <FieldLabel>Title *</FieldLabel>
                    <input name="title" defaultValue={video.title} required className="input-field" style={{ height:38 }}/>
                  </div>
                  <div>
                    <FieldLabel>Thumbnail URL</FieldLabel>
                    <input name="thumbnail" type="url" defaultValue={video.thumbnail ?? ""} className="input-field" style={{ height:38 }} placeholder="https://..."/>
                  </div>
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea name="description" defaultValue={video.description ?? ""} rows={3} className="input-field" style={{ resize:"vertical" }}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer", fontSize:"0.875rem", color:"var(--text-secondary)" }}>
                    <input type="checkbox" name="isPremium" defaultChecked={video.isPremium} style={{ accentColor:"var(--accent-orange)", width:15, height:15 }}/>
                    <Crown size={13} color="var(--accent-orange)"/> Premium
                  </label>
                  <div style={{ marginLeft:"auto", display:"flex", gap:"0.5rem" }}>
                    <button type="button" onClick={() => setExpanded(null)} style={btnStyle("default")}>
                      <X size={13}/> Cancel
                    </button>
                    <button type="submit" disabled={pending} style={btnStyle("orange")}>
                      <Check size={13}/> {pending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Re-upload form */}
            {isReup && (
              <form onSubmit={(e) => handleReupload(video.id, e)}
                style={{ borderTop:"1px solid var(--border-subtle)", padding:"1.25rem 1rem", background:"rgba(249,115,22,0.04)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.75rem", color:"#f97316", fontSize:"0.8125rem", fontFamily:"var(--font-display)", fontWeight:700 }}>
                  <AlertTriangle size={14}/> Re-uploading will reset views &amp; likes to zero
                </div>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                  <input name="newUrl" type="url" required placeholder="New video URL…" className="input-field" style={{ height:38, flex:1 }}/>
                  <button type="button" onClick={() => setReuploadId(null)} style={btnStyle("default")}><X size={13}/></button>
                  <button type="submit" disabled={pending} style={btnStyle("orange")}>
                    <Upload size={13}/> {pending ? "…" : "Replace"}
                  </button>
                </div>
              </form>
            )}

            {/* Delete confirm */}
            {isDel && (
              <div style={{ borderTop:"1px solid var(--border-subtle)", padding:"1rem", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(239,68,68,0.05)" }}>
                <span style={{ fontSize:"0.875rem", color:"var(--text-secondary)" }}>Delete <b style={{ color:"var(--text-primary)" }}>{video.title}</b>? This can't be undone.</span>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                  <button onClick={() => setConfirmDelete(null)} style={btnStyle("default")}><X size={13}/> Cancel</button>
                  <button onClick={() => handleDelete(video.id)} disabled={pending} style={btnStyle("red")}><Trash2 size={13}/> {pending ? "…" : "Delete"}</button>
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
    <p style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"0.375rem" }}>
      {children}
    </p>
  );
}

function btnStyle(variant: "default"|"orange"|"red"): React.CSSProperties {
  const base: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:"0.3rem",
    padding:"0.375rem 0.625rem", borderRadius:7, cursor:"pointer",
    fontFamily:"var(--font-display)", fontWeight:600, fontSize:"0.8rem",
    transition:"all 0.15s", border:"1px solid",
  };
  if (variant==="orange") return { ...base, background:"rgba(249,115,22,0.12)", borderColor:"rgba(249,115,22,0.35)", color:"var(--accent-orange)" };
  if (variant==="red")    return { ...base, background:"rgba(239,68,68,0.1)",    borderColor:"rgba(239,68,68,0.3)",    color:"#ef4444" };
  return { ...base, background:"var(--bg-elevated)", borderColor:"var(--border-subtle)", color:"var(--text-secondary)" };
}
