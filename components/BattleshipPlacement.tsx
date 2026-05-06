"use client";

import { useState, useRef, useEffect } from "react";
import { RotateCcw, Shuffle, X } from "lucide-react";
import {
  Board, Ship, SHIP_SIZES, canPlaceShip, placeShip,
  randomPlacement, emptyBoard, Orientation,
} from "@/lib/battleship";

// 4-step rotation: 0=left, 1=top, 2=left-flipped, 3=top-flipped
export type RotStep = 0 | 1 | 2 | 3;
export type ShipRot = { isH: boolean; flip: boolean };

const FLEET = SHIP_SIZES.map((size, id) => ({ id, size }));
const ROT_LABELS: Record<RotStep, string> = {
  0: "← Horizontal",
  1: "↑ Vertical",
  2: "→ Horizontal",
  3: "↓ Vertical",
};
const THUMB = 30;

interface PlacedEntry {
  ship: Ship;
  fleetId: number;
  rot: ShipRot;
}

interface Props {
  onComplete: (board: Board, ships: Ship[], rotations: ShipRot[]) => void;
  title?: string;
  readyLabel?: string;
}

// CSS transform for a ship image given orientation + flip
function shipTransform(isH: boolean, flip: boolean): string | undefined {
  if (!flip) return undefined;
  return isH ? "scaleX(-1)" : "scaleY(-1)";
}

