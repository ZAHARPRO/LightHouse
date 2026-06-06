"use client";

import { useState } from "react";
import type { Card } from "@/lib/durak";
import { SUIT_SYMBOL, SUIT_IS_RED } from "@/lib/durak";

type Size = "xs" | "sm" | "md" | "lg";

const DIMS: Record<Size, { w: number; h: number }> = {
  xs: { w: 32,  h: 46  },
  sm: { w: 52,  h: 74  },
  md: { w: 70,  h: 100 },
  lg: { w: 90,  h: 130 },
};

// corner: rank + small suit in top-left / bottom-right
const CORNER_FONT: Record<Size, { rank: string; suit: string }> = {
  xs: { rank: "0.45rem", suit: "0.45rem" },
  sm: { rank: "0.65rem", suit: "0.6rem"  },
  md: { rank: "0.75rem", suit: "0.68rem" },
  lg: { rank: "0.9rem",  suit: "0.8rem"  },
};

// Pip positions [left%, top%] — pips with top > 54% are rendered rotated 180°
const PIPS: Record<string, [number, number][]> = {
  "6":  [[25,16],[75,16],[25,50],[75,50],[25,84],[75,84]],
  "7":  [[25,13],[75,13],[50,35],[25,65],[75,65],[25,87],[75,87]],
  "8":  [[25,10],[75,10],[25,35],[75,35],[25,65],[75,65],[25,90],[75,90]],
  "9":  [[20,12],[50,12],[80,12],[20,50],[50,50],[80,50],[20,88],[50,88],[80,88]],
  "10": [[25,7],[75,7],[50,22],[25,42],[75,42],[25,58],[75,58],[50,78],[25,93],[75,93]],
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
  const cf = CORNER_FONT[size];
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setDragging(true);
    onDragStart?.(e);
  };
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDragging(false);
    onDragEnd?.(e);
  };

  /* ── Face-down / blank ── */
  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={[
          "relative rounded-lg shrink-0 select-none",
          onClick || isDraggable ? "cursor-pointer" : "",
          dragging ? "opacity-50 scale-105" : "",
          className ?? "",
        ].join(" ")}
        style={{
          width: d.w, height: d.h,
          background: "repeating-linear-gradient(45deg,#1e293b,#1e293b 5px,#273449 5px,#273449 10px)",
          border: "2px solid #334155",
          boxShadow: "0 3px 8px rgba(0,0,0,0.4)",
          ...style,
        }}
      >
        <div className="absolute inset-2 rounded border border-slate-600/50 flex items-center justify-center">
          <span className="text-slate-500 font-bold" style={{ fontSize: 16 }}>♣</span>
        </div>
      </div>
    );
  }

  const red = SUIT_IS_RED[card.suit];
  const color = red ? "#dc2626" : "#1a1a2e";
  const sym = SUIT_SYMBOL[card.suit];
  const rank = card.rank;
  const isFace = rank === "J" || rank === "Q" || rank === "K";
  const isAce  = rank === "A";
  const isLg   = size === "lg";
  const isMd   = size === "md";
  const showDetail = isMd || isLg;

  /* ── Center content ── */
  const centerContent = () => {
    if (!showDetail) {
      // xs / sm: just a large suit symbol
      const bigFont = size === "sm" ? 22 : 14;
      return (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
          <span style={{ fontSize: bigFont, lineHeight: 1 }}>{sym}</span>
        </div>
      );
    }

    if (isAce) {
      // Ace — oversized suit centred, clear of both corners
      return (
        <div
          className="absolute flex items-center justify-center"
          style={{ inset: isLg ? "26px 10px 30px" : "20px 8px 26px", color }}
        >
          <span style={{ fontSize: isLg ? 50 : 36, lineHeight: 1, opacity: 0.92 }}>{sym}</span>
        </div>
      );
    }

    if (isFace) {
      // J / Q / K — decorative box with rank letter + suit
      const accentBg   = red ? "rgba(220,38,38,0.07)" : "rgba(15,15,40,0.05)";
      const accentBrd  = red ? "rgba(220,38,38,0.22)" : "rgba(15,15,40,0.18)";
      const rankSize   = isLg ? 30 : 22;
      const suitSize   = isLg ? 17 : 12;
      return (
        <div
          className="absolute"
          style={{
            inset: isLg ? "24px 9px 32px" : "18px 7px 26px",
            background: accentBg,
            border: `1px solid ${accentBrd}`,
            borderRadius: 5,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
          }}
        >
          <span style={{ fontSize: rankSize, fontWeight: 800, color, lineHeight: 1, fontFamily: "Georgia, serif" }}>{rank}</span>
          <span style={{ fontSize: suitSize, color, lineHeight: 1 }}>{sym}</span>
        </div>
      );
    }

    // Number cards 6-10 — pip pattern
    const pipList = PIPS[rank] ?? [];
    const pipFont = isLg ? 11 : 9;
    return (
      <div
        className="absolute"
        style={{ inset: isLg ? "24px 10px 32px" : "18px 7px 26px" }}
      >
        {pipList.map(([x, y], idx) => (
          <span
            key={idx}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%)${y > 54 ? " rotate(180deg)" : ""}`,
              fontSize: pipFont,
              color,
              lineHeight: 1,
              display: "block",
            }}
          >
            {sym}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={[
        "relative rounded-lg shrink-0 select-none",
        onClick ? "cursor-pointer" : "",
        isDraggable ? "cursor-grab active:cursor-grabbing" : "",
        dragging ? "opacity-60 scale-105" : "",
        className ?? "",
      ].join(" ")}
      style={{
        width: d.w, height: d.h,
        background: "linear-gradient(160deg,#fffef8 0%,#f5e8cc 100%)",
        border: selected ? "2.5px solid var(--accent-orange)" : "1.5px solid #c8b89a",
        boxShadow: selected
          ? "0 0 0 2px var(--accent-orange),0 5px 14px rgba(0,0,0,0.4)"
          : dragging
          ? "0 10px 24px rgba(0,0,0,0.45)"
          : "0 3px 8px rgba(0,0,0,0.3)",
        opacity: dimmed ? 0.4 : 1,
        ...style,
      }}
    >
      {/* Top-left corner */}
      <div
        className="absolute top-1 left-1.5 flex flex-col items-center leading-none"
        style={{ color }}
      >
        <span style={{ fontSize: cf.rank, fontWeight: 700, lineHeight: 1 }}>{rank}</span>
        <span style={{ fontSize: cf.suit, lineHeight: 1 }}>{sym}</span>
      </div>

      {/* Centre */}
      {centerContent()}

      {/* Bottom-right corner (rotated) */}
      <div
        className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180"
        style={{ color }}
      >
        <span style={{ fontSize: cf.rank, fontWeight: 700, lineHeight: 1 }}>{rank}</span>
        <span style={{ fontSize: cf.suit, lineHeight: 1 }}>{sym}</span>
      </div>
    </div>
  );
}
