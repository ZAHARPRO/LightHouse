"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Music2, Trash2, Play, RotateCcw,
  Upload, Youtube, X, ArrowRight,
} from "lucide-react";
import { ALL_SOUND_KEYS, SOUND_META, type SoundKey } from "@/lib/gameSounds";

type SoundRow = { id: string; key: string; label: string; url: string; active: boolean };

type SlotState = {
  url: string; active: boolean; saving: boolean;
  msg: { ok: boolean; text: string } | null; dbId: string | null;
};

const DEFAULT_SLOTS = (): Record<SoundKey, SlotState> =>
  Object.fromEntries(
    ALL_SOUND_KEYS.map((k) => [k, { url: "", active: true, saving: false, msg: null, dbId: null }])
  ) as Record<SoundKey, SlotState>;

export default function AdminSoundsPage() {
  const [slots, setSlots]           = useState<Record<SoundKey, SlotState>>(DEFAULT_SLOTS());
  const [loading, setLoading]       = useState(true);
  const [uploadingKey, setUpKey]    = useState<SoundKey | null>(null);
  const [uploadErr, setUpErr]       = useState<Partial<Record<SoundKey, string>>>({});
  const [showYt, setShowYt]         = useState<Partial<Record<SoundKey, boolean>>>({});
  const [ytUrls, setYtUrls]         = useState<Partial<Record<SoundKey, string>>>({});
  const previewRef                  = useRef<HTMLAudioElement | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const uploadKeyRef                = useRef<SoundKey | null>(null);

  function setSlot(key: SoundKey, patch: Partial<SlotState>) {
    setSlots((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

  async function load() {
    const res = await fetch("/api/admin/game-sounds");
    if (!res.ok) { setLoading(false); return; }
    const data: SoundRow[] = await res.json();
    setSlots((prev) => {
      const next = { ...prev };
      for (const row of data) {
        if (next[row.key as SoundKey]) {
          next[row.key as SoundKey] = { ...next[row.key as SoundKey], url: row.url, active: row.active, dbId: row.id };
        }
      }
      return next;
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(key: SoundKey) {
    const slot = slots[key];
    if (!slot.url.trim()) return;
    setSlot(key, { saving: true, msg: null });
    const res = await fetch("/api/admin/game-sounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label: SOUND_META[key], url: slot.url.trim(), active: slot.active }),
    });
    const data: SoundRow = await res.json();
    if (res.ok) {
      setSlot(key, { saving: false, msg: { ok: true, text: "Saved" }, dbId: data.id });
      setTimeout(() => setSlot(key, { msg: null }), 2000);
    } else {
      setSlot(key, { saving: false, msg: { ok: false, text: "Failed" } });
    }
  }

  async function remove(key: SoundKey) {
    const slot = slots[key];
    if (!slot.dbId) { setSlot(key, { url: "", msg: null }); return; }
    setSlot(key, { saving: true });
    await fetch("/api/admin/game-sounds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: slot.dbId }),
    });
    setSlot(key, { saving: false, url: "", dbId: null, active: true, msg: { ok: true, text: "Removed" } });
    setTimeout(() => setSlot(key, { msg: null }), 2000);
  }

  async function toggleActive(key: SoundKey) {
    const slot = slots[key];
    if (!slot.dbId) return;
    const newActive = !slot.active;
    setSlot(key, { active: newActive });
    await fetch("/api/admin/game-sounds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: slot.dbId, active: newActive }),
    });
  }

  function previewSound(key: SoundKey) {
    const url = slots[key].url;
    if (!url) return;
    try {
      if (previewRef.current) { previewRef.current.pause(); previewRef.current.currentTime = 0; }
      const audio = new Audio(url);
      previewRef.current = audio;
      audio.play().catch(() => {});
    } catch {}
  }

  // ── File upload ────────────────────────────────────────────────────────────
  function openFilePicker(key: SoundKey) {
    uploadKeyRef.current = key;
    if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const key = uploadKeyRef.current;
    if (!key) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX = 2 * 1024 * 1024;
    if (file.size > MAX) {
      setUpErr((p) => ({ ...p, [key]: "File too large — max 2 MB" }));
      setTimeout(() => setUpErr((p) => ({ ...p, [key]: "" })), 3000);
      return;
    }

    setUpKey(key);
    setUpErr((p) => ({ ...p, [key]: "" }));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/game-sounds/upload", { method: "POST", body: form });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSlot(key, { url: data.url!, msg: { ok: true, text: "Uploaded — click Save" } });
      setTimeout(() => setSlot(key, { msg: null }), 3000);
    } catch (err) {
      setUpErr((p) => ({ ...p, [key]: err instanceof Error ? err.message : "Upload failed" }));
      setTimeout(() => setUpErr((p) => ({ ...p, [key]: "" })), 5000);
    } finally {
      setUpKey(null);
    }
  }

  // ── YouTube extraction ─────────────────────────────────────────────────────
  async function handleYouTubeExtract(key: SoundKey) {
    const url = ytUrls[key]?.trim();
    if (!url) return;

    setUpKey(key);
    setUpErr((p) => ({ ...p, [key]: "" }));
    try {
      const res = await fetch("/api/admin/game-sounds/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { url?: string; title?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setSlot(key, { url: data.url!, msg: { ok: true, text: `Extracted — click Save` } });
      setYtUrls((p) => ({ ...p, [key]: "" }));
      setShowYt((p) => ({ ...p, [key]: false }));
      setTimeout(() => setSlot(key, { msg: null }), 3000);
    } catch (err) {
      setUpErr((p) => ({ ...p, [key]: err instanceof Error ? err.message : "Extraction failed" }));
      setTimeout(() => setUpErr((p) => ({ ...p, [key]: "" })), 6000);
    } finally {
      setUpKey(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Music2 size={22} className="text-violet-400" />
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">Game Sounds</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Manage sound effects for online games. Paste a URL, upload an audio file (max 2 MB), or extract audio from a YouTube link.
      </p>

      {/* Hidden shared file input */}
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {ALL_SOUND_KEYS.map((key) => {
            const slot = slots[key];
            const isUploading = uploadingKey === key;
            const err = uploadErr[key];

            return (
              <div key={key}
                className={`bg-[var(--bg-elevated)] border rounded-xl px-4 py-3 transition-colors ${slot.dbId && slot.active ? "border-violet-500/25" : "border-[var(--border-subtle)]"}`}>

                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${slot.dbId && slot.active ? "bg-green-400" : "bg-[var(--border-subtle)]"}`} />
                  <div>
                    <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{SOUND_META[key]}</p>
                    <p className="text-[0.65rem] text-[var(--text-muted)] font-mono">{key}</p>
                  </div>
                  {slot.dbId && (
                    <button onClick={() => toggleActive(key)}
                      className={`ml-auto text-[0.65rem] font-display font-bold px-2 py-0.5 rounded-full border transition-colors ${slot.active ? "text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20" : "text-[var(--text-muted)] bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:text-green-400"}`}>
                      {slot.active ? "Active" : "Inactive"}
                    </button>
                  )}
                  {slot.msg && (
                    <span className={`text-xs font-display font-semibold flex items-center gap-1 ${slot.msg.ok ? "text-green-400" : "text-red-400"} ${slot.dbId ? "" : "ml-auto"}`}>
                      {slot.msg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}{slot.msg.text}
                    </span>
                  )}
                </div>

                {/* URL input row */}
                <div className="flex gap-2 mb-2">
                  <input
                    value={slot.url}
                    onChange={(e) => setSlot(key, { url: e.target.value })}
                    placeholder="https://example.com/sound.mp3"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:border-violet-500/50"
                  />
                  {slot.url && (
                    <button onClick={() => previewSound(key)} title="Preview"
                      className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
                      <Play size={13} />
                    </button>
                  )}
                  <button onClick={() => save(key)} disabled={slot.saving || !slot.url.trim()}
                    className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-display font-bold hover:opacity-90 disabled:opacity-40 transition-opacity">
                    {slot.saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                  </button>
                  {slot.dbId && (
                    <button onClick={() => remove(key)} title="Remove sound"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                  {!slot.dbId && slot.url && (
                    <button onClick={() => setSlot(key, { url: "" })} title="Clear"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>

                {/* Upload / YouTube buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => openFilePicker(key)}
                    disabled={uploadingKey !== null}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[0.62rem] font-display font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-violet-400 hover:border-violet-500/30 disabled:opacity-40 transition-colors"
                  >
                    {isUploading && !showYt[key]
                      ? <Loader2 size={10} className="animate-spin" />
                      : <Upload size={10} />}
                    Upload file
                  </button>
                  <button
                    onClick={() => setShowYt((p) => ({ ...p, [key]: !p[key] }))}
                    disabled={uploadingKey !== null}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[0.62rem] font-display font-semibold border transition-colors disabled:opacity-40 ${showYt[key] ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30"}`}
                  >
                    <Youtube size={10} />
                    From YouTube
                  </button>
                  {err && (
                    <span className="text-[0.6rem] text-red-400 flex items-center gap-0.5 ml-1">
                      <AlertCircle size={10} />{err}
                    </span>
                  )}
                </div>

                {/* YouTube URL inline input */}
                {showYt[key] && (
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-red-500/30">
                      <Youtube size={11} className="text-red-500 shrink-0" />
                      <input
                        value={ytUrls[key] ?? ""}
                        onChange={(e) => setYtUrls((p) => ({ ...p, [key]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleYouTubeExtract(key)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] font-mono"
                      />
                    </div>
                    <button
                      onClick={() => handleYouTubeExtract(key)}
                      disabled={isUploading || !ytUrls[key]?.trim()}
                      title="Extract & upload audio"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-display font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {isUploading
                        ? <Loader2 size={11} className="animate-spin" />
                        : <ArrowRight size={11} />}
                    </button>
                    <button
                      onClick={() => { setShowYt((p) => ({ ...p, [key]: false })); setYtUrls((p) => ({ ...p, [key]: "" })); }}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
