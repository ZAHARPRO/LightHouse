"use client";

import { useState } from "react";
import { Ban, ChevronDown, ChevronUp, Send } from "lucide-react";
import { submitAppeal } from "@/actions/reports";

export default function BanBanner({
  reason,
  isOwn,
}: {
  reason: string | null;
  isOwn: boolean;
}) {
  const [appealOpen, setAppealOpen] = useState(false);
  const [message, setMessage]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState("");

  async function handleAppeal(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await submitAppeal(message);
    if ("error" in res) {
      setError(res.error);
      setLoading(false);
    } else {
      setSent(true);
    }
  }

  return (
    <div
      className="mb-6 rounded-xl border overflow-hidden"
      style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}
    >
      <div className="flex items-start gap-3 px-5 py-4">
        <Ban size={18} className="text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-red-400 mb-0.5">
            {isOwn ? "Your account has been suspended" : "This account has been suspended"}
          </p>
          {reason && (
            <p className="text-[0.8125rem] text-red-300/70">
              Reason: {reason}
            </p>
          )}
          {isOwn && !sent && (
            <button
              onClick={() => setAppealOpen((o) => !o)}
              className="flex items-center gap-1 mt-2 text-[0.8rem] font-display font-semibold text-red-300 hover:text-red-200 transition-colors bg-transparent border-none cursor-pointer p-0"
            >
              {appealOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {appealOpen ? "Hide appeal form" : "Submit an appeal"}
            </button>
          )}
          {isOwn && sent && (
            <p className="mt-2 text-[0.8rem] font-display font-semibold text-green-400">
              Appeal submitted — our team will review it shortly.
            </p>
          )}
        </div>
      </div>

      {isOwn && appealOpen && !sent && (
        <form
          onSubmit={handleAppeal}
          className="px-5 pb-4 border-t border-red-500/15 pt-4"
        >
          <p className="text-[0.8rem] text-red-300/70 mb-2">
            Explain why you believe this suspension was a mistake. Our staff will review your appeal.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your appeal here…"
            rows={3}
            required
            className="input-field w-full resize-none mb-2 text-sm"
          />
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer border-none disabled:opacity-50"
          >
            <Send size={13} />
            {loading ? "Sending…" : "Send Appeal"}
          </button>
        </form>
      )}
    </div>
  );
}
