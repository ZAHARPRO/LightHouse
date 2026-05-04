"use client";

import { useState } from "react";
import { Flag, X, AlertTriangle } from "lucide-react";
import { reportUser } from "@/actions/reports";

const GAME_REASONS = [
  "Cheating / hacking",
  "Harassment or abuse",
  "Stalling / wasting time",
  "Inappropriate username",
  "Other",
];

export default function GameReportButton({
  targetId,
  targetName,
  game,
  roomId,
}: {
  targetId: string;
  targetName: string;
  game: "chess" | "minesweeper" | "checkers";
  roomId: string;
}) {
  const [open, setOpen]       = useState(false);
  const [reason, setReason]   = useState("");
  const [custom, setCustom]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalReason = reason === "Other" ? custom.trim() : reason;
    if (!finalReason) { setError("Please select a reason."); return; }
    setLoading(true); setError("");
    const res = await reportUser(targetId, finalReason, { game, roomId });
    if ("error" in res) { setError(res.error ?? "Something went wrong"); setLoading(false); }
    else setDone(true);
  }

  function close() {
    setOpen(false); setDone(false); setReason(""); setCustom(""); setError("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 border border-[var(--border-subtle)] hover:border-red-500/20 transition-colors"
      >
        <Flag size={11} /> Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {done ? (
              <div className="text-center py-4">
                <Flag size={24} className="mx-auto mb-3 text-green-400" />
                <h3 className="font-display font-bold text-[var(--text-primary)] mb-1">Report submitted</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">Our team will review this.</p>
                <button onClick={close} className="btn-primary px-6 py-2 text-sm">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-red-400" />
                    <h3 className="font-display font-bold text-[var(--text-primary)] text-sm">Report {targetName}</h3>
                  </div>
                  <button onClick={close} className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X size={15} />
                  </button>
                </div>

                <p className="text-[0.72rem] text-[var(--text-muted)] mb-2 uppercase font-semibold tracking-wide">
                  {game === "chess" ? "♟ Chess" : game === "checkers" ? "🔴 Checkers" : "💣 Minesweeper"} · in-game report
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  {GAME_REASONS.map(r => (
                    <label key={r}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm"
                      style={{
                        background: reason === r ? "rgba(249,115,22,0.08)" : "var(--bg-elevated)",
                        border: `1px solid ${reason === r ? "rgba(249,115,22,0.3)" : "var(--border-subtle)"}`,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <input type="radio" name="reason" value={r} checked={reason === r}
                        onChange={() => setReason(r)} className="accent-orange-500" />
                      {r}
                    </label>
                  ))}

                  {reason === "Other" && (
                    <textarea value={custom} onChange={e => setCustom(e.target.value)}
                      placeholder="Describe the issue…" rows={2}
                      className="input-field w-full resize-none text-sm" required />
                  )}

                  {error && <p className="text-red-400 text-xs">{error}</p>}

                  <button type="submit" disabled={loading || !reason}
                    className="btn-primary w-full py-2 text-sm mt-1 disabled:opacity-50"
                    style={{ background: "linear-gradient(90deg,#ef4444,#f97316)" }}>
                    {loading ? "Submitting…" : "Submit Report"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
