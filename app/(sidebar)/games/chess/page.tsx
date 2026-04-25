"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { RotateCcw, Flag, ChevronRight } from "lucide-react";
import {
  initialState, getLegalMoves, applyMove, toSAN,
  isCheckmate, isStalemate, isInCheck,
  type GameState, type Move,
} from "@/lib/chess";
import { getBotMove } from "@/lib/chess-bot";

type Difficulty = "easy" | "medium" | "hard";
type Status = "idle" | "playing" | "over";

const PIECE_UNICODE: Record<string, string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};
const FILES = "abcdefgh";
const LIGHT = "#f0d9b5", DARK = "#b58863";

interface BoardProps {
  state: GameState;
  selected: [number,number]|null;
  legalDots: [number,number][];
  lastMove: Move|null;
  onSquare: (r:number,c:number)=>void;
  disabled?: boolean;
}

function ChessBoard({ state, selected, legalDots, lastMove, onSquare, disabled }: BoardProps) {
  const displayRows = [0,1,2,3,4,5,6,7]; // white at bottom
  return (
    <div className="inline-block select-none" style={{ border: "2px solid #8f7a5a" }}>
      {displayRows.map(r => (
        <div key={r} className="flex">
          <div className="w-5 flex items-center justify-center text-[0.6rem] font-mono" style={{ color:"#8f7a5a" }}>
            {8-r}
          </div>
          {[0,1,2,3,4,5,6,7].map(c => {
            const isLight = (r+c)%2===0;
            const isSel = selected?.[0]===r && selected?.[1]===c;
            const isLM = lastMove && (
              (lastMove.from[0]===r && lastMove.from[1]===c) ||
              (lastMove.to[0]===r && lastMove.to[1]===c)
            );
            const isDot = legalDots.some(([lr,lc])=>lr===r&&lc===c);
            const piece = state.board[r][c];
            let bg = isLight ? LIGHT : DARK;
            if (isSel || isLM) bg = "#f6f669";
            return (
              <div
                key={c}
                className="relative flex items-center justify-center cursor-pointer"
                style={{ width:56, height:56, background:bg, flexShrink:0 }}
                onClick={()=>!disabled && onSquare(r,c)}
              >
                {isDot && (
                  <div className={[
                    "absolute rounded-full pointer-events-none",
                    piece ? "inset-0 border-[5px] border-black/25 rounded-none" : "w-[34%] h-[34%] bg-black/25"
                  ].join(" ")} />
                )}
                {piece && (
                  <span
                    className="text-[2.4rem] leading-none pointer-events-none"
                    style={{
                      color: piece.color==="w" ? "#fff" : "#1a1a1a",
                      textShadow: piece.color==="w"
                        ? "0 0 3px #000,0 0 6px #000,0 1px 2px #000"
                        : "0 1px 2px rgba(255,255,255,0.3)",
                    }}
                  >
                    {PIECE_UNICODE[piece.color+piece.type]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex ml-5">
        {[0,1,2,3,4,5,6,7].map(c=>(
          <div key={c} style={{ width:56, textAlign:"center", fontSize:"0.6rem", color:"#8f7a5a", fontFamily:"monospace" }}>
            {FILES[c]}
          </div>
        ))}
      </div>
    </div>
  );
}

function MovePanel({ moves }: { moves: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{ ref.current?.scrollTo({ top:9999, behavior:"smooth" }); },[moves]);
  const pairs: [string,string|undefined][] = [];
  for (let i=0; i<moves.length; i+=2) pairs.push([moves[i], moves[i+1]]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto min-h-0">
      {pairs.length===0 && (
        <p className="text-[var(--text-muted)] text-xs italic py-2 px-1">No moves yet</p>
      )}
      {pairs.map(([w,b],i)=>(
        <div key={i} className="flex gap-1 text-sm font-mono px-2 py-0.5 rounded hover:bg-[var(--bg-secondary)]">
          <span className="text-[var(--text-muted)] w-7 shrink-0">{i+1}.</span>
          <span className="flex-1 text-[var(--text-primary)]">{w}</span>
          <span className="flex-1 text-[var(--text-secondary)]">{b??""}</span>
        </div>
      ))}
    </div>
  );
}

export default function ChessVsBotPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [status, setStatus] = useState<Status>("idle");
  const [gameState, setGameState] = useState<GameState>(initialState());
  const [selected, setSelected] = useState<[number,number]|null>(null);
  const [legalDots, setLegalDots] = useState<[number,number][]>([]);
  const [lastMove, setLastMove] = useState<Move|null>(null);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [result, setResult] = useState<string>("");
  const [botThinking, setBotThinking] = useState(false);

  function startGame() {
    const s = initialState();
    setGameState(s);
    setSelected(null);
    setLegalDots([]);
    setLastMove(null);
    setMoveList([]);
    setResult("");
    setBotThinking(false);
    setStatus("playing");
  }

  const doMove = useCallback((state: GameState, move: Move): GameState => {
    const san = toSAN(state, move);
    const next = applyMove(state, move);
    setLastMove(move);
    setMoveList(prev=>[...prev, san]);
    setGameState(next);

    if (isCheckmate(next)) {
      setResult(next.turn==="b" ? "White wins!" : "Black wins!");
      setStatus("over");
    } else if (isStalemate(next)) {
      setResult("Stalemate — draw!");
      setStatus("over");
    }
    return next;
  }, []);

  const triggerBot = useCallback((state: GameState) => {
    if (state.turn !== "b") return;
    if (isCheckmate(state) || isStalemate(state)) return;
    setBotThinking(true);
    setTimeout(()=>{
      const botMove = getBotMove(state, difficulty);
      if (botMove) {
        const next = doMove(state, botMove);
        void next;
      }
      setBotThinking(false);
    }, 300);
  }, [difficulty, doMove]);

  function handleSquare(r: number, c: number) {
    if (status !== "playing" || gameState.turn !== "w" || botThinking) return;
    const piece = gameState.board[r][c];

    if (selected) {
      const [sr, sc] = selected;
      if (sr===r && sc===c) { setSelected(null); setLegalDots([]); return; }
      const legal = getLegalMoves(gameState, sr, sc);
      const move = legal.find(m=>m.to[0]===r&&m.to[1]===c);
      if (move) {
        const actualMove = move.promotion ? { ...move, promotion: "Q" as const } : move;
        setSelected(null); setLegalDots([]);
        const next = doMove(gameState, actualMove);
        if (!isCheckmate(next) && !isStalemate(next)) triggerBot(next);
        return;
      }
    }
    if (piece?.color==="w") {
      setSelected([r,c]);
      setLegalDots(getLegalMoves(gameState, r, c).map(m=>m.to));
    } else {
      setSelected(null); setLegalDots([]);
    }
  }

  const inCheck = status==="playing" && isInCheck(gameState, gameState.turn);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)]">Chess</h1>
        <span className="text-[var(--text-muted)] text-sm">vs Bot</span>
        {status==="playing" && (
          <span className="ml-auto text-sm font-display font-semibold text-[var(--text-secondary)]">
            {botThinking ? "🤖 Thinking…" : gameState.turn==="w" ? "Your move (whites)" : "Black's move"}
            {inCheck && <span className="ml-2 text-red-400 font-bold">Check!</span>}
          </span>
        )}
      </div>

      {status === "idle" && (
        <div className="flex flex-col items-center gap-8 py-16 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="text-6xl">♛</div>
          <div className="flex gap-3">
            {(["easy","medium","hard"] as Difficulty[]).map(d=>(
              <button key={d} onClick={()=>setDifficulty(d)}
                className={["px-5 py-2 rounded-lg font-display font-semibold text-sm border transition-all",
                  difficulty===d ? "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                ].join(" ")}
              >
                {d==="easy"?"Easy":d==="medium"?"Medium":"Hard"}
              </button>
            ))}
          </div>
          <button onClick={startGame}
            className="px-8 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold hover:opacity-90 transition-opacity">
            Start Game
          </button>
        </div>
      )}

      {status !== "idle" && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Board */}
          <div className="relative">
            {/* Black indicator */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-sm bg-[#1a1a1a] border border-[var(--border-subtle)]" />
              <span className="text-sm font-display font-semibold text-[var(--text-secondary)]">
                Bot ({difficulty==="easy"?"Easy":difficulty==="medium"?"Medium":"Hard"})
              </span>
            </div>
            <ChessBoard
              state={gameState}
              selected={selected}
              legalDots={legalDots}
              lastMove={lastMove}
              onSquare={handleSquare}
              disabled={status==="over" || gameState.turn!=="w" || botThinking}
            />
            {/* White indicator */}
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-4 rounded-sm bg-white border border-[var(--border-subtle)]" />
              <span className="text-sm font-display font-semibold text-[var(--text-primary)]">You (whites)</span>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4 w-full lg:w-64 min-h-[400px] max-h-[500px]">
            {/* Controls */}
            <div className="flex gap-2">
              <button onClick={startGame}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
                <RotateCcw size={12}/> Play Again
              </button>
              {status==="playing" && (
                <button onClick={()=>{ setResult("You surrendered."); setStatus("over"); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-red-400 transition-colors">
                  <Flag size={12}/> Surrender
                </button>
              )}
            </div>

            {/* Result */}
            {status==="over" && result && (
              <div className="px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[var(--accent-orange)] font-display font-bold text-sm text-center">
                {result}
              </div>
            )}

            {/* Move list */}
            <div className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 flex-1 min-h-0">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight size={14} className="text-[var(--text-muted)]"/>
                <span className="text-xs font-display font-semibold text-[var(--text-secondary)]">Move History</span>
              </div>
              <MovePanel moves={moveList} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