export function BattleshipPlacement({
  onComplete,
  title = "Place Your Ships",
  readyLabel = "Ready!",
}: Props) {
  const [board, setBoard]         = useState<Board>(emptyBoard());
  const [placed, setPlaced]       = useState<PlacedEntry[]>([]);
  const [remaining, setRemaining] = useState(() => [...FLEET]);
  const [selId, setSelId]         = useState<number | null>(null);
  const [rotStep, setRotStep]     = useState<RotStep>(0);
  const [hover, setHover]         = useState<{ r: number; c: number } | null>(null);
  const [cellPx, setCellPx]       = useState(36);
  const [labelW, setLabelW]       = useState(28);

  const gridRef  = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const isH    = rotStep === 0 || rotStep === 2;
  const flip   = rotStep === 2 || rotStep === 3;
  const orient: Orientation = isH ? "horizontal" : "vertical";

  const selShip    = remaining.find(s => s.id === selId) ?? null;
  const previewValid = selShip && hover
    ? canPlaceShip(board, hover.r, hover.c, selShip.size, orient)
    : null;

  // Measure actual cell px on resize
  useEffect(() => {
    const measure = () => {
      const cell = gridRef.current?.querySelector("[data-cell]") as HTMLElement | null;
      const lbl  = labelRef.current;
      if (cell) setCellPx(cell.offsetWidth);
      if (lbl)  setLabelW(lbl.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  // R key cycles through 4 rotations (e.code is layout-independent)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR")
        setRotStep(s => ((s + 1) % 4) as RotStep);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  function handleCellClick(r: number, c: number) {
    if (selShip) {
      // Place selected ship
      const result = placeShip(board, placed.map(e => e.ship), r, c, selShip.size, orient);
      if (!result) return;
      const newShip = result.ships[result.ships.length - 1];
      setBoard(result.board);
      setPlaced(prev => [...prev, { ship: newShip, fleetId: selId!, rot: { isH, flip } }]);
      setRemaining(prev => prev.filter(s => s.id !== selId));
      setSelId(null);
      setHover(null);
    } else {
      // Click placed ship to move it back to inventory
      if (board[r][c] !== "ship") return;
      const idx = placed.findIndex(e => e.ship.cells.some(([sr, sc]) => sr === r && sc === c));
      if (idx === -1) return;
      const entry = placed[idx];
      const newBoard = board.map(row => [...row]) as Board;
      for (const [sr, sc] of entry.ship.cells) newBoard[sr][sc] = "empty";
      setBoard(newBoard);
      setPlaced(prev => prev.filter((_, i) => i !== idx));
      setRemaining(prev => {
        const item = FLEET.find(f => f.id === entry.fleetId)!;
        return [...prev, item].sort((a, b) => a.id - b.id);
      });
      setSelId(entry.fleetId);
      setHover(null);
    }
  }

  function handleRandom() {
    const { board: b, ships: s } = randomPlacement();
    setBoard(b);
    setPlaced(s.map((ship, i) => ({
      ship,
      fleetId: i,
      rot: {
        isH: ship.size === 1 ? true : ship.cells[0][0] === ship.cells[1][0],
        flip: false,
      },
    })));
    setRemaining([]);
    setSelId(null);
    setHover(null);
  }

  function handleReset() {
    setBoard(emptyBoard());
    setPlaced([]);
    setRemaining([...FLEET]);
    setSelId(null);
    setHover(null);
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-lg mx-auto px-2">

      <style>{`
        @keyframes bs-blink {
          0%,100% { box-shadow: 0 0 0 2px #ef4444; }
          50%      { box-shadow: 0 0 10px 3px rgba(239,68,68,.65); }
        }
        .bs-blink { animation: bs-blink .55s ease-in-out infinite; }
      `}</style>

      <h2 className="text-base sm:text-lg font-display font-bold text-[var(--text-primary)]">
        {title}
      </h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setRotStep(s => ((s + 1) % 4) as RotStep)}
          title="Press R to rotate"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RotateCcw size={11} />
          {ROT_LABELS[rotStep]}
          <span className="text-[0.58rem] text-[var(--text-muted)] font-mono opacity-60">[R]</span>
        </button>
        <button
          onClick={handleRandom}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Shuffle size={11} /> Random
        </button>
        {placed.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {/* Ship inventory */}
      <div className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3">
        <p className="text-[0.6rem] text-[var(--text-muted)] mb-2.5 text-center uppercase tracking-widest">
          Fleet — select a ship to place
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {FLEET.map(({ id, size }) => {
            const isPlaced   = !remaining.some(s => s.id === id);
            const isSelected = selId === id;
            return (
              <div
                key={id}
                title={`Size ${size}`}
                onClick={() => !isPlaced && setSelId(isSelected ? null : id)}
                className={[
                  "relative rounded overflow-hidden transition-all duration-150 select-none",
                  isPlaced   ? "opacity-20 cursor-default grayscale" : "cursor-pointer",
                  isSelected ? "ring-2 ring-orange-400 scale-110 shadow-lg shadow-orange-500/25"
                             : !isPlaced ? "hover:ring-1 hover:ring-orange-400/40 hover:scale-105" : "",
                ].join(" ")}
                style={{ width: size * THUMB, height: THUMB, backgroundColor: "#374151", flexShrink: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/battleship/ships/ship_${size}_left.png`}
                  alt={`ship ${size}`} draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Status line */}
      <p className="text-xs text-center min-h-[1.25rem]">
        {selShip ? (
          <span className="text-orange-400 font-semibold">
            Placing size {selShip.size} — {ROT_LABELS[rotStep]}
          </span>
        ) : remaining.length > 0 ? (
          <span className="text-[var(--text-muted)]">
            Select a ship above{placed.length > 0 ? " · tap placed ships to move" : ""}
          </span>
        ) : (
          <span className="text-green-400 font-semibold">All ships placed!</span>
        )}
      </p>

      {/* Board */}
      <div onMouseLeave={() => setHover(null)}>
        {/* Column labels */}
        <div className="flex" style={{ marginLeft: labelW }}>
          {"ABCDEFGHIJ".split("").map(l => (
            <div
              key={l}
              className="text-[var(--text-muted)] text-[0.55rem] text-center flex-shrink-0"
              style={{ width: cellPx }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div ref={gridRef} style={{ position: "relative" }}>
          {Array.from({ length: 10 }, (_, r) => (
            <div key={r} className="flex">
              <div
                ref={r === 0 ? labelRef : undefined}
                className="text-[var(--text-muted)] text-[0.55rem] flex items-center justify-end pr-1 flex-shrink-0 w-5 sm:w-6 md:w-7"
              >
                {r + 1}
              </div>
              {Array.from({ length: 10 }, (_, c) => (
                <div
                  key={c}
                  data-cell
                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 border border-blue-900/50 relative overflow-hidden select-none flex-shrink-0 cursor-pointer"
                  style={{ backgroundColor: "#1e3a5f" }}
                  onClick={() => handleCellClick(r, c)}
                  onMouseEnter={() => setHover({ r, c })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/battleship/water.png" alt="" draggable={false}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Placed ship overlays */}
          {placed.map((entry, i) => {
            const { ship, rot } = entry;
            const sorted = [...ship.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const [sr, sc] = sorted[0];
            const imgSrc = `/battleship/ships/ship_${ship.size}_${rot.isH ? "left" : "top"}.png`;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: labelW + sc * cellPx,
                  top:  sr * cellPx,
                  width:  rot.isH ? ship.size * cellPx : cellPx,
                  height: rot.isH ? cellPx : ship.size * cellPx,
                  pointerEvents: "none",
                  zIndex: 1,
                  backgroundColor: "#374151",
                  border: "1px solid #4b5563",
                  borderRadius: 3,
                  boxSizing: "border-box",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc} alt="" draggable={false}
                  style={{
                    width: "100%", height: "100%", objectFit: "fill", display: "block",
                    transform: shipTransform(rot.isH, rot.flip),
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            );
          })}

          {/* Preview overlay */}
          {selShip && hover && (() => {
            const sz    = selShip.size;
            const valid = previewValid;
            const imgSrc = `/battleship/ships/ship_${sz}_${isH ? "left" : "top"}.png`;
            return (
              <div
                style={{
                  position: "absolute",
                  left: labelW + hover.c * cellPx,
                  top:  hover.r * cellPx,
                  width:  isH ? sz * cellPx : cellPx,
                  height: isH ? cellPx : sz * cellPx,
                  pointerEvents: "none",
                  zIndex: 10,
                  backgroundColor: "#374151",
                  border: `2px solid ${valid ? "#22c55e" : "#ef4444"}`,
                  borderRadius: 3,
                  boxSizing: "border-box",
                  opacity: 0.88,
                }}
                className={!valid ? "bs-blink" : ""}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc} alt="" draggable={false}
                  style={{
                    width: "100%", height: "100%", objectFit: "fill", display: "block",
                    transform: shipTransform(isH, flip),
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Ready button */}
      {remaining.length === 0 && (
        <button
          onClick={() => onComplete(board, placed.map(e => e.ship), placed.map(e => e.rot))}
          className="mt-1 px-8 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-display font-bold text-sm sm:text-base transition-colors"
        >
          {readyLabel}
        </button>
      )}
    </div>
  );
}
