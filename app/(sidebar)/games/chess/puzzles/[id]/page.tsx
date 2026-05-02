"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, RotateCcw, Trophy, CheckCircle2, XCircle, ChevronLeft,
  Puzzle, ChevronRight, Lightbulb, Play, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  fromFEN, getLegalMoves, applyMove, getAllLegalMoves,
  type GameState, type Move, type PieceType,
} from "@/lib/chess";
import { useTranslations } from "next-intl";

// ── Constants ────────────────────────────────────────────────────────────────
const FILES = "abcdefgh";
const PIECE_UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function moveToUCI(move: Move): string {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  return `${FILES[fc]}${8 - fr}${FILES[tc]}${8 - tr}${move.promotion?.toLowerCase() ?? ""}`;
}

function squareToRC(sq: string): [number, number] {
  return [8 - parseInt(sq[1]), sq.charCodeAt(0) - 97];
}

// ── PuzzleBoard ───────────────────────────────────────────────────────────────
function PuzzleBoard({
  state, flip, selected, dots, lastMove, shake, onSquare, disabled, hintFrom, hintTo,
}: {
  state: GameState; flip: boolean; selected: [number,number]|null; dots: [number,number][];
  lastMove: [[number,number],[number,number]]|null; shake: boolean;
  onSquare: (r:number,c:number)=>void; disabled: boolean;
  hintFrom?: [number,number]|null; hintTo?: [number,number]|null;
}) {
  const ranks  = flip ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const fileRow = flip ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const dotSet  = new Set(dots.map(([r,c]) => r*8+c));
  const CELL = 64;

  return (
    <div style={{ display:"inline-block", animation: shake ? "puzzleShake 0.4s ease" : undefined }}>
      <style>{`@keyframes puzzleShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}35%{transform:translateX(6px)}55%{transform:translateX(-4px)}75%{transform:translateX(4px)}}`}</style>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(8,${CELL}px)`, border:"2px solid rgba(139,92,246,0.3)", borderRadius:6, overflow:"hidden" }}>
        {ranks.map(r => fileRow.map(c => {
          const piece = state.board[r][c];
          const light = (r+c)%2===0;
          const isSel = selected?.[0]===r && selected?.[1]===c;
          const isDot = dotSet.has(r*8+c);
          const isLast = lastMove && ((lastMove[0][0]===r&&lastMove[0][1]===c)||(lastMove[1][0]===r&&lastMove[1][1]===c));
          const isHintFrom = hintFrom?.[0]===r&&hintFrom?.[1]===c;
          const isHintTo   = hintTo?.[0]===r&&hintTo?.[1]===c;
          let bg = light ? "#f0d9b5" : "#b58863";
          if (isSel) bg = "#f6f669";
          else if (isHintTo||isHintFrom) bg = light ? "#f5c842" : "#d4a017";
          else if (isLast) bg = light ? "#cdd16f" : "#aaa23a";
          return (
            <div key={`${r}-${c}`} onClick={()=>!disabled&&onSquare(r,c)}
              style={{ width:CELL, height:CELL, background:bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", cursor:disabled?"default":"pointer", userSelect:"none" }}>
              {isDot && <div style={{ position:"absolute", width:piece?"88%":"30%", height:piece?"88%":"30%", borderRadius:"50%", background:piece?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.18)", border:piece?"3px solid rgba(0,0,0,0.25)":undefined, pointerEvents:"none" }} />}
              {piece && <span style={{ fontSize:42, lineHeight:1, position:"relative", zIndex:1, color:piece.color==="w"?"#fff":"#1a1a1a", textShadow:piece.color==="w"?"0 0 3px #000,0 0 6px #000,0 1px 2px #000":"0 1px 2px rgba(255,255,255,0.3)" }}>{PIECE_UNICODE[`${piece.color}${piece.type}`]}</span>}
              {c===(flip?7:0) && <span style={{ position:"absolute", top:2, left:3, fontSize:10, fontWeight:700, color:light?"#b58863":"#f0d9b5", lineHeight:1 }}>{8-r}</span>}
              {r===(flip?0:7) && <span style={{ position:"absolute", bottom:2, right:3, fontSize:10, fontWeight:700, color:light?"#b58863":"#f0d9b5", lineHeight:1 }}>{FILES[c]}</span>}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

// ── Promotion picker ──────────────────────────────────────────────────────────
function PromotionPicker({ color, onPick }: { color:"w"|"b"; onPick:(p:PieceType)=>void }) {
  return (
    <div className="absolute z-50 flex gap-1 bg-[var(--bg-elevated)] border border-violet-500/30 rounded-xl p-2 shadow-xl" style={{ top:"50%", left:"50%", transform:"translate(-50%,-50%)" }}>
      {(["Q","R","B","N"] as PieceType[]).map(p => (
        <button key={p} onClick={()=>onPick(p)} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-violet-500/20 transition-colors">
          <span style={{ fontSize:32 }}>{PIECE_UNICODE[`${color}${p}`]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Video recharge modal ──────────────────────────────────────────────────────
type AdVideoData = { id: string; title: string; url: string; duration: number };

function VideoModal({ onClose, onRecharged }: { onClose:()=>void; onRecharged:(pts:number)=>void }) {
  const t = useTranslations("puzzles");
  const [video, setVideo]     = useState<AdVideoData|null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [cooldownMin, setCooldownMin] = useState<number|null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchedRef = useRef(false);

  useEffect(() => {
    fetch("/api/hints/ad-video")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: AdVideoData) => { setVideo(d); setLoading(false); })
      .catch(() => { setError(t("noVideo")); setLoading(false); });
  }, [t]);

  function handleTimeUpdate() {
    if (!video || watchedRef.current) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.currentTime >= video.duration * 0.9) {
      watchedRef.current = true;
      setWatched(true);
    }
  }

  async function claimPoints() {
    if (!video || claiming) return;
    setClaiming(true);
    const res = await fetch("/api/hints/recharge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id }),
    });
    const data = await res.json() as { ok?: boolean; hintPoints?: number; error?: string; waitMin?: number };
    setClaiming(false);
    if (data.ok && data.hintPoints !== undefined) {
      onRecharged(data.hintPoints);
    } else if (data.error === "cooldown") {
      setCooldownMin(data.waitMin ?? 30);
    } else {
      setError(t("rechargeError"));
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[960] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18}/></button>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-amber-400"/>
          <h3 className="font-display font-bold text-[var(--text-primary)]">{t("rechargeTitle")}</h3>
        </div>
        <p className="text-[var(--text-muted)] text-sm mb-4">{t("rechargeDesc")}</p>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]"/></div>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-6">{error}</p>
        ) : cooldownMin !== null ? (
          <p className="text-yellow-400 text-sm text-center py-6">{t("cooldown", { min: cooldownMin })}</p>
        ) : video ? (
          <>
            <p className="text-[var(--text-secondary)] text-xs font-display font-semibold mb-2">{video.title}</p>
            <video
              ref={videoRef}
              src={video.url}
              controls
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => { watchedRef.current = true; setWatched(true); }}
              className="w-full rounded-xl mb-4 bg-black"
              style={{ maxHeight: 240 }}
            />
            <button
              onClick={claimPoints}
              disabled={!watched || claiming}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {claiming ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>}
              {watched ? t("claimPoint") : t("watchToUnlock")}
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PuzzleData = { id:string; title:string; difficulty:"mate1"|"mate2"; fen:string; alreadySolved:boolean };
type Status = "playing"|"wrong"|"opponent"|"solved"|"failed";

const DIFF_LABEL: Record<string,string> = { mate1:"Mate in 1", mate2:"Mate in 2" };

// ── Main component ────────────────────────────────────────────────────────────
export default function PuzzleSolverPage() {
  const { id } = useParams<{ id:string }>();
  const router = useRouter();
  const t = useTranslations("puzzles");

  const [puzzle, setPuzzle]   = useState<PuzzleData|null>(null);
  const [loadError, setLoadError] = useState(false);
  const [state, setState]     = useState<GameState|null>(null);
  const [flip, setFlip]       = useState(false);
  const [selected, setSelected] = useState<[number,number]|null>(null);
  const [dots, setDots]       = useState<[number,number][]>([]);
  const [lastMove, setLastMove] = useState<[[number,number],[number,number]]|null>(null);
  const [promoState, setPromoState] = useState<{from:[number,number];to:[number,number]}|null>(null);
  const [status, setStatus]   = useState<Status>("playing");
  const [shake, setShake]     = useState(false);
  const [nextId, setNextId]   = useState<string|null>(null);
  const [hintFrom, setHintFrom] = useState<[number,number]|null>(null);
  const [hintTo, setHintTo]   = useState<[number,number]|null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintPoints, setHintPoints] = useState<number|null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [newBadge, setNewBadge] = useState(false);

  // All moves played so far (user + bot interleaved)
  const movesRef      = useRef<string[]>([]);
  const currentFenRef = useRef("");

  useEffect(() => {
    fetch(`/api/puzzles/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: PuzzleData) => {
        setPuzzle(data);
        currentFenRef.current = data.fen;
        movesRef.current = [];
        const gs = fromFEN(data.fen);
        setState(gs);
        setFlip(gs.turn === "b");
        if (data.alreadySolved) setStatus("solved");
      })
      .catch(() => setLoadError(true));
    // Fetch hint points
    fetch("/api/puzzles/hint-points")
      .then(r => r.ok ? r.json() : null)
      .then((d: {hintPoints:number}|null) => { if (d) setHintPoints(d.hintPoints); })
      .catch(() => {});
  }, [id]);

  const reset = useCallback(() => {
    if (!puzzle) return;
    movesRef.current = [];
    currentFenRef.current = puzzle.fen;
    const gs = fromFEN(puzzle.fen);
    setState(gs);
    setFlip(gs.turn === "b");
    setSelected(null);
    setDots([]);
    setLastMove(null);
    setStatus("playing");
    setShake(false);
    setPromoState(null);
    setHintFrom(null);
    setHintTo(null);
    setHintUsed(false);
  }, [puzzle]);

  const submitMove = useCallback(async (move: Move) => {
    if (!state || !puzzle || status !== "playing") return;

    const uci = moveToUCI(move);
    const newState = applyMove(state, move);
    setState(newState);
    setLastMove([move.from, move.to]);
    setSelected(null);
    setDots([]);

    const newMoves = [...movesRef.current, uci];

    const res = await fetch(`/api/puzzles/${puzzle.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves: newMoves }),
    });
    const data = await res.json() as {
      status: "solved"|"failed"|"continue"|"invalid";
      botMove?: string; newFen?: string; badge?: string;
    };

    if (data.status === "invalid") {
      setShake(true);
      setStatus("wrong");
      const checkpoint = currentFenRef.current;
      setTimeout(() => {
        setShake(false);
        setState(fromFEN(checkpoint));
        setLastMove(null);
        setSelected(null);
        setDots([]);
        setStatus("playing");
      }, 700);
      return;
    }

    if (data.status === "solved") {
      movesRef.current = newMoves;
      setStatus("solved");
      if (data.badge === "PUZZLE_MASTER") setNewBadge(true);
      // Find next unsolved puzzle
      fetch("/api/puzzles")
        .then(r => r.json())
        .then((list: {id:string;solved:boolean}[]) => {
          const idx = list.findIndex(p => p.id === puzzle.id);
          const next = list.slice(idx+1).find(p => !p.solved) ?? list.slice(0,idx).find(p => !p.solved);
          setNextId(next?.id ?? null);
        }).catch(() => {});
      return;
    }

    if (data.status === "failed") {
      movesRef.current = newMoves;
      setStatus("failed");
      return;
    }

    // "continue" — bot responds
    movesRef.current = newMoves;
    setStatus("opponent");
    setTimeout(() => {
      if (data.newFen && data.botMove) {
        const fc = data.botMove.charCodeAt(0)-97;
        const fr = 8-parseInt(data.botMove[1]);
        const tc = data.botMove.charCodeAt(2)-97;
        const tr = 8-parseInt(data.botMove[3]);
        setState(fromFEN(data.newFen));
        setLastMove([[fr,fc],[tr,tc]]);
        currentFenRef.current = data.newFen;
        movesRef.current = [...movesRef.current, data.botMove];
      }
      setStatus("playing");
    }, 700);
  }, [state, puzzle, status]);

  const handleSquare = useCallback((r:number, c:number) => {
    if (!state || status !== "playing") return;
    if (promoState) return;
    const piece = state.board[r][c];

    if (selected) {
      const [sr,sc] = selected;
      const legal = getLegalMoves(state, sr, sc);
      const move  = legal.find(m => m.to[0]===r && m.to[1]===c);
      if (move) {
        const isPromo = state.board[sr][sc]?.type==="P" && ((state.turn==="w"&&r===0)||(state.turn==="b"&&r===7));
        if (isPromo) { setPromoState({from:[sr,sc],to:[r,c]}); return; }
        submitMove(move);
        return;
      }
      if (piece?.color===state.turn) { setSelected([r,c]); setDots(getLegalMoves(state,r,c).map(m=>m.to)); return; }
      setSelected(null); setDots([]);
      return;
    }
    if (piece?.color===state.turn) { setSelected([r,c]); setDots(getLegalMoves(state,r,c).map(m=>m.to)); }
  }, [state, selected, status, promoState, submitMove]);

  const handlePromo = useCallback((p:PieceType) => {
    if (!state || !promoState) return;
    const legal = getLegalMoves(state, promoState.from[0], promoState.from[1]);
    const move  = legal.find(m => m.to[0]===promoState.to[0] && m.to[1]===promoState.to[1] && m.promotion===p);
    setPromoState(null);
    if (move) submitMove(move);
  }, [state, promoState, submitMove]);

  async function handleHint() {
    if (status !== "playing" || !puzzle || hintUsed) return;
    if (hintPoints !== null && hintPoints <= 0) { setShowVideo(true); return; }

    const fen = encodeURIComponent(currentFenRef.current);
    const res = await fetch(`/api/puzzles/${puzzle.id}/hint?fen=${fen}`);
    if (!res.ok) {
      const d = await res.json() as { error?:string };
      if (d.error === "no_points") { setShowVideo(true); return; }
      return;
    }
    const d = await res.json() as { from:string; to:string; remainingPoints:number };
    setHintFrom(squareToRC(d.from));
    setHintTo(squareToRC(d.to));
    setHintUsed(true);
    setHintPoints(d.remainingPoints);
  }

  if (loadError) return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center">
      <p className="text-[var(--text-muted)]">{t("notFound")}</p>
      <Link href="/games/chess/puzzles" className="mt-4 inline-block text-violet-400 text-sm hover:underline">← {t("backToPuzzles")}</Link>
    </main>
  );
  if (!puzzle || !state) return (
    <main className="flex items-center justify-center py-40">
      <Loader2 size={28} className="animate-spin text-[var(--text-muted)]"/>
    </main>
  );

  const turnLabel = state.turn==="w" ? t("white") : t("black");
  const diffLabel = DIFF_LABEL[puzzle.difficulty];

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/games/chess/puzzles" className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
          <ChevronLeft size={15}/> {t("puzzles")}
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <Puzzle size={20} className="text-violet-400"/>
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">{puzzle.title}</h1>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-[0.7rem] font-display font-bold px-2 py-0.5 rounded-full border text-orange-400 bg-orange-500/10 border-orange-500/20">
          {diffLabel}
        </span>
        <span className="text-sm text-[var(--text-muted)]">{turnLabel} {t("toPlay")} — {diffLabel.toLowerCase()}</span>
        {hintPoints !== null && (
          <span className="flex items-center gap-1 ml-auto text-xs font-display font-semibold text-amber-400">
            <Lightbulb size={12}/> {hintPoints} {t("hintPoints")}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Board */}
        <div className="relative">
          <PuzzleBoard
            state={state} flip={flip} selected={selected} dots={dots}
            lastMove={lastMove} shake={shake} onSquare={handleSquare}
            disabled={status!=="playing"} hintFrom={hintFrom} hintTo={hintTo}
          />
          {promoState && (
            <div className="absolute inset-0 bg-black/30 rounded-md flex items-center justify-center">
              <PromotionPicker color={state.turn} onPick={handlePromo}/>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4 min-w-[200px]">
          {/* Status card */}
          <div className={[
            "rounded-2xl border px-5 py-4 flex flex-col items-center gap-2 text-center",
            status==="solved"  ? "bg-green-500/10 border-green-500/25"
            : status==="failed" ? "bg-red-500/10 border-red-500/25"
            : status==="wrong"  ? "bg-red-500/10 border-red-500/25"
            : status==="opponent" ? "bg-indigo-500/10 border-indigo-500/20"
            : "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
          ].join(" ")}>
            {status==="solved" ? (
              <>
                <Trophy size={28} className="text-yellow-400"/>
                <p className="font-display font-bold text-green-400 text-base">{t("solved")}</p>
                {newBadge && <p className="text-amber-400 text-xs font-display font-bold">🏆 {t("puzzleMaster")}</p>}
                <p className="text-[var(--text-muted)] text-xs">{t("wellDone")}</p>
              </>
            ) : status==="failed" ? (
              <>
                <XCircle size={28} className="text-red-400"/>
                <p className="font-display font-bold text-red-400 text-sm">{t("failed")}</p>
                <p className="text-[var(--text-muted)] text-xs">{t("tryAgain")}</p>
              </>
            ) : status==="wrong" ? (
              <>
                <XCircle size={28} className="text-red-400"/>
                <p className="font-display font-bold text-red-400 text-sm">{t("wrongMove")}</p>
              </>
            ) : status==="opponent" ? (
              <>
                <Loader2 size={24} className="animate-spin text-indigo-400"/>
                <p className="font-display font-bold text-indigo-400 text-sm">{t("opponentResponds")}</p>
              </>
            ) : (
              <>
                <CheckCircle2 size={24} className="text-violet-400"/>
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">{diffLabel}</p>
                <p className="text-[var(--text-muted)] text-xs">{turnLabel} {t("toMove")}</p>
              </>
            )}
          </div>

          <button onClick={()=>setFlip(f=>!f)}
            className="px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-secondary)] transition-colors">
            ⇅ {t("flipBoard")}
          </button>

          {(status==="playing"||status==="failed") && (
            <button onClick={handleHint} disabled={hintUsed}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-display font-semibold hover:bg-amber-500/20 disabled:opacity-40 transition-colors">
              <Lightbulb size={13}/>
              {hintUsed ? t("hintUsed") : hintPoints===0 ? t("watchForHint") : t("hint")}
            </button>
          )}

          <button onClick={reset}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-violet-400 transition-colors">
            <RotateCcw size={13}/> {t("reset")}
          </button>

          {(status==="solved"||status==="failed") && (
            <>
              {nextId && (
                <Link href={`/games/chess/puzzles/${nextId}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 text-white text-xs font-display font-bold hover:opacity-90 transition-opacity no-underline">
                  {t("nextPuzzle")} <ChevronRight size={13}/>
                </Link>
              )}
              <Link href="/games/chess/puzzles"
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-display font-bold hover:bg-violet-500/25 transition-colors no-underline">
                ← {t("morePuzzles")}
              </Link>
            </>
          )}
        </div>
      </div>

      {showVideo && <VideoModal onClose={()=>setShowVideo(false)} onRecharged={(pts)=>{ setHintPoints(pts); setShowVideo(false); }}/>}
    </main>
  );
}
