"use client";

import { useState, useTransition } from "react";
import { UserX, UserCheck } from "lucide-react";
import { blockUser, unblockUser } from "@/actions/dm";

interface Props {
  targetId: string;
  targetName: string;
  initialBlocked: boolean;
}

export default function BlockButton({ targetId, targetName, initialBlocked }: Props) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [pending, start]      = useTransition();

  function handleBlock() {
    if (!confirm(`Block ${targetName}? They won't be able to send you messages.`)) return;
    setBlocked(true);
    start(async () => { await blockUser(targetId); });
  }

  function handleUnblock() {
    setBlocked(false);
    start(async () => { await unblockUser(targetId); });
  }

  if (blocked) {
    return (
      <button
        onClick={handleUnblock}
        disabled={pending}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.45rem 1.1rem", borderRadius: 8,
          fontSize: "0.875rem", fontFamily: "var(--font-display)", fontWeight: 600,
          background: "rgba(34,197,94,0.08)", color: "#4ade80",
          border: "1px solid rgba(34,197,94,0.2)",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        <UserCheck size={14} /> Unblock
      </button>
    );
  }

  return (
    <button
      onClick={handleBlock}
      disabled={pending}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.45rem 1.1rem", borderRadius: 8,
        fontSize: "0.875rem", fontFamily: "var(--font-display)", fontWeight: 600,
        background: "var(--bg-elevated)", color: "var(--text-muted)",
        border: "1px solid var(--border-subtle)",
        cursor: pending ? "not-allowed" : "pointer",
        opacity: pending ? 0.6 : 1,
        transition: "color 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
      }}
    >
      <UserX size={14} /> Block
    </button>
  );
}
