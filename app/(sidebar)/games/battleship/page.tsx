// app/(sidebar)/games/battleship/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Board, Ship, emptyBoard, randomPlacement } from "@/lib/battleship";
import { BotDifficulty, createBotMemory, getBotShot, updateBotMemory, BotMemory } from "@/lib/battleship-bot";
import { BattleshipPlacement, type ShipRot } from "@/components/BattleshipPlacement";
import Link from "next/link";
import { playSound, preloadSounds } from "@/lib/gameSounds";

const CELL = 40;
const LABEL_W = 40;

// ─── Компонент клетки ────────────────────────────────────────────────────────
// Cell renders water or miss only — hit marks are separate overlays above ship images
function Cell({
  state, onClick, onHover,
}: {
  state: string;
  onClick?: () => void;
  onHover?: () => void;
}) {
  const imgSrc = state === "miss" ? "/battleship/miss.png" : "/battleship/water.png";
  const bg = state === "miss" ? "#3b82f6" : "#1e3a5f";

  return (
    <div
      className="border border-blue-900/60 cursor-pointer select-none relative overflow-hidden flex-shrink-0"
      style={{ width: CELL, height: CELL, backgroundColor: bg }}
      onClick={onClick}
      onMouseEnter={onHover}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt="" draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
    </div>
  );
}

