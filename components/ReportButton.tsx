"use client";

import { useState } from "react";
import { Flag, X, AlertTriangle } from "lucide-react";
import { reportUser } from "@/actions/reports";

const REASONS = [
  "Spam or misleading content",
  "Harassment or bullying",
  "Hate speech or discrimination",
  "Inappropriate content",
  "Impersonation",
  "Other",
];

export default function ReportButton({
  targetId,
  targetName,
}: {
  targetId: string;
  targetName: string;
}) {
  const [open, setOpen]       = useState(false);
  const [reason, setReason]   = useState("");
  const [custom, setCustom]   = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const baseReason = reason === "Other" ? custom.trim() : reason;
    if (!baseReason) { setError("Please select or enter a reason."); return; }
    const finalReason = details.trim()
      ? `${baseReason} — ${details.trim()}`
      : baseReason;
    setLoading(true);
    setError("");
    const res = await reportUser(targetId, finalReason);
    if ("error" in res) {
      setError(res.error ?? "Something went wrong");
      setLoading(false);
    } else {
      setDone(true);
    }
  }

  function close() {
    setOpen(false);
    setDone(false);
    setReason("");
    setCustom("");
    setDetails("");
    setError("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Report ${targetName}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.78rem] font-display font-semibold text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 border border-[var(--border-subtle)] hover:border-red-500/20 bg-transparent transition-colors cursor-pointer"
      >
        <Flag size={12} /> Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-[400px] shadow-2xl">
            {done ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <Flag size={20} className="text-green-400" />
                </div>
                <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mb-1">Report submitted</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">Our team will review this report. Thank you.</p>
                <button onClick={close} className="btn-primary px-6 py-2 text-sm">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-400" />
                    <h3 className="font-display font-bold text-[var(--text-primary)]">Report {targetName}</h3>
                  </div>
                  <button onClick={close} className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <p className="text-sm text-[var(--text-muted)] mb-3">Why are you reporting this user?</p>

                  <div className="flex flex-col gap-1.5 mb-3">
                    {REASONS.map((r) => (
                      <label
                        key={r}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                        style={{
                          background: reason === r ? "rgba(249,115,22,0.08)" : "var(--bg-elevated)",
                          border: `1px solid ${reason === r ? "rgba(249,115,22,0.3)" : "var(--border-subtle)"}`,
                        }}
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={r}
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          className="accent-orange-500"
                        />
                        <span className="text-sm text-[var(--text-secondary)]">{r}</span>
                      </label>
                    ))}
                  </div>

                  {reason === "Other" && (
                    <textarea
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder="Describe the issue…"
                      rows={2}
                      className="input-field w-full resize-none mb-3 text-sm"
                      required
                    />
                  )}

                  {/* Optional details */}
                  <div className="mb-3">
                    <label className="block text-[0.72rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">
                      Additional details <span className="normal-case font-normal opacity-70">(optional)</span>
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Describe what happened in more detail…"
                      rows={2}
                      className="input-field w-full resize-none text-sm"
                    />
                  </div>

                  {/* Hint */}
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-3 text-[0.75rem] text-[var(--text-muted)] leading-[1.5]"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                  >
                    <span className="shrink-0 mt-px">💡</span>
                    <span>Providing additional context helps our team reach a fair and accurate decision.</span>
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm mb-3">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !reason}
                    className="btn-primary w-full py-2 text-sm disabled:opacity-50"
                    style={{ background: "linear-gradient(90deg,#ef4444,#f97316)" }}
                  >
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
