"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Puzzle } from "lucide-react";
import { fromFEN, type GameState } from "@/lib/chess";

// ── Tiny static board preview ─────────────────────────────────────────────────
const PIECE_UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

function MiniBoard({ fen }: { fen: string }) {
  let state: GameState | null = null;
  try { state = fromFEN(fen); } catch { /* invalid FEN */ }

  if (!state) return (
    <div className="w-full aspect-square bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-center">
      <p className="text-[var(--text-muted)] text-xs text-center px-2">Invalid FEN</p>
    </div>
  );

  const CELL = 40;
  const ranks = [7, 6, 5, 4, 3, 2, 1, 0];
  const files = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div style={{ display: "inline-block", border: "2px solid rgba(139,92,246,0.3)", borderRadius: 6, overflow: "hidden" }}>
      {ranks.map((r) => (
        <div key={r} style={{ display: "flex" }}>
          {files.map((c) => {
            const piece = state!.board[r][c];
            const light = (r + c) % 2 === 0;
            return (
              <div
                key={c}
                style={{
                  width: CELL, height: CELL,
                  background: light ? "#f0d9b5" : "#b58863",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {piece && (
                  <span style={{ fontSize: 24, lineHeight: 1, filter: piece.color === "w" ? "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" : undefined }}>
                    {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PuzzleRow = {
  id: string;
  title: string;
  difficulty: string;
  solveCount: number;
  createdAt: string;
  fen: string;
  solution: string;
};

const DIFF_LABEL: Record<string, string> = { mate1: "Mate in 1", mate2: "Mate in 2" };
const DIFF_COLOR: Record<string, string> = {
  mate1: "text-green-400 bg-green-500/10 border-green-500/20",
  mate2: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

// ── UCI helpers ───────────────────────────────────────────────────────────────
function parseMovesInput(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean).map((m) => m.toLowerCase());
}

function isValidUCI(m: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<PuzzleRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* Create form */
  const [title, setTitle] = useState("");
  const [fen, setFen] = useState("");
  const [movesRaw, setMovesRaw] = useState("");
  const [difficulty, setDifficulty] = useState<"mate1" | "mate2">("mate1");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/puzzles")
      .then((r) => r.json())
      .then((d) => { setPuzzles(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const parsedMoves = parseMovesInput(movesRaw);
  const movesValid = parsedMoves.length > 0 && parsedMoves.every(isValidUCI);
  const fenValid = (() => { try { fromFEN(fen); return true; } catch { return false; } })();

  async function handleCreate() {
    if (!title.trim() || !fenValid || !movesValid) return;
    setCreating(true);
    setCreateMsg(null);
    const res = await fetch("/api/admin/puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), fen: fen.trim(), solution: parsedMoves, difficulty }),
    });
    setCreating(false);
    if (res.ok) {
      setCreateMsg({ ok: true, text: "Puzzle created!" });
      setTitle(""); setFen(""); setMovesRaw("");
      load();
    } else {
      const d = await res.json();
      setCreateMsg({ ok: false, text: d.error ?? "Failed" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this puzzle?")) return;
    await fetch("/api/admin/puzzles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Puzzle size={20} className="text-violet-400" />
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">
          Chess Puzzles
        </h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">Create and manage chess puzzles (mate in 1 or 2)</p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* ── Create form ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-5">Create Puzzle</h2>

          {/* Title */}
          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Classic Back-rank Mate"
            className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50"
          />

          {/* Difficulty */}
          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Difficulty</label>
          <div className="flex gap-2 mb-4">
            {(["mate1", "mate2"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={[
                  "flex-1 py-1.5 rounded-lg text-xs font-display font-bold border transition-all",
                  difficulty === d
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                ].join(" ")}
              >
                {DIFF_LABEL[d]}
              </button>
            ))}
          </div>

          {/* FEN */}
          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            FEN position
            {fen && (
              <span className={`ml-2 text-[0.65rem] ${fenValid ? "text-green-400" : "text-red-400"}`}>
                {fenValid ? "✓ Valid" : "✗ Invalid"}
              </span>
            )}
          </label>
          <input
            value={fen}
            onChange={(e) => setFen(e.target.value)}
            placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            className="w-full mb-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50"
          />
          <p className="text-[0.65rem] text-[var(--text-muted)] mb-3">
            Copy FEN from Lichess editor or any chess tool
          </p>

          {/* Board preview */}
          {fenValid && fen && (
            <div className="mb-4 flex flex-col items-start gap-2">
              <p className="text-xs font-display font-semibold text-[var(--text-muted)]">Board preview</p>
              <MiniBoard fen={fen} />
            </div>
          )}

          {/* Solution moves */}
          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Solution moves (UCI, space-separated)
            {movesRaw && (
              <span className={`ml-2 text-[0.65rem] ${movesValid ? "text-green-400" : "text-red-400"}`}>
                {movesValid ? `✓ ${parsedMoves.length} move${parsedMoves.length !== 1 ? "s" : ""}` : "✗ Invalid"}
              </span>
            )}
          </label>
          <input
            value={movesRaw}
            onChange={(e) => setMovesRaw(e.target.value)}
            placeholder={difficulty === "mate1" ? "e.g.  d1h5" : "e.g.  d1h5 g8h8 h5f7"}
            className="w-full mb-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50"
          />
          <p className="text-[0.65rem] text-[var(--text-muted)] mb-4">
            {difficulty === "mate1"
              ? "Mate in 1 → 1 move (player)"
              : "Mate in 2 → 3 moves: player · opponent · player"}
          </p>

          {/* Moves list */}
          {parsedMoves.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {parsedMoves.map((m, i) => {
                const isPlayer = i % 2 === 0;
                const valid = isValidUCI(m);
                return (
                  <span
                    key={i}
                    className={[
                      "px-2 py-0.5 rounded text-xs font-mono font-bold border",
                      !valid ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : isPlayer ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                        : "bg-slate-500/15 border-slate-500/30 text-slate-400",
                    ].join(" ")}
                  >
                    {i + 1}. {m} {isPlayer ? "(you)" : "(opp)"}
                  </span>
                );
              })}
            </div>
          )}

          {/* Feedback */}
          {createMsg && (
            <div className={`flex items-center gap-2 text-sm mb-4 ${createMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {createMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {createMsg.text}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !title.trim() || !fenValid || !movesValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Puzzle
          </button>
        </div>

        {/* ── Puzzle list ── */}
        <div>
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-4">
            All Puzzles ({puzzles.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : puzzles.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-10">No puzzles yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {puzzles.map((p) => {
                let solArr: string[] = [];
                try { solArr = JSON.parse(p.solution); } catch { /**/ }
                return (
                  <div
                    key={p.id}
                    className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    {/* Mini board thumbnail */}
                    <div className="shrink-0 scale-[0.35] origin-left" style={{ width: 320, height: 320, marginRight: -208 }}>
                      <MiniBoard fen={p.fen} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-[var(--text-primary)] text-sm truncate">
                        {p.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full border ${DIFF_COLOR[p.difficulty]}`}>
                          {DIFF_LABEL[p.difficulty]}
                        </span>
                        <span className="text-[0.65rem] text-[var(--text-muted)]">
                          {p.solveCount} solves
                        </span>
                      </div>
                      {/* Solution preview */}
                      <p className="text-[0.6rem] font-mono text-[var(--text-muted)] mt-1 truncate">
                        {solArr.join(" → ")}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
