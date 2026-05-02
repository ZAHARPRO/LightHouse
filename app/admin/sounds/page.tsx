"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Music2, Trash2, Play, RotateCcw } from "lucide-react";
import { ALL_SOUND_KEYS, SOUND_META, type SoundKey } from "@/lib/gameSounds";

type SoundRow = {
  id: string;
  key: string;
  label: string;
  url: string;
  active: boolean;
};

type SlotState = {
  url: string;
  active: boolean;
  saving: boolean;
  msg: { ok: boolean; text: string } | null;
  dbId: string | null;
};

const DEFAULT_SLOTS = (): Record<SoundKey, SlotState> =>
  Object.fromEntries(
    ALL_SOUND_KEYS.map((k) => [k, { url: "", active: true, saving: false, msg: null, dbId: null }])
  ) as Record<SoundKey, SlotState>;

export default function AdminSoundsPage() {
  const [slots, setSlots] = useState<Record<SoundKey, SlotState>>(DEFAULT_SLOTS());
  const [loading, setLoading] = useState(true);

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
          next[row.key as SoundKey] = {
            ...next[row.key as SoundKey],
            url: row.url,
            active: row.active,
            dbId: row.id,
          };
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
    try { new Audio(url).play().catch(() => {}); } catch {}
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Music2 size={22} className="text-violet-400" />
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">Game Sounds</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Manage sound effects for online games. Paste a direct audio URL (mp3, ogg, wav) for each slot.
      </p>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {ALL_SOUND_KEYS.map((key) => {
            const slot = slots[key];
            return (
              <div key={key}
                className={`bg-[var(--bg-elevated)] border rounded-xl px-4 py-3 transition-colors ${slot.dbId && slot.active ? "border-violet-500/25" : "border-[var(--border-subtle)]"}`}>
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
                      {slot.msg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {slot.msg.text}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
