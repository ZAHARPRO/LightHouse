"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import Image from "next/image";
import {
  loadSettings, saveSettingsToStorage, loadGoogleFont,
  frameClip, GOOGLE_FONTS,
  type OverlaySettings,
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

export default function StreamChatOverlay({ streamId }: { streamId: string }) {
  const [msgs,     setMsgs]     = useState<ChatMsg[]>([]);
  const [settings, setSettings] = useState<OverlaySettings | null>(null);
  const [dragging, setDragging] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const posRef    = useRef({ x: 20, y: 20 });

  // Load settings from localStorage (set by broadcaster in setup)
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    // Load fonts
    if (GOOGLE_FONTS.includes(s.fontFamily)) loadGoogleFont(s.fontFamily);
    s.customFonts.forEach(f => loadGoogleFont(f.name));
  }, []);

  // Poll localStorage every 2s so overlay picks up live setting changes
  useEffect(() => {
    const t = setInterval(() => {
      const s = loadSettings();
      setSettings(s);
      if (GOOGLE_FONTS.includes(s.fontFamily)) loadGoogleFont(s.fontFamily);
      s.customFonts.forEach(f => loadGoogleFont(f.name));
    }, 2000);
    return () => clearInterval(t);
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
      panelRef.current.style.left = Math.max(0, ox + ev.clientX - startX) + "px";
      panelRef.current.style.top  = Math.max(0, oy + ev.clientY - startY) + "px";
    }
    function onUp() {
      setDragging(false);
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!settings) return null;

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
