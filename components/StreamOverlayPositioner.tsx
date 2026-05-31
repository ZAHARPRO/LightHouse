"use client";

import { useRef, useState } from "react";
import type { XY } from "@/lib/stream-overlay";

export type CamPreviewCfg = {
  widthPct: number;
  borderW: number;
  borderColor: string;
  borderRadius: number;
  ticker: string;
  tickerSize: number;
  tickerColor: string;
  tickerFont: string;
};

export type SupportPreviewCfg = {
  bgColor: string;
  textColor: string;
};

interface Props {
  camPos: XY;
  supportPos: XY;
  chatPos: XY;
  onCam: (p: XY) => void;
  onSupport: (p: XY) => void;
  onChat: (p: XY) => void;
  camCfg?: CamPreviewCfg;
  supportCfg?: SupportPreviewCfg;
  children?: React.ReactNode;
  /** Which overlay items to show. Omit = show all three. */
  visibleItems?: ("cam" | "support" | "chat")[];
  /** Called while dragging the cam resize corner. Receives new widthPct (10–60). */
  onCamResize?: (widthPct: number) => void;
}

interface ItemDef {
  id: "cam" | "support" | "chat";
  pos: XY;
  onChange: (p: XY) => void;
}

const STEP = 1;
const FAKE_MSGS = ["Alice: Hello! 👋", "Bob: pog pog", "Carol: 🔥 fire stream"];

