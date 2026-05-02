"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Puzzle, Upload, FileJson, Copy, Check, Download, Pencil, X } from "lucide-react";
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
                  <span style={{
                    fontSize: 24, lineHeight: 1,
                    color: piece.color === "w" ? "#fff" : "#1a1a1a",
                    textShadow: piece.color === "w"
                      ? "0 0 2px #000, 0 0 2px #000"
                      : "0 0 2px rgba(255,255,255,0.6)",
                  }}>
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
  rating: number;
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

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({
  puzzle,
  onClose,
  onSaved,
}: {
  puzzle: PuzzleRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(puzzle.title);
  const [fen, setFen] = useState(puzzle.fen);
  const [difficulty, setDifficulty] = useState<"mate1" | "mate2">(puzzle.difficulty as "mate1" | "mate2");
  const [rating, setRating] = useState(String(puzzle.rating ?? 1200));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fenValid = (() => { try { fromFEN(fen); return true; } catch { return false; } })();
  const ratingNum = parseInt(rating);
  const ratingValid = !isNaN(ratingNum) && ratingNum >= 800 && ratingNum <= 2200;

  async function save() {
    if (!title.trim() || !fenValid || !ratingValid) return;
    setSaving(true); setMsg(null);
    const res = await fetch("/api/admin/puzzles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puzzle.id, title: title.trim(), fen: fen.trim(), difficulty, rating: ratingNum }),
    });
    setSaving(false);
    if (res.ok) { setMsg({ ok: true, text: "Saved!" }); setTimeout(() => { onSaved(); onClose(); }, 600); }
    else { const d = await res.json(); setMsg({ ok: false, text: d.error ?? "Failed" }); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Edit Puzzle</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-violet-500/50" />

        {/* Difficulty */}
        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Difficulty</label>
        <div className="flex gap-2 mb-4">
          {(["mate1", "mate2"] as const).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={["flex-1 py-1.5 rounded-lg text-xs font-display font-bold border transition-all",
                difficulty === d ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"].join(" ")}>
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>

        {/* Rating */}
        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Rating (800–2200)
          {rating && <span className={`ml-2 text-[0.65rem] ${ratingValid ? "text-green-400" : "text-red-400"}`}>{ratingValid ? "✓" : "✗"}</span>}
        </label>
        <input type="number" value={rating} onChange={e => setRating(e.target.value)} min={800} max={2200}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-violet-500/50" />

        {/* FEN */}
        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          FEN position
          {fen && <span className={`ml-2 text-[0.65rem] ${fenValid ? "text-green-400" : "text-red-400"}`}>{fenValid ? "✓ Valid" : "✗ Invalid"}</span>}
        </label>
        <input value={fen} onChange={e => setFen(e.target.value)}
          className="w-full mb-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:border-violet-500/50" />

        {fenValid && <div className="mb-4 mt-2"><MiniBoard fen={fen} /></div>}

        {msg && (
          <div className={`flex items-center gap-2 text-sm mb-4 ${msg.ok ? "text-green-400" : "text-red-400"}`}>
            {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !title.trim() || !fenValid || !ratingValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<PuzzleRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* Edit modal */
  const [editPuzzle, setEditPuzzle] = useState<PuzzleRow | null>(null);

  /* Selection */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const allSelected = puzzles.length > 0 && selected.size === puzzles.length;

  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(puzzles.map(p => p.id)));
  }
  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} puzzle${selected.size > 1 ? "s" : ""}?`)) return;
    setDeleting(true);
    await fetch("/api/admin/puzzles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setSelected(new Set());
    setDeleting(false);
    load();
  }

  /* Create form */
  const [title, setTitle] = useState("");
  const [fen, setFen] = useState("");
  const [difficulty, setDifficulty] = useState<"mate1" | "mate2">("mate1");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* JSON import */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyPuzzle(p: PuzzleRow) {
    const data = {
      title: p.title, difficulty: p.difficulty, fen: p.fen,
      solution: (() => { try { return JSON.parse(p.solution); } catch { return [p.solution]; } })(),
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const AI_PROMPT = `Generate high-quality chess puzzles in JSON format. Return ONLY the JSON array.

Format:
[
  {
    "title": "descriptive human-like name",
    "difficulty": "mate1" | "mate2",
    "rating": number (800–2200),
    "fen": "valid FEN string",
    "solution": ["uci_move", ...]
  }
]

STRICT RULES:
- All positions must be LEGAL chess positions with White to move
- Positions must look like realistic game situations (no random placements)
- Material balance should be plausible (no absurd compositions)

TACTICAL THEMES (REQUIRED):
Each puzzle must include at least one:
- checkmate pattern (back rank, smothered, etc.)
- pin / fork / skewer
- discovered attack
- deflection / decoy
- sacrifice leading to forced mate

DIFFICULTY & RATING:
- rating must be between 800 and 2200
- Lower rating (800–1200): simple tactics, direct mate1, obvious ideas
- Mid rating (1200–1800): 1–2 key ideas, small combinations, mate2
- High rating (1800–2200): non-obvious sacrifices, quiet moves, deception

ONLY MOVE REQUIREMENT:
- The first move in the solution MUST be the ONLY winning move
- All alternative white moves must fail or not lead to forced mate

MATE RULES:
- "mate1": exactly 1 move → immediate checkmate
- "mate2": exactly 3 moves:
  ["white_move", "black_best_response", "white_checkmate"]

QUALITY REQUIREMENTS:
- Avoid trivial or artificial puzzles
- Prefer middlegame or realistic endgames
- Include sacrifices in some puzzles (especially rating >1400)
- The solution must be logical, not random checks

MOVE FORMAT:
- UCI only (e.g., "e2e4", "d1h5", "e7e8q")

VALIDATION:
- Ensure the solution leads to forced checkmate
- Ensure black has no better defense than listed
- Ensure "only move" condition is satisfied`;

  function exportJson() {
    const data = puzzles.map(({ title, difficulty, fen, solution }) => ({
      title, difficulty, fen,
      solution: (() => { try { return JSON.parse(solution); } catch { return [solution]; } })(),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "puzzles.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function copyJson() {
    const data = puzzles.map(({ title, difficulty, fen, solution }) => ({
      title, difficulty, fen,
      solution: (() => { try { return JSON.parse(solution); } catch { return [solution]; } })(),
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(AI_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/puzzles")
      .then((r) => r.json())
      .then((d) => { setPuzzles(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const fenValid = (() => { try { fromFEN(fen); return true; } catch { return false; } })();

  async function handleCreate() {
    if (!title.trim() || !fenValid) return;
    setCreating(true);
    setCreateMsg(null);
    const res = await fetch("/api/admin/puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), fen: fen.trim(), difficulty }),
    });
    setCreating(false);
    if (res.ok) {
      setCreateMsg({ ok: true, text: "Puzzle created!" });
      setTitle(""); setFen("");
      load();
    } else {
      const d = await res.json();
      setCreateMsg({ ok: false, text: d.error ?? "Failed" });
    }
  }

  async function handleImport() {
    let puzzles: unknown;
    try { puzzles = JSON.parse(jsonText); } catch {
      setImportMsg({ ok: false, text: "Invalid JSON" }); return;
    }
    if (!Array.isArray(puzzles) || puzzles.length === 0) {
      setImportMsg({ ok: false, text: "Expected a non-empty JSON array" }); return;
    }
    setImporting(true); setImportMsg(null);
    let ok = 0; let fail = 0; let firstError = "";
    for (const p of puzzles) {
      const res = await fetch("/api/admin/puzzles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (res.ok) {
        ok++;
      } else {
        fail++;
        if (!firstError) {
          try { const d = await res.json(); firstError = d.error ?? `HTTP ${res.status}`; }
          catch { firstError = `HTTP ${res.status}`; }
        }
      }
    }
    setImporting(false);
    setImportMsg({ ok: fail === 0, text: `Imported ${ok}${fail ? `, ${fail} failed${firstError ? `: ${firstError}` : ""}` : ""}` });
    if (ok > 0) { setJsonText(""); load(); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
    e.target.value = "";
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
      {editPuzzle && (
        <EditModal puzzle={editPuzzle} onClose={() => setEditPuzzle(null)} onSaved={load} />
      )}
      <div className="flex items-center gap-2 mb-1">
        <Puzzle size={20} className="text-violet-400" />
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">
          Chess Puzzles
        </h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">Create and manage chess puzzles (mate in 1 or 2)</p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
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
          <p className="text-[0.65rem] text-[var(--text-muted)] mb-2">
            Copy FEN from <span className="text-violet-400">lichess.org/editor</span> or any chess tool
          </p>

          {/* FEN legend */}
          <div className="mb-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 flex flex-col gap-2">
            <p className="text-[0.6rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">FEN format</p>
            <code className="text-[0.6rem] font-mono text-violet-300 break-all">
              rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR&nbsp;<span className="text-amber-300">w</span>&nbsp;<span className="text-green-300">KQkq</span>&nbsp;<span className="text-sky-300">-</span>&nbsp;<span className="text-rose-300">0 1</span>
            </code>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <p className="text-[0.6rem] font-display font-semibold text-[var(--text-muted)] mb-0.5">Pieces (uppercase = white)</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {[["K","King"],["Q","Queen"],["R","Rook"],["B","Bishop"],["N","Knight"],["P","Pawn"]].map(([s,n]) => (
                    <span key={s} className="text-[0.6rem] font-mono"><span className="text-violet-300">{s}</span><span className="text-[var(--text-muted)]">={n}</span></span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-y-0.5">
                <span className="text-[0.6rem] font-mono"><span className="text-violet-300">1–8</span><span className="text-[var(--text-muted)]"> = empty squares in a row</span></span>
                <span className="text-[0.6rem] font-mono"><span className="text-violet-300">/</span><span className="text-[var(--text-muted)]"> = next rank (8→1)</span></span>
                <span className="text-[0.6rem] font-mono"><span className="text-amber-300">w/b</span><span className="text-[var(--text-muted)]"> = who moves</span></span>
                <span className="text-[0.6rem] font-mono"><span className="text-green-300">KQkq</span><span className="text-[var(--text-muted)]"> = castling rights</span></span>
                <span className="text-[0.6rem] font-mono"><span className="text-sky-300">-/e3</span><span className="text-[var(--text-muted)]"> = en passant square</span></span>
                <span className="text-[0.6rem] font-mono"><span className="text-rose-300">0 1</span><span className="text-[var(--text-muted)]"> = half/full move clock</span></span>
              </div>
            </div>
          </div>

          {/* Board preview */}
          {fenValid && fen && (
            <div className="mb-4 flex flex-col items-start gap-2">
              <p className="text-xs font-display font-semibold text-[var(--text-muted)]">Board preview</p>
              <MiniBoard fen={fen} />
            </div>
          )}

          <p className="text-[0.7rem] text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 mb-4">
            ✓ No solution needed — the engine validates moves dynamically at play time.
          </p>
          {/* Feedback */}
          {createMsg && (
            <div className={`flex items-center gap-2 text-sm mb-4 ${createMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {createMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {createMsg.text}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !title.trim() || !fenValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Puzzle
          </button>
        </div>

        {/* ── JSON import ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <FileJson size={16} className="text-violet-400" />
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Import from JSON</h2>
          </div>
          <p className="text-[0.65rem] text-[var(--text-muted)] mb-4">
            Paste a JSON array or upload a file. Ask AI to generate it with the format below.
          </p>

          {/* Format hint */}
          <pre className="text-[0.6rem] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 mb-4 overflow-x-auto text-[var(--text-muted)] leading-relaxed">{`[
  {
    "title": "Back-rank Mate",
    "difficulty": "mate1",
    "rating": 950,
    "fen": "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    "solution": ["a1a8"]
  },
  {
    "title": "Queen Sacrifice",
    "difficulty": "mate2",
    "rating": 1650,
    "fen": "...",
    "solution": ["d1h5", "g8h8", "h5f7"]
  }
]`}</pre>

          {/* Copy AI prompt */}
          <button
            onClick={copyPrompt}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-display font-semibold hover:bg-violet-500/25 transition-colors mb-3 self-start"
          >
            {promptCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {promptCopied ? "Copied!" : "Copy AI prompt"}
          </button>

          {/* File upload */}
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors mb-3 self-start"
          >
            <Upload size={12} /> Upload .json file
          </button>

          {/* Textarea */}
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Or paste JSON here..."
            rows={8}
            className="w-full flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 resize-none mb-4"
          />

          {importMsg && (
            <div className={`flex items-center gap-2 text-sm mb-4 ${importMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {importMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {importMsg.text}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || !jsonText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity self-start"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Import Puzzles
          </button>
        </div>

        {/* ── Puzzle list ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2">
              <Puzzle size={15} className="text-violet-400" />
              <h2 className="font-display font-bold text-sm text-[var(--text-primary)]">
                All Puzzles
                <span className="ml-1.5 text-[0.65rem] font-normal text-[var(--text-muted)]">({puzzles.length})</span>
              </h2>
            </div>
            {puzzles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.65rem] font-display font-semibold hover:text-[var(--text-primary)] transition-colors"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[0.65rem] font-display font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Delete {selected.size}
                  </button>
                )}
                <button
                  onClick={copyJson}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.65rem] font-display font-semibold hover:text-[var(--text-primary)] transition-colors"
                >
                  {exportCopied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  {exportCopied ? "Copied!" : "Copy JSON"}
                </button>
                <button
                  onClick={exportJson}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.65rem] font-display font-semibold hover:text-[var(--text-primary)] transition-colors"
                >
                  <Download size={11} /> Download
                </button>
              </div>
            )}
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" />
              </div>
            ) : puzzles.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-10">No puzzles yet.</p>
            ) : puzzles.map((p) => {
              let solArr: string[] = [];
              try { solArr = JSON.parse(p.solution); } catch { /**/ }
              return (
                <div
                  key={p.id}
                  className={`border rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors ${selected.has(p.id) ? "bg-violet-500/10 border-violet-500/30" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)]"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="shrink-0 w-3.5 h-3.5 accent-violet-500 cursor-pointer"
                  />
                  <div className="shrink-0 scale-[0.35] origin-left" style={{ width: 320, height: 320, marginRight: -208 }}>
                    <MiniBoard fen={p.fen} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-[var(--text-primary)] text-xs truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full border ${DIFF_COLOR[p.difficulty]}`}>
                        {DIFF_LABEL[p.difficulty]}
                      </span>
                      <span className="text-[0.6rem] font-mono text-amber-400">★ {p.rating}</span>
                      <span className="text-[0.6rem] text-[var(--text-muted)]">{p.solveCount} solves</span>
                    </div>
                    <p className="text-[0.6rem] font-mono text-[var(--text-muted)] mt-1 truncate">
                      {solArr.join(" → ")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => setEditPuzzle(p)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => copyPuzzle(p)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                      title="Copy JSON"
                    >
                      {copiedId === p.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