// ─── Компонент поля ──────────────────────────────────────────────────────────
function BattleBoard({
  board, onCellClick, onCellHover, interactive, label, ships, shipRotations, onlySunk,
}: {
  board: Board;
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  interactive?: boolean;
  label: string;
  ships?: Ship[];
  shipRotations?: ShipRot[];
  onlySunk?: boolean; // when true, only render overlays for sunk ships (enemy board)
}) {
  return (
    <div>
      <h3 className="text-center text-white font-semibold mb-2">{label}</h3>
      <div className="flex" style={{ marginLeft: LABEL_W }}>
        {"ABCDEFGHIJ".split("").map(l => (
          <div key={l} className="text-gray-400 text-xs text-center" style={{ width: CELL }}>{l}</div>
        ))}
      </div>
      <div style={{ position: "relative" }}>
        {board.map((row, r) => (
          <div key={r} className="flex">
            <div className="text-gray-400 text-xs flex items-center justify-end pr-1 flex-shrink-0"
              style={{ width: LABEL_W }}>{r + 1}</div>
            {row.map((cell, c) => (
              <Cell
                key={c} state={cell}
                onClick={interactive ? () => onCellClick?.(r, c) : undefined}
                onHover={interactive ? () => onCellHover?.(r, c) : undefined}
              />
            ))}
          </div>
        ))}

        {/* Оверлеи кораблей */}
        {ships?.map((ship, i) => {
          const rot    = shipRotations?.[i];
          const sorted = [...ship.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          const [sr, sc] = sorted[0];
          const isH   = rot ? rot.isH : (ship.size === 1 ? true : sorted[0][0] === sorted[1][0]);
          const flip  = rot?.flip ?? false;
          const isSunk = ship.cells.every(([r, c]) => board[r][c] === "sunk");
          if (onlySunk && !isSunk) return null;
          const suffix = isSunk ? "_broke" : "";
          const src = `/battleship/ships/ship_${ship.size}_${isH ? "left" : "top"}${suffix}.png`;
          const transform = !flip ? undefined : isH ? "scaleX(-1)" : "scaleY(-1)";
          return (
            <div key={i} style={{
              position: "absolute",
              left: LABEL_W + sc * CELL,
              top:  sr * CELL,
              width:  isH ? ship.size * CELL : CELL,
              height: isH ? CELL : ship.size * CELL,
              pointerEvents: "none",
              zIndex: isSunk ? 2 : 1,
              backgroundColor: "#374151",
              border: "1px solid #4b5563",
              borderRadius: 3,
              boxSizing: "border-box",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "fill", display: "block", transform }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          );
        })}

        {/* Hit marks — z:3, above ship and _broke overlays, transparent cross PNG */}
        {board.flatMap((row, r) =>
          row.map((cell, c) => {
            if (cell !== "hit" && cell !== "sunk") return null;
            return (
              <div
                key={`hm-${r}-${c}`}
                style={{
                  position: "absolute",
                  left: LABEL_W + c * CELL,
                  top: r * CELL,
                  width: CELL, height: CELL,
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/battleship/hit.png" alt="" draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Replay panel ────────────────────────────────────────────────────────────
type ShotEntry = { shooter: "player" | "bot"; row: number; col: number; hit: boolean; sunk: boolean };

function ReplayPanel({
  moves, replayIndex, onReplay,
}: {
  moves: ShotEntry[];
  replayIndex: number | null;
  onReplay: (idx: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replayIndex === null && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [moves.length, replayIndex]);

  const cols = "ABCDEFGHIJ";

  return (
    <div className="flex flex-col bg-[var(--bg-elevated,#1e293b)] border border-[var(--border-subtle,#334155)] rounded-xl p-3 w-full max-w-xs gap-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shot History</p>

      <div ref={ref} className="flex flex-col gap-px overflow-y-auto max-h-40">
        {moves.map((m, i) => {
          const label = `${cols[m.col]}${m.row + 1}`;
          const result = m.sunk ? "💥 sunk" : m.hit ? "🔴 hit" : "💧 miss";
          const isActive = replayIndex === i;
          return (
            <button key={i} onClick={() => onReplay(i)}
              className={["flex items-center gap-2 px-1.5 py-0.5 rounded text-left font-mono text-[0.65rem] transition-colors",
                isActive
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-gray-400 hover:text-white hover:bg-white/5",
              ].join(" ")}>
              <span className="w-5 shrink-0 text-right text-gray-500">{i + 1}.</span>
              <span className={m.shooter === "player" ? "text-cyan-400" : "text-orange-400"}>
                {m.shooter === "player" ? "You" : "Bot"}
              </span>
              <span>{label}</span>
              <span>{result}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5 pt-1 border-t border-gray-700">
        <button onClick={() => onReplay(0)} disabled={moves.length === 0 || replayIndex === 0}
          className="px-2 py-0.5 text-base leading-none text-gray-500 hover:text-white disabled:opacity-30 font-mono">«</button>
        <button onClick={() => onReplay(replayIndex !== null ? Math.max(0, replayIndex - 1) : moves.length - 1)}
          disabled={moves.length === 0 || replayIndex === 0}
          className="p-1 text-gray-500 hover:text-white disabled:opacity-30">
          <ChevronLeft size={14} />
        </button>
        <span className="flex-1 text-center text-[0.65rem] font-mono text-gray-500">
          {replayIndex !== null ? `${replayIndex + 1}/${moves.length}` : `${moves.length}/${moves.length}`}
        </span>
        <button onClick={() => onReplay(replayIndex !== null ? Math.min(moves.length - 1, replayIndex + 1) : null)}
          disabled={moves.length === 0 || replayIndex === moves.length - 1}
          className="p-1 text-gray-500 hover:text-white disabled:opacity-30">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onReplay(null)} disabled={replayIndex === null}
          className="px-2 py-0.5 text-base leading-none text-gray-500 hover:text-blue-400 disabled:opacity-30 font-mono" title="Live">»</button>
      </div>
    </div>
  );
}

// ─── Главный компонент ───────────────────────────────────────────────────────
type Phase = "setup" | "placement" | "battle" | "finished";

export default function BattleshipBotPage() {
  const t = useTranslations("battleship");

  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [phase, setPhase] = useState<Phase>("setup");

  const [playerBoard, setPlayerBoard] = useState<Board>(emptyBoard());
  const [playerShips, setPlayerShips] = useState<Ship[]>([]);
  const [shipRotations, setShipRotations] = useState<ShipRot[]>([]);
  const [botBoard, setBotBoard] = useState<Board>(emptyBoard());
  const [botVisibleBoard, setBotVisibleBoard] = useState<Board>(emptyBoard());
  const [botShips, setBotShips] = useState<Ship[]>([]);

  const [currentTurn, setCurrentTurn] = useState<"player" | "bot">("player");
  const [winner, setWinner] = useState<"player" | "bot" | null>(null);
  const [botMemory, setBotMemory] = useState<BotMemory>(createBotMemory());
  const [message, setMessage] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  const [moves, setMoves] = useState<Array<{
    shooter: "player" | "bot"; row: number; col: number; hit: boolean; sunk: boolean;
  }>>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  useEffect(() => { preloadSounds(); }, []);

  // ─── Setup → Placement ───────────────────────────────────────────────────
  function startGame() {
    const { board: bb, ships: bs } = randomPlacement();
    setBotBoard(bb);
    setBotShips(bs);
    setBotVisibleBoard(emptyBoard());
    setBotMemory(createBotMemory());
    setMoves([]);
    setReplayIndex(null);
    setWinner(null);
    setMessage("");
    setPhase("placement");
  }

  // ─── Placement → Battle ──────────────────────────────────────────────────
  function handlePlacementComplete(board: Board, ships: Ship[], rotations: ShipRot[]) {
    setPlayerBoard(board);
    setPlayerShips(ships);
    setShipRotations(rotations);
    setCurrentTurn("player");
    setPhase("battle");
    setMessage(t("battle.yourTurn"));
    playSound("match_start");
  }

  // ─── Выстрел игрока ───────────────────────────────────────────────────────
  function handlePlayerShot(row: number, col: number) {
    if (currentTurn !== "player" || isAnimating || replayIndex !== null) return;
    const cell = botVisibleBoard[row][col];
    if (cell === "hit" || cell === "miss" || cell === "sunk") return;

    const hit = botBoard[row][col] === "ship";

    const newBotBoard = botBoard.map(r => [...r]) as Board;
    const newBotShips = botShips.map(s => ({ ...s }));
    const newVisible = botVisibleBoard.map(r => [...r]) as Board;

    let sunk = false;
    if (hit) {
      newBotBoard[row][col] = "hit";
      newVisible[row][col] = "hit";
      const si = newBotShips.findIndex(s => s.cells.some(([r, c]) => r === row && c === col));
      if (si !== -1) {
        newBotShips[si].hits++;
        if (newBotShips[si].hits >= newBotShips[si].size) {
          sunk = true;
          for (const [r, c] of newBotShips[si].cells) {
            newBotBoard[r][c] = "sunk";
            newVisible[r][c] = "sunk";
          }
          for (const [r, c] of newBotShips[si].cells) {
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && newVisible[nr][nc] === "empty") {
                newBotBoard[nr][nc] = "miss";
                newVisible[nr][nc] = "miss";
              }
            }
          }
          setMessage(t("battle.sunk"));
        } else setMessage(t("battle.hit"));
      }
    } else {
      newBotBoard[row][col] = "miss";
      newVisible[row][col] = "miss";
      setMessage(t("battle.miss"));
    }

    if (sunk) playSound("bs_sunk");
    else if (hit) playSound("bs_explosion");
    else playSound("bs_splash");

    setBotBoard(newBotBoard);
    setBotShips(newBotShips);
    setBotVisibleBoard(newVisible);

    const newMoves = [...moves, { shooter: "player" as const, row, col, hit, sunk }];
    setMoves(newMoves);

    if (newBotShips.every(s => s.hits >= s.size)) {
      setWinner("player");
      setPhase("finished");
      playSound("bs_victory");
      return;
    }

    if (!hit) {
      setCurrentTurn("bot");
      setTimeout(() => botTurn(newMoves, botMemory, playerBoard, playerShips), 700);
    }
  }

  // ─── Ход бота ─────────────────────────────────────────────────────────────
  function botTurn(currentMoves: typeof moves, memory: BotMemory, currentBoard: Board, currentShips: Ship[]) {
    setIsAnimating(true);
    setMessage(t("bot.thinking"));

    setTimeout(() => {
      const { row, col, updatedMemory } = getBotShot(currentBoard, memory, difficulty);
      const hit = currentBoard[row][col] === "ship";

      const newPlayerBoard = currentBoard.map(r => [...r]) as Board;
      const newPlayerShips = currentShips.map(s => ({ ...s }));
      let sunk = false;

      if (hit) {
        newPlayerBoard[row][col] = "hit";
        const si = newPlayerShips.findIndex(s => s.cells.some(([r, c]) => r === row && c === col));
        if (si !== -1) {
          newPlayerShips[si].hits++;
          if (newPlayerShips[si].hits >= newPlayerShips[si].size) {
            sunk = true;
            for (const [r, c] of newPlayerShips[si].cells) newPlayerBoard[r][c] = "sunk";
          }
        }
        setMessage(t("battle.hit") + " (бот)");
      } else {
        newPlayerBoard[row][col] = "miss";
        setMessage(t("battle.miss") + " (бот)");
      }

      if (sunk) playSound("bs_sunk");
      else if (hit) playSound("bs_explosion");
      else playSound("bs_splash");

      setPlayerBoard(newPlayerBoard);
      setPlayerShips(newPlayerShips);

      const updatedMem = updateBotMemory(updatedMemory, { row, col, hit, sunk, gameOver: false }, difficulty);
      setBotMemory(updatedMem);

      const newMoves = [...currentMoves, { shooter: "bot" as const, row, col, hit, sunk }];
      setMoves(newMoves);

      if (newPlayerShips.every(s => s.hits >= s.size)) {
        setWinner("bot");
        setPhase("finished");
        playSound("bs_defeat");
      } else if (hit) {
        setIsAnimating(false);
        setTimeout(() => botTurn(newMoves, updatedMem, newPlayerBoard, newPlayerShips), 700);
      } else {
        setCurrentTurn("player");
        setMessage(t("battle.yourTurn"));
        setIsAnimating(false);
      }
    }, 600);
  }

  // ─── Реплей ───────────────────────────────────────────────────────────────
  function getStateAtMove(index: number) {
    const pb = emptyBoard();
    const bb = emptyBoard();
    for (const ship of playerShips) for (const [r, c] of ship.cells) pb[r][c] = "ship";
    for (const ship of botShips) for (const [r, c] of ship.cells) bb[r][c] = "ship";

    for (let i = 0; i <= index; i++) {
      const m = moves[i];
      if (!m) break;
      if (m.shooter === "player") bb[m.row][m.col] = m.hit ? (m.sunk ? "sunk" : "hit") : "miss";
      else pb[m.row][m.col] = m.hit ? (m.sunk ? "sunk" : "hit") : "miss";
    }
    return { playerBoard: pb, botBoard: bb };
  }

  const replayState = replayIndex !== null ? getStateAtMove(replayIndex) : null;
  const displayPlayerBoard = replayState?.playerBoard ?? playerBoard;
  const displayBotBoard = replayState ? replayState.botBoard : botVisibleBoard;

  // ─── UI ───────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <div className="flex gap-4">
          {(["easy", "medium", "hard"] as BotDifficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                difficulty === d ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {t(`bot.${d}`)}
            </button>
          ))}
        </div>
        <button
          onClick={startGame}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg"
        >
          {t("placement.ready")}
        </button>
      </div>
    );
  }

  if (phase === "placement") {
    return (
      <div className="flex flex-col items-center py-8 px-4 min-h-screen">
        <BattleshipPlacement
          onComplete={handlePlacementComplete}
          title={t("placement.title")}
          readyLabel={t("placement.ready")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Games</Link>
      </div>
      <h2 className="text-2xl font-bold text-white">{t("title")}</h2>

      <div className="text-lg font-semibold text-yellow-400">{message}</div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        <BattleBoard
          board={displayPlayerBoard}
          label={t("battle.yourBoard")}
          interactive={false}
          ships={playerShips}
          shipRotations={shipRotations}
        />
        <BattleBoard
          board={displayBotBoard}
          onCellClick={handlePlayerShot}
          label={t("battle.enemyBoard")}
          interactive={currentTurn === "player" && phase === "battle" && replayIndex === null}
          ships={botShips}
          onlySunk
        />
      </div>

      {moves.length > 0 && (
        <ReplayPanel
          moves={moves}
          replayIndex={replayIndex}
          onReplay={setReplayIndex}
        />
      )}

      {phase === "finished" && (
        <div className="text-center">
          <div className={`text-3xl font-bold ${winner === "player" ? "text-green-400" : "text-red-400"}`}>
            {winner === "player" ? t("result.victory") : t("result.defeat")}
          </div>
          <button
            onClick={() => setPhase("setup")}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg"
          >
            {t("UI.Again")}
          </button>
        </div>
      )}
    </div>
  );
}
