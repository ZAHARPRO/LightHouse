"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, AtSign } from "lucide-react";
import { updateUsername } from "@/actions/profile";

export default function UsernameEditor({ initialUsername }: { initialUsername: string | null }) {
  const [editing, setEditing]   = useState(false);
  const [value, setValue]       = useState<string>(initialUsername ?? "");
  const [saved, setSaved]       = useState<string | null>(initialUsername ?? null);
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();

  function handleEdit() { setValue(saved ?? ""); setError(null); setEditing(true); }
  function handleCancel() { setValue(saved ?? ""); setError(null); setEditing(false); }

  function handleSave() {
    setError(null);
    start(async () => {
      const res = await updateUsername(value);
      if ("error" in res) { setError(res.error ?? "Error"); return; }
      setSaved(value.trim().toLowerCase());
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]">
            <AtSign size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
              maxLength={20}
              placeholder="yourname"
              className="bg-transparent border-none outline-none text-[0.875rem] text-[var(--text-primary)] w-36"
            />
          </div>
          <button onClick={handleSave} disabled={pending || !value.trim()} className="w-8 h-8 rounded-lg bg-[var(--accent-orange)] border-none flex items-center justify-center text-white cursor-pointer disabled:opacity-50">
            <Check size={14} />
          </button>
          <button onClick={handleCancel} className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer">
            <X size={14} />
          </button>
        </div>
        {error && <p className="text-[0.72rem] text-red-400 ml-1">{error}</p>}
        <p className="text-[0.7rem] text-[var(--text-muted)] ml-1">Letters, numbers, underscores · 3–20 chars</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleEdit}
      className="group flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0"
    >
      <AtSign size={13} className="text-[var(--text-muted)]" />
      {saved ? (
        <span className="text-[0.875rem] font-display font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
          {saved}
        </span>
      ) : (
        <span className="text-[0.875rem] text-[var(--text-muted)] italic group-hover:text-[var(--text-secondary)] transition-colors">
          Set username…
        </span>
      )}
      <Pencil size={11} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
