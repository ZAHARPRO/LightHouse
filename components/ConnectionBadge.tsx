"use client";

export type ConnStatus = "ok" | "slow" | "lost";

const CONFIG: Record<ConnStatus, { dot: string; label: string; text: string }> = {
  ok:   { dot: "bg-green-400",  label: "Connected",     text: "text-green-400"  },
  slow: { dot: "bg-yellow-400", label: "Slow connection", text: "text-yellow-400" },
  lost: { dot: "bg-red-400",    label: "Connection lost", text: "text-red-400"   },
};

export default function ConnectionBadge({ status }: { status: ConnStatus }) {
  const { dot, label, text } = CONFIG[status];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-display font-semibold ${text}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${status === "ok" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
