"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Play, Pencil, X, Video } from "lucide-react";

type AdVideo = {
  id: string;
  title: string;
  url: string;
  duration: number;
  active: boolean;
  createdAt: string;
};

export default function AdminAdsPage() {
  const [videos, setVideos]     = useState<AdVideo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [editTarget, setEditTarget] = useState<AdVideo | null>(null);

  // Form state
  const [title, setTitle]       = useState("");
  const [url, setUrl]           = useState("");
  const [duration, setDuration] = useState("30");
  const [active, setActive]     = useState(true);

  async function load() {
    const res = await fetch("/api/admin/ad-videos");
    if (res.ok) setVideos(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  }

  function openEdit(v: AdVideo) {
    setEditTarget(v);
    setTitle(v.title);
    setUrl(v.url);
    setDuration(String(v.duration));
    setActive(v.active);
  }

  function closeEdit() {
    setEditTarget(null);
    setTitle(""); setUrl(""); setDuration("30"); setActive(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/ad-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url, duration: parseInt(duration), active }),
    });
    setSaving(false);
    if (res.ok) { flash(true, "Video added"); setTitle(""); setUrl(""); setDuration("30"); setActive(true); load(); }
    else flash(false, "Failed to add video");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    const res = await fetch("/api/admin/ad-videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editTarget.id, title, url, duration: parseInt(duration), active }),
    });
    setSaving(false);
    if (res.ok) { flash(true, "Video updated"); closeEdit(); load(); }
    else flash(false, "Failed to update");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this video?")) return;
    const res = await fetch("/api/admin/ad-videos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { flash(true, "Deleted"); load(); }
    else flash(false, "Failed to delete");
  }

  async function toggleActive(v: AdVideo) {
    await fetch("/api/admin/ad-videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, active: !v.active }),
    });
    load();
  }

  const formFields = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title" required
        className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm" />
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Video URL (direct mp4 or stream)" required
        className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm" />
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <label className="text-[var(--text-muted)] text-xs mb-1 block">Duration (seconds)</label>
          <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-4">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-green-500" />
          <span className="text-[var(--text-secondary)] text-sm">Active</span>
        </label>
      </div>
      <button type="submit" disabled={saving}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        {submitLabel}
      </button>
    </form>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Video size={22} className="text-violet-400" />
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">Hint Recharge Videos</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Users watch these videos to earn +1 hint point (30 min cooldown per recharge).
      </p>

      {msg && (
        <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-display font-semibold ${msg.ok ? "bg-green-500/10 border border-green-500/25 text-green-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
          {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      {/* Add form */}
      {!editTarget && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-8">
          <h2 className="font-display font-bold text-[var(--text-primary)] text-sm mb-4">Add New Video</h2>
          {formFields(handleCreate, "Add Video")}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="bg-[var(--bg-elevated)] border border-violet-500/30 rounded-2xl p-5 mb-8 relative">
          <button onClick={closeEdit} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16}/></button>
          <h2 className="font-display font-bold text-violet-400 text-sm mb-4">Edit: {editTarget.title}</h2>
          {formFields(handleUpdate, "Save Changes")}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : videos.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] py-16">No videos yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {videos.map(v => (
            <div key={v.id} className="flex items-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
              <Play size={16} className={v.active ? "text-green-400 shrink-0" : "text-[var(--text-muted)] shrink-0"} />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">{v.title}</p>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-0.5 truncate">{v.url}</p>
                <p className="text-[0.7rem] text-[var(--text-muted)]">{v.duration}s</p>
              </div>
              <button onClick={() => toggleActive(v)}
                className={`text-xs font-display font-bold px-2.5 py-1 rounded-full border transition-colors ${v.active ? "text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20" : "text-[var(--text-muted)] bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:text-green-400"}`}>
                {v.active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-violet-400 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
