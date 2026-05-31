"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import Image from "next/image";
import {
  loadSettings, saveSettingsToStorage, loadGoogleFont,
  frameClip, GOOGLE_FONTS, POS_KEY,
  type OverlaySettings, type PosPreset,
} from "@/components/StreamOverlaySettings";

type ChatMsg = {
  id: string;
  text: string;
  userName: string;
  userImage?: string | null;
  userId: string;
  isSupport?: boolean;
  at: number;
};

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

const PANEL_W = 340;
const GAP     = 20;

function calcPos(preset: PosPreset): { x: number; y: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  switch (preset) {
    case "top-left":     return { x: GAP,           y: GAP };
    case "top-right":    return { x: W - PANEL_W - GAP, y: GAP };
    case "bottom-left":  return { x: GAP,           y: H - 420 };
    case "bottom-right": return { x: W - PANEL_W - GAP, y: H - 420 };
    default:             return { x: W - PANEL_W - GAP, y: GAP };
  }
}

function loadSavedPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

export default function StreamChatOverlay({ streamId }: { streamId: string }) {
  const [msgs,     setMsgs]     = useState<ChatMsg[]>([]);
  const [settings, setSettings] = useState<OverlaySettings | null>(null);
  const [dragging, setDragging] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  // Default: top-right — calculated client-side after mount
  const posRef    = useRef({ x: -1, y: 20 }); // x=-1 = not yet initialised

  const prevPosXYRef = useRef<{ x: number; y: number } | null>(null);

  function applyPos(pos: { x: number; y: number }) {
    posRef.current = pos;
    if (panelRef.current) {
      panelRef.current.style.left = pos.x + "px";
      panelRef.current.style.top  = pos.y + "px";
    }
  }

  function pctToPixels(pct: { x: number; y: number }) {
    return {
      x: pct.x * window.innerWidth  / 100,
      y: pct.y * window.innerHeight / 100,
    };
  }

  // Initial position: saved drag pos → else posXY percent
  useEffect(() => {
    const saved = loadSavedPos();
    const s = loadSettings();
    const posXY = s.posXY ?? { x: 68, y: 4 };
    applyPos(saved ?? pctToPixels(posXY));
    prevPosXYRef.current = posXY;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load settings from localStorage (set by broadcaster in setup)
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (GOOGLE_FONTS.includes(s.fontFamily)) loadGoogleFont(s.fontFamily);
    s.customFonts.forEach(f => loadGoogleFont(f.name));
  }, []);

  // Poll localStorage every 2s — pick up live setting changes incl. posPreset
  useEffect(() => {
    const t = setInterval(() => {
      const s = loadSettings();
      setSettings(s);
      if (GOOGLE_FONTS.includes(s.fontFamily)) loadGoogleFont(s.fontFamily);
      s.customFonts.forEach(f => loadGoogleFont(f.name));
      // If posXY changed in settings, jump to new position (clears saved drag pos)
      const posXY = s.posXY ?? { x: 68, y: 4 };
      const prev  = prevPosXYRef.current;
      if (!prev || prev.x !== posXY.x || prev.y !== posXY.y) {
        prevPosXYRef.current = posXY;
        localStorage.removeItem(POS_KEY);
        applyPos(pctToPixels(posXY));
      }
    }, 2000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE
  useEffect(() => {
    if (!streamId) return;
    const es = new EventSource(`/api/streams/${streamId}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "chat")
          setMsgs(prev => [...prev, data as ChatMsg].slice(-50));
        if (data.type === "stream_ended")
          setMsgs([]);
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [streamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Drag
  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: rect.left, oy: rect.top };
    setDragging(true);

    function onMove(ev: MouseEvent) {
      if (!dragRef.current || !panelRef.current) return;
      const { startX, startY, ox, oy } = dragRef.current;
      const x = Math.max(0, ox + ev.clientX - startX);
      const y = Math.max(0, oy + ev.clientY - startY);
      panelRef.current.style.left = x + "px";
      panelRef.current.style.top  = y + "px";
      posRef.current = { x, y };
    }
    function onUp() {
      setDragging(false);
      dragRef.current = null;
      savePos(posRef.current); // persist drag position
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!settings || !settings.enabled) return null;

  const visibleMsgs    = msgs.slice(-settings.maxMessages);
  const overlayBg      = `rgba(${hexToRgb(settings.overlayBgColor)},${settings.overlayBgOpacity / 100})`;
  const msgBg          = `rgba(${hexToRgb(settings.msgBgColor)},${settings.msgBgOpacity / 100})`;
  const isPresetFrame  = ["circle","rounded","squircle"].includes(settings.avatarFrame);
  const borderRadius   = isPresetFrame ? frameClip(settings.avatarFrame) : "50%";
  const customFrameUrl = settings.customFrames.find(f => f.id === settings.avatarFrame)?.url;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", fontFamily: `'${settings.fontFamily}', sans-serif` }}>
      <div
        ref={panelRef}
        style={{
          position: "absolute",
          left: posRef.current.x,
          top:  posRef.current.y,
          width: 340,
          background: overlayBg,
          borderRadius: 12,
          overflow: "hidden",
          userSelect: "none",
          cursor: dragging ? "grabbing" : "default",
        }}
      >
        {/* Drag handle — appears on hover */}
        <div
          className="overlay-grip"
          onMouseDown={onDragStart}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "3px 0", cursor: "grab", opacity: 0, transition: "opacity 0.15s",
          }}
        >
          <GripVertical size={14} color="rgba(255,255,255,0.4)" />
        </div>

        {/* Messages */}
        <div style={{ maxHeight: 520, overflowY: "auto", padding: "2px 8px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
          {visibleMsgs.map(m => (
            <div key={m.id} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              background: msgBg, borderRadius: 10, padding: "5px 8px",
              animation: "overlayIn 0.22s ease",
            }}>
              {settings.showAvatars && (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {m.userImage ? (
                    <Image src={m.userImage} alt="" width={28} height={28}
                      style={{ borderRadius, objectFit: "cover", display: "block" }} unoptimized />
                  ) : (
                    <div style={{
                      width: 28, height: 28, borderRadius,
                      background: "rgba(255,255,255,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: settings.textColor, fontSize: 11, fontWeight: 700,
                    }}>
                      {m.userName[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  {customFrameUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customFrameUrl} alt="" style={{ position: "absolute", inset: -2, width: 32, height: 32, pointerEvents: "none" }} />
                  )}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 1 }}>
                  <span style={{
                    fontSize: settings.fontSize * 0.8, fontWeight: settings.fontWeight,
                    color: m.isSupport ? "#f9a8d4" : "#fb923c",
                    maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {m.userName}
                  </span>
                  {settings.showTimestamps && (
                    <span style={{ fontSize: settings.fontSize * 0.7, color: "rgba(255,255,255,0.35)" }}>
                      {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <p style={{
                  margin: 0, fontSize: settings.fontSize,
                  fontWeight: settings.fontWeight, color: settings.textColor,
                  wordBreak: "break-word", lineHeight: 1.35,
                }}>
                  {m.text}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <style>{`
        .overlay-grip { opacity: 0 !important; transition: opacity 0.15s; }
        .overlay-grip:hover,
        div:hover > .overlay-grip { opacity: 1 !important; }
        @keyframes overlayIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
}
