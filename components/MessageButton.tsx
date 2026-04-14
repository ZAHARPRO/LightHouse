"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getOrCreateDMConversation } from "@/actions/dm";

export default function MessageButton({ targetId }: { targetId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    const res = await getOrCreateDMConversation(targetId);
    if ("id" in res) {
      router.push(`/dm/${res.id}`);
    } else {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.45rem 1.1rem", borderRadius: 8,
        fontSize: "0.875rem", fontFamily: "var(--font-display)", fontWeight: 600,
        background: "var(--bg-elevated)", color: "var(--text-primary)",
        border: "1px solid var(--border-subtle)",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <MessageCircle size={14} />
      {loading ? "Opening…" : "Message"}
    </button>
  );
}
