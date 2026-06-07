"use client";

import { useState, useTransition } from "react";
import { Zap, AlertTriangle, Loader2 } from "lucide-react";
import { sendScreamer } from "@/actions/shop";

export default function SendScreamerButton({
  recipientId,
  charges,
}: {
  recipientId: string;
  charges: { itemId: string; itemName: string; count: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(charges[0]?.itemId ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; canBypass?: boolean } | null>(null);

  if (charges.length === 0) return null;

  function send(bypass: boolean) {
    start(async () => {
      const res = await sendScreamer(recipientId, selectedItem, bypass);
      if (res.ok) {
        setMsg({ ok: true, text: "😱 Screamer sent!" });
        setOpen(false);
        setTimeout(() => setMsg(null), 4000);
      } else if (res.error === "disabled") {
        setMsg({ ok: false, text: "Recipient has screamers disabled", canBypass: true });
      } else {
        setMsg({ ok: false, text: res.error ?? "Error" });
      }
    });
  }

  const totalCharges = charges.find((c) => c.itemId === selectedItem)?.count ?? 0;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.8rem] font-display font-bold transition-colors"
        style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
        title="Send a screamer"
      >
        <Zap size={13} />
        😱
      </button>

      {msg && (
        <span className={`text-[0.75rem] font-display ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
          {msg.text}
          {msg.canBypass && (
            <button
              onClick={() => { setMsg(null); send(true); }}
              disabled={pending}
              className="ml-2 underline hover:no-underline"
            >
              Force send (×3 charges)
            </button>
          )}
        </span>
      )}

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-[320px] rounded-2xl border border-[rgba(239,68,68,0.4)] bg-[var(--bg-card)] p-5 space-y-4"
            style={{ boxShadow: "0 8px 40px rgba(239,68,68,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[1rem] font-display font-extrabold text-[var(--text-primary)]">😱 Send Screamer</p>

            {charges.length > 1 && (
              <div className="flex flex-col gap-1">
                <label className="text-[0.72rem] font-display text-[var(--text-muted)]">Choose screamer</label>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm outline-none"
                >
                  {charges.map((c) => (
                    <option key={c.itemId} value={c.itemId}>{c.itemName} ({c.count}×)</option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-[0.78rem] text-[var(--text-muted)]">
              You have <span className="font-bold text-red-400">{totalCharges} charge{totalCharges !== 1 ? "s" : ""}</span> for this screamer. Sending uses 1 charge.
            </p>

            {msg?.canBypass && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[0.78rem] text-red-400 font-semibold">Recipient has screamers disabled</p>
                  <p className="text-[0.72rem] text-[var(--text-muted)] mt-0.5">You can bypass this — it will use 3 charges.</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {msg?.canBypass ? (
                <button
                  onClick={() => send(true)}
                  disabled={pending || totalCharges < 3}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[0.82rem] font-display font-bold disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.35)" }}
                >
                  {pending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  Force send (×3)
                </button>
              ) : (
                <button
                  onClick={() => send(false)}
                  disabled={pending || totalCharges === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[0.82rem] font-display font-bold disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.35)" }}
                >
                  {pending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  Send
                </button>
              )}
              <button
                onClick={() => { setOpen(false); setMsg(null); }}
                className="px-4 py-2 rounded-xl text-[0.82rem] font-display text-[var(--text-muted)] border border-[var(--border-subtle)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
