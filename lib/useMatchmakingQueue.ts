"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type MatchmakingQueueOptions = {
  /** Prefix for localStorage key: `{gameKey}_queue_start` */
  gameKey: string;
  /** If set, checked on mount for a mute (null = game has no mute system) */
  muteStatusApi?: string | null;
  /** Pass `searchParams.get("returning") === "1"` — auto-restarts search with saved elapsed */
  returning?: boolean;
  /**
   * Called when user clicks "Find Match".
   * - Return a roomId string to enter polling mode.
   * - Return null if the game was already navigated to (e.g. immediate match found).
   */
  startSearch: () => Promise<string | null>;
  /**
   * Called when user cancels or when component unmounts while searching.
   * @param roomId The room that was being polled, or null if startSearch returned null.
   */
  cancelSearch: (roomId: string | null) => Promise<void>;
  /**
   * Called every `pollIntervalMs` while searching.
   * - Return a route string (e.g. `/games/chess/online/${roomId}`) to navigate and stop.
   * - Return null to keep polling.
   */
  checkMatch: (roomId: string) => Promise<string | null>;
  onNavigate: (route: string) => void;
  pollIntervalMs?: number;
};

export type MatchmakingQueueState = {
  searching: boolean;
  elapsed: number;    // seconds since search started
  mutedSecs: number;  // seconds of mute remaining (0 = not muted)
  findMatch: () => Promise<void>;
  cancel: () => Promise<void>;
};

export function useMatchmakingQueue({
  gameKey,
  muteStatusApi,
  returning = false,
  startSearch,
  cancelSearch,
  checkMatch,
  onNavigate,
  pollIntervalMs = 2000,
}: MatchmakingQueueOptions): MatchmakingQueueState {
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mutedSecs, setMutedSecs] = useState(0);

  const roomIdRef       = useRef<string | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef    = useRef(0);
  const didAutoSearch   = useRef(false);
  const mutedSecsRef    = useRef(0);

  // Keep ref in sync with state so callbacks can read it without stale closure
  mutedSecsRef.current = mutedSecs;

  // Mute countdown ticker
  useEffect(() => {
    if (mutedSecs <= 0) return;
    const id = setInterval(() => setMutedSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [mutedSecs]);

  // Check mute on mount
  useEffect(() => {
    if (!muteStatusApi) return;
    fetch(muteStatusApi)
      .then(async r => {
        if (!r.ok) return;
        const d = (await r.json()) as { mutedUntil: string | null };
        if (!d.mutedUntil) return;
        const secs = Math.ceil((new Date(d.mutedUntil).getTime() - Date.now()) / 1000);
        if (secs > 0) setMutedSecs(secs);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAll() {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const beginPolling = useCallback((roomId: string, startedAt: number) => {
    pollRef.current = setInterval(async () => {
      try {
        const route = await checkMatch(roomId);
        if (route) {
          stopAll();
          setSearching(false);
          roomIdRef.current = null;
          localStorage.removeItem(`${gameKey}_queue_start`);
          onNavigate(route);
        }
      } catch { /* network hiccup — keep polling */ }
    }, pollIntervalMs);

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  }, [gameKey, checkMatch, onNavigate, pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-restart search when returning from an ejected room
  useEffect(() => {
    if (!returning || didAutoSearch.current) return;
    didAutoSearch.current = true;

    const savedStart = localStorage.getItem(`${gameKey}_queue_start`);
    const restoredStart = savedStart ? parseInt(savedStart, 10) : Date.now();
    startedAtRef.current = restoredStart;
    setElapsed(Math.floor((Date.now() - restoredStart) / 1000));

    // Small delay so mute check can resolve first
    const t = setTimeout(async () => {
      if (mutedSecsRef.current > 0) return;
      setSearching(true);
      try {
        const roomId = await startSearch();
        if (!roomId) { setSearching(false); return; }
        roomIdRef.current = roomId;
        localStorage.setItem(`${gameKey}_queue_start`, String(restoredStart));
        beginPolling(roomId, restoredStart);
      } catch {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [returning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => stopAll(), []);

  const findMatch = useCallback(async () => {
    if (searching || mutedSecsRef.current > 0) return;
    const start = Date.now();
    startedAtRef.current = start;
    localStorage.setItem(`${gameKey}_queue_start`, String(start));
    setElapsed(0);
    setSearching(true);

    try {
      const roomId = await startSearch();
      if (!roomId) { setSearching(false); return; } // already navigated or failed
      roomIdRef.current = roomId;
      beginPolling(roomId, start);
    } catch {
      setSearching(false);
      localStorage.removeItem(`${gameKey}_queue_start`);
    }
  }, [searching, gameKey, startSearch, beginPolling]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback(async () => {
    stopAll();
    const rId = roomIdRef.current;
    roomIdRef.current = null;
    startedAtRef.current = 0;
    localStorage.removeItem(`${gameKey}_queue_start`);
    setSearching(false);
    setElapsed(0);
    await cancelSearch(rId).catch(() => {});
  }, [gameKey, cancelSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { searching, elapsed, mutedSecs, findMatch, cancel };
}
