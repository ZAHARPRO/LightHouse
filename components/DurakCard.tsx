"use client";

import { useState } from "react";
import type { Card } from "@/lib/durak";
import { SUIT_SYMBOL, SUIT_IS_RED } from "@/lib/durak";

type Size = "xs" | "sm" | "md" | "lg";

const DIMS: Record<Size, { w: number; h: number; rank: string; suit: string; corner: string }> = {
  xs: { w: 32, h: 46,  rank: "text-[0.55rem]", suit: "text-sm",    corner: "text-[0.45rem]" },
  sm: { w: 52, h: 74,  rank: "text-sm",        suit: "text-xl",    corner: "text-[0.65rem]" },
  md: { w: 70, h: 100, rank: "text-lg",        suit: "text-3xl",   corner: "text-[0.75rem]" },
  lg: { w: 90, h: 130, rank: "text-2xl",       suit: "text-4xl",   corner: "text-sm" },
};

interface DurakCardProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: Size;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export default function DurakCard({
  card,
  faceDown,
  size = "md",
  selected,
  dimmed,
  onClick,
  className,
  style,
  draggable: isDraggable,
  onDragStart,
  onDragEnd,
}: DurakCardProps) {
  const d = DIMS[size];
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setDragging(true);
    onDragStart?.(e);
  };
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDragging(false);
    onDragEnd?.(e);
  };

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={[
          "relative rounded-lg shrink-0",
          onClick || isDraggable ? "cursor-pointer" : "",
          dragging ? "opacity-50 scale-105" : "",
          className ?? "",
        ].join(" ")}
        style={{
          width: d.w,
          height: d.h,
          background: "repeating-linear-gradient(45deg, #1e293b, #1e293b 5px, #273449 5px, #273449 10px)",
          border: "2px solid #334155",
          boxShadow: "0 3px 8px rgba(0,0,0,0.4)",
          ...style,
        }}
      >
        <div className="absolute inset-2 rounded border border-slate-600/50 flex items-center justify-center">
          <span className="text-slate-500 text-xl font-bold">♣</span>
        </div>
      </div>
    );
  }

  const red = SUIT_IS_RED[card.suit];
  const color = red ? "#dc2626" : "#1a1a2e";
  const sym = SUIT_SYMBOL[card.suit];

  return (
    <div
      onClick={onClick}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={[
        "relative rounded-lg shrink-0 select-none transition-transform",
        onClick ? "cursor-pointer hover:-translate-y-1.5" : "",
        isDraggable ? "cursor-grab active:cursor-grabbing" : "",
        dragging ? "opacity-60 scale-105 rotate-3" : "",
        className ?? "",
      ].join(" ")}
      style={{
        width: d.w,
        height: d.h,
        background: "linear-gradient(160deg, #fffef8 0%, #f5e8cc 100%)",
        border: selected ? "2.5px solid var(--accent-orange)" : "1.5px solid #c8b89a",
        boxShadow: selected
          ? "0 0 0 2px var(--accent-orange), 0 5px 14px rgba(0,0,0,0.4)"
          : dragging
          ? "0 10px 24px rgba(0,0,0,0.45)"
          : "0 3px 8px rgba(0,0,0,0.3)",
        opacity: dimmed ? 0.4 : 1,
        ...style,
      }}
    >
      {/* top-left corner */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none" style={{ color }}>
        <span className={`font-bold leading-none ${d.corner}`}>{card.rank}</span>
        <span className={`leading-none ${d.corner}`}>{sym}</span>
      </div>
      {/* center suit — large and crisp */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <span className={`${d.suit} leading-none font-normal`} style={{ textShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>{sym}</span>
      </div>
      {/* bottom-right corner (rotated) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180" style={{ color }}>
        <span className={`font-bold leading-none ${d.corner}`}>{card.rank}</span>
        <span className={`leading-none ${d.corner}`}>{sym}</span>
      </div>
    </div>
  );
}