export default function StreamOverlayPositioner({
  camPos, supportPos, chatPos,
  onCam, onSupport, onChat,
  camCfg, supportCfg,
  children,
  visibleItems,
  onCamResize,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ItemDef["id"] | null>(null);

  const allItems: ItemDef[] = [
    { id: "cam",     pos: camPos,     onChange: onCam     },
    { id: "support", pos: supportPos, onChange: onSupport },
    { id: "chat",    pos: chatPos,    onChange: onChat    },
  ];
  const items = visibleItems
    ? allItems.filter(i => visibleItems.includes(i.id))
    : allItems;

  // ── drag to reposition ──────────────────────────────────────────────────────

  function startDrag(item: ItemDef, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    setActive(item.id);
    const rect = container.getBoundingClientRect();
    const ox = (e.clientX - rect.left) / rect.width  * 100 - item.pos.x;
    const oy = (e.clientY - rect.top)  / rect.height * 100 - item.pos.y;

    function onMove(ev: MouseEvent) {
      item.onChange({
        x: Math.max(0, Math.min(94, (ev.clientX - rect.left) / rect.width  * 100 - ox)),
        y: Math.max(0, Math.min(88, (ev.clientY - rect.top)  / rect.height * 100 - oy)),
      });
    }
    function onUp() {
      setActive(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }

  // ── drag cam resize corner ──────────────────────────────────────────────────

  function startCamResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container || !onCamResize || !camCfg) return;
    const resize     = onCamResize; // capture so closure is typed as non-optional
    const rect       = container.getBoundingClientRect();
    const startX     = e.clientX;
    const startPct   = camCfg.widthPct;

    function onMove(ev: MouseEvent) {
      const dx     = ev.clientX - startX;
      const newPct = Math.max(10, Math.min(60, startPct + (dx / rect.width) * 100));
      resize(Math.round(newPct * 2) / 2);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }

  // ── nudge ───────────────────────────────────────────────────────────────────

  function nudge(item: ItemDef, dx: number, dy: number) {
    item.onChange({
      x: Math.max(0, Math.min(94, item.pos.x + dx)),
      y: Math.max(0, Math.min(88, item.pos.y + dy)),
    });
  }

  // ── render handles ──────────────────────────────────────────────────────────

  function renderCam(isActive: boolean) {
    if (!camCfg) return <Chip label="📷 Camera" color="#818cf8" active={isActive} />;

    const accentColor  = camCfg.borderColor || "#818cf8";
    const tickerFont   = Math.max(7, camCfg.tickerSize * 0.42);

    return (
      <div style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#111",
        border: camCfg.borderW > 0
          ? `${camCfg.borderW}px solid ${accentColor}`
          : "1px dashed rgba(129,140,248,0.5)",
        borderRadius: camCfg.borderRadius,
        position: "relative",
        overflow: "hidden",
        boxShadow: isActive ? `0 0 0 2px ${accentColor}66` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}>
        {/* camera icon */}
        <span style={{ fontSize: Math.max(10, camCfg.widthPct * 0.38), opacity: 0.45, pointerEvents: "none", lineHeight: 1 }}>📷</span>

        {/* ticker strip */}
        {camCfg.ticker && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(0,0,0,0.72)",
            padding: "2px 4px",
            fontSize: tickerFont,
            color: camCfg.tickerColor,
            fontFamily: `'${camCfg.tickerFont ?? "Inter"}', sans-serif`,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.4,
            pointerEvents: "none",
          }}>
            {camCfg.ticker}
          </div>
        )}

        {/* resize corner — bottom-right */}
        {onCamResize && (
          <div
            onMouseDown={startCamResize}
            title="Drag to resize"
            style={{
              position: "absolute", right: 0, bottom: 0,
              width: 16, height: 16,
              cursor: "nwse-resize",
              zIndex: 6,
              display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
              padding: 2,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 5L5 9" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 9L9 9" stroke={accentColor} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>
    );
  }

  function renderSupport(isActive: boolean) {
    if (!supportCfg) return <Chip label="❤️ Support" color="#ec4899" active={isActive} />;
    return (
      <div style={{
        background: supportCfg.bgColor,
        color: supportCfg.textColor,
        borderRadius: 8,
        padding: "3px 9px",
        fontSize: 9,
        fontWeight: 700,
        whiteSpace: "nowrap",
        boxShadow: isActive ? `0 0 0 2px ${supportCfg.bgColor}88` : "0 2px 6px rgba(0,0,0,0.45)",
        userSelect: "none",
      }}>
        ❤️ Alice: Thanks for the stream!
      </div>
    );
  }

  function renderChat(isActive: boolean) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: 2,
        width: 130,
        outline: isActive ? "1.5px solid #fb923c" : "none",
        borderRadius: 4,
        userSelect: "none",
      }}>
        {FAKE_MSGS.map((msg, i) => (
          <div key={i} style={{
            background: "rgba(0,0,0,0.72)", borderRadius: 3,
            padding: "2px 5px", fontSize: 8,
            display: "flex", gap: 3, color: "#fff",
          }}>
            <span style={{ color: "#fb923c", fontWeight: 700, flexShrink: 0 }}>{msg.split(":")[0]}:</span>
            {msg.split(":").slice(1).join(":")}
          </div>
        ))}
      </div>
    );
  }

  function renderHandle(item: ItemDef) {
    const isActive = active === item.id;
    switch (item.id) {
      case "cam":     return renderCam(isActive);
      case "support": return renderSupport(isActive);
      case "chat":    return renderChat(isActive);
    }
  }

  const nudgeMeta: Record<ItemDef["id"], { emoji: string; label: string; color: string }> = {
    cam:     { emoji: "📷", label: "Camera",  color: "#818cf8" },
    support: { emoji: "❤️", label: "Support", color: "#ec4899" },
    chat:    { emoji: "💬", label: "Chat",    color: "#fb923c" },
  };

  return (
    <div className="flex flex-col gap-2">

      {/* ── Drag area ── */}
      <div
        ref={containerRef}
        className="relative w-full rounded-[8px] overflow-hidden border border-[var(--border-subtle)] bg-[#0c0c0c]"
        style={{ aspectRatio: "16/9", cursor: active ? "grabbing" : "default", userSelect: "none" }}
      >
        {/* Grid background or custom content */}
        {children ?? (
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: [
              "repeating-linear-gradient(0deg,transparent,transparent 24px,rgba(255,255,255,1) 25px)",
              "repeating-linear-gradient(90deg,transparent,transparent 24px,rgba(255,255,255,1) 25px)",
            ].join(","),
          }} />
        )}

        {items.map(item => (
          <div
            key={item.id}
            style={{
              position: "absolute",
              left: `${item.pos.x}%`,
              top:  `${item.pos.y}%`,
              zIndex: active === item.id ? 20 : 10,
              // cam wrapper takes the configured percentage width so its content can use width:100%
              ...(item.id === "cam" && camCfg ? { width: `${camCfg.widthPct}%` } : {}),
            }}
          >
            {/* inner drag target — stopPropagation is handled inside resize corner */}
            <div
              onMouseDown={e => startDrag(item, e)}
              style={{ cursor: active === item.id ? "grabbing" : "grab", width: "100%" }}
            >
              {renderHandle(item)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Nudge controls ── */}
      <div className="flex flex-wrap gap-4">
        {items.map(item => {
          const meta = nudgeMeta[item.id];
          return (
            <div key={item.id} className="flex flex-col gap-1 items-center">
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
                {meta.emoji} {meta.label}
              </span>
              <div className="grid grid-cols-3" style={{ gap: 2, width: 72 }}>
                <span /><NudgeBtn onClick={() => nudge(item, 0,     -STEP)} label="↑" /><span />
                <NudgeBtn onClick={() => nudge(item, -STEP, 0)} label="←" />
                <div className="flex items-center justify-center text-[0.5rem] text-[var(--text-muted)]" style={{ width: 22, height: 22 }}>
                  {Math.round(item.pos.x)},{Math.round(item.pos.y)}
                </div>
                <NudgeBtn onClick={() => nudge(item, +STEP, 0)} label="→" />
                <span /><NudgeBtn onClick={() => nudge(item, 0,     +STEP)} label="↓" /><span />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function Chip({ label, color, active }: { label: string; color: string; active: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: active ? color : "rgba(0,0,0,0.78)",
      border: `2px solid ${color}`,
      borderRadius: 6, padding: "3px 8px",
      fontSize: 11, fontWeight: 700,
      color: active ? "#fff" : color,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
    }}>
      {label}
    </div>
  );
}

function NudgeBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-[4px] text-[0.75rem] font-bold transition-colors hover:bg-[var(--bg-card)]"
      style={{ width: 22, height: 22, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
    >
      {label}
    </button>
  );
}
