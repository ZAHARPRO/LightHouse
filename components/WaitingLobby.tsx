"use client";

import Image from "next/image";
import { CheckCircle2, Clock, Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";

export type WaitingPlayer = {
  name: string | null;
  image: string | null;
  elo?: number | null;
  rankEmoji?: string;
  rankLabel?: string;
  rankColor?: string;
};

export type WaitingLobbyProps = {
  gameName: string;
  subtitle: string;           // "⚡ 5 min · Rated" — собирается снаружи
  rated?: boolean;
  isHost: boolean;
  host: WaitingPlayer;
  guest: (WaitingPlayer & { ready: boolean }) | null;
  guestReady: boolean;
  myRole: "host" | "guest";
  onLeave: () => void;
  onReady?: () => void;       // только для гостя
  onStart?: () => void;       // только для хоста
  startDisabled?: boolean;
  startLabel?: string;        // текст кнопки Start когда disabled
};

export default function WaitingLobby({
  gameName,
  subtitle,
  rated,
  isHost,
  host,
  guest,
  guestReady,
  myRole,
  onLeave,
  onReady,
  onStart,
  startDisabled,
  startLabel,
}: WaitingLobbyProps) {
  const [copied, setCopied] = useState(false);
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  async function handleCopy() {
    try { await navigator.clipboard.writeText(roomUrl); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      {/* Back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onLeave}
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm"
        >
          ← {isHost ? "Leave room" : "Leave Room"}
        </button>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">
        {gameName}
      </h1>
      <p className="text-[var(--text-muted)] text-sm mb-8 flex items-center gap-2">
        {subtitle}
        {rated && (
          <span className="text-xs font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
            Rated
          </span>
        )}
      </p>

      {/* Player slots */}
      <div className="flex flex-col gap-3 mb-8">
        {/* Host */}
        <PlayerSlot player={host} label="Host" ready={true} />

        {/* Guest */}
        {guest ? (
          <PlayerSlot player={guest} label="Guest" ready={guestReady} />
        ) : (
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border-subtle)]" />
            <p className="text-[var(--text-muted)] text-sm italic">Waiting for player…</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {myRole === "guest" && onReady && (
          <button
            onClick={onReady}
            className={[
              "flex-1 py-2.5 rounded-xl font-display font-bold text-sm border transition-colors",
              guestReady
                ? "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                : "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25",
            ].join(" ")}
          >
            {guestReady ? "Cancel Ready" : "Ready!"}
          </button>
        )}
        {myRole === "host" && onStart && (
          <button
            onClick={onStart}
            disabled={startDisabled}
            className="flex-1 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {startDisabled
              ? (startLabel ?? "Waiting for opponent…")
              : "Start!"}
          </button>
        )}
      </div>

      {/* Invite link */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
        <p className="text-[0.7rem] text-[var(--text-muted)] font-display font-semibold uppercase tracking-wider mb-2">
          Invite link
        </p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs font-mono text-[var(--text-secondary)] truncate">{roomUrl}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[0.7rem] font-display font-semibold transition-colors hover:text-[var(--text-primary)] shrink-0"
          >
            {copied ? (
              <><Check size={11} className="text-green-400" /> Copied</>
            ) : (
              <><Copy size={11} /> Copy</>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

function PlayerSlot({
  player,
  label,
  ready,
}: {
  player: WaitingPlayer;
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
      {player.image ? (
        <Image src={player.image} alt="" width={36} height={36} className="rounded-full shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold shrink-0">
          {player.name?.[0] ?? "?"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-[var(--text-primary)] text-sm">
          {player.name ?? "Anonymous"}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6rem] text-green-400">{label}</span>
          {player.rankEmoji && player.rankLabel && (
            <span className="text-[0.6rem] font-bold" style={{ color: player.rankColor }}>
              {player.rankEmoji} {player.rankLabel}
            </span>
          )}
          {player.elo != null && (
            <span className="text-[0.55rem] text-[var(--text-muted)]">ELO {player.elo}</span>
          )}
        </div>
      </div>
      {ready ? (
        <CheckCircle2 size={18} className="text-green-400 shrink-0" />
      ) : (
        <Clock size={18} className="text-[var(--text-muted)] shrink-0" />
      )}
    </div>
  );
}
