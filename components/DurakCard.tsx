"use client";

import type { Card } from "@/lib/durak";
import { SUIT_SYMBOL, SUIT_IS_RED } from "@/lib/durak";

type Size = "sm" | "md" | "lg";

const DIMS: Record<Size, { w: number; h: number; rank: string; suit: string; corner: string }> = {
  sm: { w: 38, h: 54, rank: "text-[0.7rem]", suit: "text-base", corner: "text-[0.6rem]" },
  md: { w: 56, h: 80, rank: "text-base", suit: "text-2xl", corner: "text-xs" },
  lg: { w: 72, h: 104, rank: "text-xl", suit: "text-3xl", corner: "text-sm" },
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
}: DurakCardProps) {
  const d = DIMS[size];

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`relative rounded-lg shrink-0 ${onClick ? "cursor-pointer" : ""} ${className ?? ""}`}
        style={{
          width: d.w,
          height: d.h,
          background: "repeating-linear-gradient(45deg, #1e293b, #1e293b 4px, #273449 4px, #273449 8px)",
          border: "2px solid #334155",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          ...style,
        }}
      >
        <div className="absolute inset-1.5 rounded border border-slate-600/50 flex items-center justify-center">
          <span className="text-slate-500 text-lg font-bold">♣</span>
        </div>
      </div>
    );
  }

  const red = SUIT_IS_RED[card.suit];
  const color = red ? "#dc2626" : "#1f2937";
  const sym = SUIT_SYMBOL[card.suit];

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg shrink-0 select-none transition-transform ${onClick ? "cursor-pointer hover:-translate-y-1" : ""} ${className ?? ""}`}
      style={{
        width: d.w,
        height: d.h,
        background: "linear-gradient(160deg, #fffdf7, #f3ead6)",
        border: selected ? "2px solid var(--accent-orange)" : "1px solid #c9bda0",
        boxShadow: selected
          ? "0 0 0 2px var(--accent-orange), 0 4px 10px rgba(0,0,0,0.35)"
          : "0 2px 6px rgba(0,0,0,0.3)",
        opacity: dimmed ? 0.45 : 1,
        ...style,
      }}
    >
      {/* top-left */}
      <div className="absolute top-0.5 left-1 flex flex-col items-center leading-none" style={{ color }}>
        <span className={`font-bold ${d.corner}`}>{card.rank}</span>
        <span className={d.corner}>{sym}</span>
      </div>
      {/* center suit */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <span className={`${d.suit} leading-none`}>{sym}</span>
      </div>
      {/* bottom-right (rotated) */}
      <div className="absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180" style={{ color }}>
        <span className={`font-bold ${d.corner}`}>{card.rank}</span>
        <span className={d.corner}>{sym}</span>
      </div>
    </div>
  );
}
