"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type CosmItem = { icon: string; color: string; name: string };
type Cosmetics = { frame: CosmItem | null; badges: CosmItem[] };

// Module-level cache — shared across all instances, avoids duplicate fetches per page render
const cosmeticsCache = new Map<string, Promise<Cosmetics>>();

function fetchCosmetics(userId: string): Promise<Cosmetics> {
  if (!cosmeticsCache.has(userId)) {
    cosmeticsCache.set(
      userId,
      fetch(`/api/user-cosmetics/${userId}`)
        .then((r) => r.json())
        .catch(() => ({ frame: null, badges: [] })),
    );
  }
  return cosmeticsCache.get(userId)!;
}

interface Props {
  userId: string;
  name: string | null;
  image: string | null;
  /** pixel size of the avatar circle */
  size?: number;
  className?: string;
  /** skip badge row (use when space is very tight) */
  noBadges?: boolean;
}

export default function PlayerAvatar({ userId, name, image, size = 32, className, noBadges }: Props) {
  const [cosmetics, setCosmetics] = useState<Cosmetics>({ frame: null, badges: [] });

  useEffect(() => {
    let alive = true;
    fetchCosmetics(userId).then((c) => { if (alive) setCosmetics(c); });
    return () => { alive = false; };
  }, [userId]);

  const { frame, badges } = cosmetics;
  const badgeSize = Math.max(10, Math.round(size * 0.38));
  const initial = (name?.[0] ?? "?").toUpperCase();
  const fontSize = Math.round(size * 0.4);

  return (
    <div className={`inline-flex flex-col items-center gap-[3px] ${className ?? ""}`} style={{ width: size }}>
      {/* Avatar circle + frame ring */}
      <div
        className="relative rounded-full shrink-0 overflow-visible"
        style={{ width: size, height: size }}
      >
        {/* Frame glow ring */}
        {frame && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none z-10"
            style={{
              boxShadow: `0 0 0 2.5px ${frame.color}, 0 0 8px ${frame.color}60`,
            }}
          />
        )}

        {/* Avatar image / fallback */}
        {image ? (
          <Image
            src={image}
            alt={name ?? ""}
            width={size}
            height={size}
            className="rounded-full object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center font-display font-extrabold bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            style={{ width: size, height: size, fontSize }}
          >
            {initial}
          </div>
        )}

        {/* Badge overlay — bottom-right, stacked for up to 2 */}
        {!noBadges && badges.length > 0 && (
          <div
            className="absolute flex items-center justify-center z-20"
            style={{
              bottom: -Math.round(badgeSize * 0.3),
              right: -Math.round(badgeSize * 0.3),
              gap: 2,
            }}
          >
            {badges.slice(0, 2).reverse().map((b, i) => (
              <span
                key={i}
                title={b.name}
                className="flex items-center justify-center rounded-full border border-[var(--bg-primary)]"
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  fontSize: badgeSize * 0.7,
                  background: `${b.color}22`,
                  lineHeight: 1,
                  zIndex: 20 - i,
                  marginLeft: i > 0 ? -Math.round(badgeSize * 0.35) : 0,
                }}
              >
                {b.icon}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Badge row BELOW avatar — shown only when noBadges is false and badges > 2 */}
      {!noBadges && badges.length > 2 && (
        <div className="flex items-center gap-[2px]">
          {badges.map((b, i) => (
            <span
              key={i}
              title={b.name}
              style={{ fontSize: badgeSize * 0.75, lineHeight: 1 }}
            >
              {b.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
