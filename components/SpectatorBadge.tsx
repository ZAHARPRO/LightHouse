"use client";

import { Eye } from "lucide-react";

interface SpectatorBadgeProps {
  count: number;
  className?: string;
}

export default function SpectatorBadge({ count, className = "" }: SpectatorBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-display font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 ${className}`}
      title={`${count} ${count === 1 ? "spectator" : "spectators"} watching`}
    >
      <Eye size={10} className="shrink-0" />
      {count}
    </span>
  );
}
