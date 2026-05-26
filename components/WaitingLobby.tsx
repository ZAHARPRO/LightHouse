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
  gameEmoji?: string;
  subtitle: string;
  rated?: boolean;
  isHost: boolean;
  host: WaitingPlayer;
  guest: (WaitingPlayer & { ready: boolean }) | null;
  guestReady: boolean;
  myRole: "host" | "guest" | "spectator";
  onLeave: () => void;
  onReady?: () => void;
  onStart?: () => void;
  startDisabled?: boolean;
  startLabel?: string;
  onJoin?: () => void;
  joining?: boolean;
};

export default function WaitingLobby({
  gameName,
  gameEmoji,
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
  onJoin,
  joining,
}: WaitingLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [watchingAsSpectator, setWatchingAsSpectator] = useState(false);
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  async function handleCopy() {
    try { await navigator.clipboard.writeText(roomUrl); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Spectator invite card — shown when visitor opens the invite link
  if (myRole === "spectator" && !guest && !watchingAsSpectator) {
    return (
      <main className="max-w-sm mx-auto px-4 flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
        <div className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-8 flex flex-col items-center gap-5 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <div className="text-5xl">{gameEmoji ?? "🎮"}</div>
          <div className="text-center">
            <p className="text-xs font-display font-bold uppercase tracking-[0.1em] text-[var(--accent-orange)] mb-1">
              You&apos;re invited
            </p>
            <h1 className="text-xl font-display font-extrabold text-[var(--text-primary)] mb-1">
              {host.name ?? "Someone"} is waiting
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {gameName} · {subtitle}{rated ? " · Rated" : ""}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
            {host.image ? (
              <Image src={host.image} alt="" width={40} height={40} className="rounded-full shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--accent-orange)]/20 flex items-center justify-center text-[var(--accent-orange)] font-bold shrink-0">
                {host.name?.[0] ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-[var(--text-primary)] text-sm truncate">
                {host.name ?? "Host"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {host.elo ? `ELO ${host.elo}` : "Host"}
                {host.rankEmoji && host.rankLabel ? ` · ${host.rankEmoji} ${host.rankLabel}` : ""}
              </p>
            </div>
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
          </div>

          {onJoin && (
            <button
              onClick={onJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-base hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {joining ? <Loader2 size={18} className="animate-spin" /> : "Join as Player 2"}
            </button>
          )}

          <button
            onClick={() => setWatchingAsSpectator(true)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Watch as spectator instead
          </button>
        </div>
      </main>
    );
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
        <PlayerSlot player={host} label="Host" ready={true} />

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
            {startDisabled ? (startLabel ?? "Waiting for opponent…") : "Start!"}
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
