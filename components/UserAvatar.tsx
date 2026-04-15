import React from "react";

const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24",
  PRO: "#f97316",
  BASIC: "#6366f1",
  FREE: "#666",
};

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-[0.5rem]",
  sm: "w-7 h-7 text-[0.625rem]",
  md: "w-9 h-9 text-[0.75rem]",
  lg: "w-12 h-12 text-[0.9375rem]",
  xl: "w-16 h-16 text-[1.125rem]",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  /** Display name — used for initials fallback */
  name: string;
  /** Avatar image URL; if absent, initials are shown */
  image?: string | null;
  /** Tier key: ELITE | PRO | BASIC | FREE (default: FREE) */
  tier?: string;
  /** Avatar size preset (default: sm) */
  size?: AvatarSize;
  /** Extra Tailwind classes for the wrapper */
  className?: string;
}

export default function UserAvatar({
  name,
  image,
  tier = "FREE",
  size = "sm",
  className = "",
}: UserAvatarProps) {
  const color = TIER_COLORS[tier] ?? TIER_COLORS.FREE;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className={[
        "rounded-full flex items-center justify-center shrink-0 overflow-hidden",
        sizeClass,
        className,
      ].join(" ")}
      style={
        image
          ? { border: `2px solid ${color}44` }
          : { background: `${color}22`, border: `2px solid ${color}44` }
      }
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          className="font-display font-bold leading-none select-none"
          style={{ color }}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
