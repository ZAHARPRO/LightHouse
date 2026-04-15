"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, AlignLeft } from "lucide-react";
import { updateBio } from "@/actions/profile";

export default function BioEditor({ initialBio }: { initialBio: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(initialBio ?? "");
  const [saved, setSaved]     = useState<string | null>(initialBio);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  function handleEdit() { setValue(saved ?? ""); setError(null); setEditing(true); }
  function handleCancel() { setValue(saved ?? ""); setError(null); setEditing(false); }

  function handleSave() {
    setError(null);
    start(async () => {
      const res = await updateBio(value);
      if ("error" in res) { setError(res.error ?? "Error"); return; }
      setSaved(value.trim() || null);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-[420px]">
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") handleCancel(); }}
          maxLength={300}
          rows={3}
          placeholder="Tell the world about yourself…"
          className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[0.875rem] text-[var(--text-primary)] resize-none outline-none transition-[border-color] focus:border-[var(--accent-orange)]"
          style={{ fontFamily: "var(--font-body)" }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={pending}
            className="h-7 px-3 rounded-lg bg-[var(--accent-orange)] text-white text-[0.75rem] font-display font-bold border-none cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            <Check size={12} /> Save
          </button>
          <button
            onClick={handleCancel}
            className="h-7 px-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.75rem] font-display cursor-pointer flex items-center gap-1"
          >
            <X size={12} /> Cancel
          </button>
          <span className="text-[0.68rem] text-[var(--text-muted)] ml-auto">{value.length}/300</span>
        </div>
        {error && <p className="text-[0.72rem] text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={handleEdit}
      className="group flex items-start gap-2 bg-transparent border-none cursor-pointer p-0 text-left w-full max-w-[420px]"
    >
      <AlignLeft size={13} className="text-[var(--text-muted)] mt-[3px] shrink-0" />
      {saved ? (
        <span className="text-[0.875rem] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors leading-snug line-clamp-2">
          {saved}
        </span>
      ) : (
        <span className="text-[0.875rem] text-[var(--text-muted)] italic group-hover:text-[var(--text-secondary)] transition-colors">
          Add a description…
        </span>
      )}
      <Pencil size={11} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto mt-[3px] shrink-0" />
    </button>
  );
}
