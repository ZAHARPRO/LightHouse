"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Puzzle, Upload,
  FileJson, Copy, Check, Download, Pencil, X, BarChart3, RefreshCw,
  Database, Globe, Zap, Tag,
} from "lucide-react";
import { fromFEN, type GameState } from "@/lib/chess";
import { LICHESS_THEMES } from "@/lib/lichess-puzzle";

// ── Mini board ────────────────────────────────────────────────────────────────
const PIECE_UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

function MiniBoard({ fen }: { fen: string }) {
  let state: GameState | null = null;
  try { state = fromFEN(fen); } catch { /* invalid */ }

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
              <div key={c} style={{ width: CELL, height: CELL, background: light ? "#f0d9b5" : "#b58863", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {piece && (
                  <span style={{ fontSize: 24, lineHeight: 1, color: piece.color === "w" ? "#fff" : "#1a1a1a", textShadow: piece.color === "w" ? "0 0 2px #000, 0 0 2px #000" : "0 0 2px rgba(255,255,255,0.6)" }}>
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
  id: string; title: string; difficulty: string; rating: number;
  solveCount: number; createdAt: string; fen: string; solution?: string | null;
  themes?: string[]; source?: string;
};

type Stats = {
  total: number; lichessCount: number; manualCount: number;
  solveCount: number; avgRating: number; totalSolveCount: number;
  topThemes: { theme: string; count: number }[];
  diffCounts: Record<string, number>;
};

const DIFF_LABEL: Record<string, string> = {
  mate1: "Mate in 1", mate2: "Mate in 2", tactical: "Tactical",
  endgame: "Endgame", opening: "Opening",
};
const DIFF_COLOR: Record<string, string> = {
  mate1: "text-green-400 bg-green-500/10 border-green-500/20",
  mate2: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  tactical: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  endgame: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  opening: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

type CronConfig = { count: number; intervalDays: number; lastRunAt: string | null };

// ── Stats Panel ───────────────────────────────────────────────────────────────
function StatsPanel({ stats, onRefreshCron }: { stats: Stats; onRefreshCron: () => void }) {
  const [running, setRunning]         = useState(false);
  const [cronMsg, setCronMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [cfg, setCfg]                 = useState<CronConfig | null>(null);
  const [editCount, setEditCount]     = useState("");
  const [editInterval, setEditInterval] = useState("");
  const [savingCfg, setSavingCfg]     = useState(false);
  const [cfgMsg, setCfgMsg]           = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/puzzles/cron-config")
      .then(r => r.json())
      .then((d: CronConfig) => { setCfg(d); setEditCount(String(d.count)); setEditInterval(String(d.intervalDays)); })
      .catch(() => {});
  }, []);

  async function saveCfg() {
    setSavingCfg(true); setCfgMsg(null);
    const count = parseInt(editCount);
    const intervalDays = parseInt(editInterval);
    if (isNaN(count) || count < 1 || isNaN(intervalDays) || intervalDays < 1) {
      setCfgMsg("Invalid values"); setSavingCfg(false); return;
    }
    const res = await fetch("/api/admin/puzzles/cron-config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, intervalDays }),
    });
    const d: CronConfig = await res.json();
    setSavingCfg(false);
    if (res.ok) { setCfg(d); setCfgMsg("Saved!"); setTimeout(() => setCfgMsg(null), 2000); }
    else setCfgMsg("Failed to save");
  }

  async function runCron() {
    setRunning(true); setCronMsg(null);
    try {
      const res = await fetch("/api/cron/puzzles-refresh?force=1");
      const d = await res.json();
      if (d.skipped) {
        setCronMsg({ ok: false, text: d.reason ?? "Skipped (interval not reached)" });
      } else {
        const errText = d.errors?.length ? ` — ${d.errors[0]}` : "";
        setCronMsg({
          ok: d.ok,
          text: d.ok
            ? `Added ${d.added} puzzle${d.added !== 1 ? "s" : ""} (${d.mode ?? "daily"})`
            : `Failed${errText}`,
        });
        if (d.ok) onRefreshCron();
      }
    } catch {
      setCronMsg({ ok: false, text: "Request failed" });
    }
    setRunning(false);
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 size={16} className="text-violet-400" />
        <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Dashboard</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: "Total puzzles", value: stats.total, icon: <Puzzle size={14} /> },
          { label: "From Lichess", value: stats.lichessCount, icon: <Globe size={14} /> },
          { label: "Total solves", value: stats.totalSolveCount, icon: <Zap size={14} /> },
          { label: "Avg rating", value: stats.avgRating, icon: <BarChart3 size={14} /> },
        ].map(k => (
          <div key={k.label} className="bg-[var(--bg-elevated)] rounded-xl p-3 border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[0.6rem] font-display font-semibold uppercase tracking-wider mb-1">
              {k.icon} {k.label}
            </div>
            <p className="font-display font-extrabold text-xl text-[var(--text-primary)]">{k.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Difficulty breakdown */}
      {Object.keys(stats.diffCounts).length > 0 && (
        <div className="mb-5">
          <p className="text-[0.6rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">By difficulty</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.diffCounts).sort((a,b) => b[1]-a[1]).map(([diff, cnt]) => (
              <span key={diff} className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full border ${DIFF_COLOR[diff] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                {DIFF_LABEL[diff] ?? diff} {cnt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top themes */}
      {stats.topThemes.length > 0 && (
        <div className="mb-5">
          <p className="text-[0.6rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Top themes</p>
          <div className="flex flex-col gap-1">
            {stats.topThemes.map(({ theme, count }) => (
              <div key={theme} className="flex items-center gap-2">
                <Tag size={10} className="text-violet-400 shrink-0" />
                <span className="text-[0.65rem] text-[var(--text-secondary)] flex-1">{theme}</span>
                <span className="text-[0.6rem] font-mono text-[var(--text-muted)]">{count}</span>
                <div className="w-16 h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${Math.round((count / stats.total) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly cron */}
      <div className="border-t border-[var(--border-subtle)] pt-4">
        <p className="text-[0.6rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Auto-refresh settings</p>

        {/* Config inputs */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[0.6rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Puzzles / run
            </label>
            <input
              type="number" min={1} max={50} value={editCount}
              onChange={e => setEditCount(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-[0.6rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Every N days
            </label>
            <input
              type="number" min={1} max={365} value={editInterval}
              onChange={e => setEditInterval(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={saveCfg}
            disabled={savingCfg}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-display font-semibold hover:bg-violet-500/25 disabled:opacity-50 transition-colors"
          >
            {savingCfg ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Save settings
          </button>
          {cfgMsg && (
            <span className={`text-[0.65rem] font-semibold ${cfgMsg === "Saved!" ? "text-green-400" : "text-red-400"}`}>
              {cfgMsg}
            </span>
          )}
        </div>

        {cfg?.lastRunAt && (
          <p className="text-[0.6rem] text-[var(--text-muted)] mb-3">
            Last run: <span className="text-[var(--text-secondary)]">{new Date(cfg.lastRunAt).toLocaleString()}</span>
          </p>
        )}

        {/* Multi-puzzle notice */}
        {parseInt(editCount) > 1 && (
          <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2">
            <p className="text-[0.6rem] text-emerald-300/90 leading-relaxed">
              Fetches one puzzle per theme angle (fork, pin, sacrifice…).
              Max <span className="font-bold">47 unique puzzles</span> per run — no API key required.
            </p>
          </div>
        )}

        {/* Step-by-step flow */}
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "1", color: "text-violet-400 bg-violet-500/10 border-violet-500/20", label: "Cron runs daily 09:00 UTC", desc: `Checks if ${editInterval || "N"} day(s) have passed since last run` },
            { step: "2", color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
              label: parseInt(editCount) > 1 ? `Fetch ${editCount} puzzles by theme` : "Fetch Lichess daily puzzle",
              desc: parseInt(editCount) > 1 ? `/api/puzzle/next?angle={theme} × ${editCount} — no auth needed` : "/api/puzzle/daily — no auth needed" },
            { step: "3", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Upsert to database", desc: "Skip if puzzle already exists (lichessId unique)" },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-2">
              <span className={`shrink-0 w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center border ${s.color}`}>{s.step}</span>
              <div>
                <p className="text-[0.65rem] font-display font-semibold text-[var(--text-secondary)] leading-tight">{s.label}</p>
                <p className="text-[0.6rem] text-[var(--text-muted)]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={runCron}
          disabled={running}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Run now (ignore interval)
        </button>
        {cronMsg && (
          <div className={`flex items-center gap-1.5 text-xs mt-2 ${cronMsg.ok ? "text-green-400" : "text-red-400"}`}>
            {cronMsg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {cronMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ puzzle, onClose, onSaved }: { puzzle: PuzzleRow; onClose: () => void; onSaved: () => void }) {
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
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puzzle.id, title: title.trim(), fen: fen.trim(), difficulty, rating: ratingNum }),
    });
    setSaving(false);
    if (res.ok) { setMsg({ ok: true, text: "Saved!" }); setTimeout(() => { onSaved(); onClose(); }, 600); }
    else { const d = await res.json(); setMsg({ ok: false, text: d.error ?? "Failed" }); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Edit Puzzle</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"><X size={16} /></button>
        </div>

        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-violet-500/50" />

        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Difficulty</label>
        <div className="flex gap-2 mb-4">
          {(["mate1", "mate2"] as const).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={["flex-1 py-1.5 rounded-lg text-xs font-display font-bold border transition-all", difficulty === d ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"].join(" ")}>
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>

        <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Rating (800–2200)
          {rating && <span className={`ml-2 text-[0.65rem] ${ratingValid ? "text-green-400" : "text-red-400"}`}>{ratingValid ? "✓" : "✗"}</span>}
        </label>
        <input type="number" value={rating} onChange={e => setRating(e.target.value)} min={800} max={2200}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-violet-500/50" />

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
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-display font-bold text-sm hover:text-[var(--text-primary)] transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<PuzzleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editPuzzle, setEditPuzzle] = useState<PuzzleRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const allSelected = puzzles.length > 0 && selected.size === puzzles.length;

  const [validation, setValidation] = useState<{
    loading: boolean; valid: boolean; error?: string; bestMove?: string; mateIn?: number; pv?: string[];
  } | null>(null);

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
    await fetch("/api/admin/puzzles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected] }) });
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
  type ImportFailure = { index: number; title: string; reason: string };
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string; failures?: ImportFailure[] } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [csvPromptCopied, setCsvPromptCopied] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Lichess import */
  const lichessFileRef = useRef<HTMLInputElement>(null);
  const [lichessCsv, setLichessCsv] = useState("");
  const [lichessImporting, setLichessImporting] = useState(false);
  const [lichessMsg, setLichessMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lichessMaxCount, setLichessMaxCount] = useState("200");
  const [lichessMinRating, setLichessMinRating] = useState("");
  const [lichessMaxRating, setLichessMaxRating] = useState("");
  const [lichessThemes, setLichessThemes] = useState<string[]>([]);

  function copyPuzzle(p: PuzzleRow) {
    const data = { title: p.title, difficulty: p.difficulty, rating: p.rating, fen: p.fen };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const LICHESS_CSV_PROMPT = `Generate chess tactical puzzles in Lichess CSV format. Return ONLY the CSV rows, no extra text, no header row.

EXACT FORMAT (one puzzle per line, 9 comma-separated fields):
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl

FIELD RULES:
- PuzzleId: unique 5-character alphanumeric ID (e.g. "aB3xZ")
- FEN: position BEFORE the opponent's last move (valid FEN, can be any side to move)
- Moves: space-separated UCI moves — first move is the OPPONENT'S last move that creates the tactic, remaining moves are the SOLUTION (alternating: player, opponent, player...)
- Rating: integer 600–2800
- RatingDeviation: integer 60–200
- Popularity: integer 60–100
- NbPlays: integer 100–50000
- Themes: space-separated Lichess theme tags (see list below)
- GameUrl: use "https://lichess.org/training/PuzzleId"

UCI MOVE FORMAT: <from><to>[promotion]  e.g. "e2e4", "d7d5", "e7e8q"

HOW MOVES WORKS (critical):
1. Start with the FEN position
2. Apply Moves[0] — this is the opponent's move that creates the threat/blunder
3. The resulting position is what the player sees
4. Moves[1], Moves[3], Moves[5]... are the PLAYER's correct moves
5. Moves[2], Moves[4], Moves[6]... are the OPPONENT's best responses
6. The puzzle ends when all moves in the solution are played

AVAILABLE THEMES (pick 2–5 that match):
advantage, attraction, backRankMate, capturingDefender, crushing, deflection,
discoveredAttack, doubleCheck, endgame, enPassant, exposedKing, fork, hangingPiece,
interference, kingsideAttack, knightEndgame, mateIn1, mateIn2, mateIn3, middlegame,
opening, pawnEndgame, pin, promotion, queensideAttack, rookEndgame, sacrifice,
short, skewer, smotheredMate, trappedPiece, underPromotion, xRayAttack, zugzwang

RATING GUIDE:
- 600–1000: simple one-move tactics (fork, hanging piece, mate in 1)
- 1000–1500: 2–3 move combinations, basic pins/skewers
- 1500–2000: multi-step tactics, sacrifices, interference
- 2000–2800: deep combinations, quiet moves, zugzwang, underpromotion

QUALITY RULES:
- All positions must be legal chess positions
- The solution must be the ONLY winning line
- Opponent must play the best defensive moves in Moves[2], Moves[4]...
- Include variety: mix mates, material wins, endgame themes
- Prefer positions that look like they could arise from real games

EXAMPLE ROW:
aB3xZ,r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4,f3g5 f6e4 g5f7 e8f7,1450,75,88,3200,fork middlegame short,https://lichess.org/training/aB3xZ`;

  const AI_PROMPT = `Generate high-quality chess puzzles in JSON format. Return ONLY the JSON array, no extra text.

Format:
[
  {
    "title": "descriptive human-like name",
    "difficulty": "mate1" | "mate2",
    "rating": number (800–2200),
    "fen": "valid FEN string (White to move)"
  }
]

NOTE: No "solution" field is needed — the server engine validates moves dynamically.

STRICT RULES:
- All positions must be LEGAL chess positions with White to move
- The first winning move must be the ONLY winning move for White

DIFFICULTY:
- "mate1" → White checkmates in exactly 1 move
- "mate2" → White checkmates in exactly 2 moves (White, Black best, White mate)

RATING GUIDE:
- 800–1200: direct back-rank or simple piece checkmates, obvious ideas
- 1200–1800: 1–2 tactical ideas, small combinations, fork/pin leading to mate
- 1800–2200: quiet moves, sacrifices, non-obvious deflections or decoys`;

  function exportJson() {
    const data = puzzles.map(({ title, difficulty, rating, fen }) => ({ title, difficulty, rating, fen }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "puzzles.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function copyJson() {
    const data = puzzles.map(({ title, difficulty, rating, fen }) => ({ title, difficulty, rating, fen }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setExportCopied(true); setTimeout(() => setExportCopied(false), 2000);
  }
  function copyPrompt() {
    navigator.clipboard.writeText(AI_PROMPT);
    setPromptCopied(true); setTimeout(() => setPromptCopied(false), 2000);
  }
  function copyCsvPrompt() {
    navigator.clipboard.writeText(LICHESS_CSV_PROMPT);
    setCsvPromptCopied(true); setTimeout(() => setCsvPromptCopied(false), 2000);
  }

  const loadStats = useCallback(() => {
    fetch("/api/admin/puzzles/stats")
      .then(r => r.json()).then(d => setStats(d)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/puzzles")
      .then(r => r.json())
      .then(d => { setPuzzles(d); setLoading(false); })
      .catch(() => setLoading(false));
    loadStats();
  }, [loadStats]);

  useEffect(() => { load(); }, [load]);

  const fenValid = (() => { try { fromFEN(fen); return true; } catch { return false; } })();

  useEffect(() => {
    if (!fenValid || !fen.trim()) { setValidation(null); return; }
    const timeout = setTimeout(async () => {
      try {
        setValidation({ loading: true, valid: false });
        const res = await fetch("/api/admin/puzzles/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fen, difficulty }) });
        const data = await res.json();
        setValidation({ loading: false, ...data });
      } catch { setValidation({ loading: false, valid: false, error: "Validation failed" }); }
    }, 600);
    return () => clearTimeout(timeout);
  }, [fen, difficulty, fenValid]);

  async function handleCreate() {
    if (!title.trim() || !fenValid) return;
    setCreating(true); setCreateMsg(null);
    const res = await fetch("/api/admin/puzzles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), fen: fen.trim(), difficulty }) });
    setCreating(false);
    if (res.ok) { setCreateMsg({ ok: true, text: "Puzzle created!" }); setTitle(""); setFen(""); load(); }
    else { const d = await res.json(); setCreateMsg({ ok: false, text: d.error ?? "Failed" }); }
  }

  async function handleImport() {
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); } catch { setImportMsg({ ok: false, text: "Invalid JSON" }); return; }
    if (!Array.isArray(parsed) || parsed.length === 0) { setImportMsg({ ok: false, text: "Expected a non-empty JSON array" }); return; }
    setImporting(true); setImportMsg(null);
    let ok = 0;
    const failures: ImportFailure[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i] as Record<string, unknown>;
      const res = await fetch("/api/admin/puzzles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (res.ok) { ok++; }
      else {
        let reason = `HTTP ${res.status}`;
        try { const d = await res.json(); reason = d.error ?? reason; } catch { /* keep */ }
        failures.push({ index: i + 1, title: typeof p?.title === "string" ? p.title : `Puzzle #${i + 1}`, reason });
      }
    }
    setImporting(false);
    setImportMsg({ ok: failures.length === 0, text: `Imported ${ok}${failures.length ? `, ${failures.length} failed` : ""}`, failures: failures.length > 0 ? failures : undefined });
    if (ok > 0) { setJsonText(""); load(); }
  }

  async function handleLichessImport() {
    if (!lichessCsv.trim()) { setLichessMsg({ ok: false, text: "No CSV data" }); return; }
    setLichessImporting(true); setLichessMsg(null);
    const res = await fetch("/api/admin/puzzles/lichess-import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv: lichessCsv,
        maxCount: parseInt(lichessMaxCount) || 200,
        minRating: lichessMinRating ? parseInt(lichessMinRating) : undefined,
        maxRating: lichessMaxRating ? parseInt(lichessMaxRating) : undefined,
        themes: lichessThemes.length > 0 ? lichessThemes : undefined,
      }),
    });
    const d = await res.json();
    setLichessImporting(false);
    if (res.ok) {
      setLichessMsg({ ok: true, text: `Imported ${d.imported}, skipped ${d.skipped}${d.errors?.length ? `. Errors: ${d.errors[0]}` : ""}` });
      setLichessCsv(""); load();
    } else {
      setLichessMsg({ ok: false, text: d.error ?? "Import failed" });
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText((ev.target?.result as string) ?? "");
    reader.readAsText(file); e.target.value = "";
  }
  function handleLichessFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLichessCsv((ev.target?.result as string) ?? "");
    reader.readAsText(file); e.target.value = "";
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this puzzle?")) return;
    await fetch("/api/admin/puzzles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  function toggleLichessTheme(t: string) {
    setLichessThemes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  return (
    <div>
      {editPuzzle && <EditModal puzzle={editPuzzle} onClose={() => setEditPuzzle(null)} onSaved={load} />}

      <div className="flex items-center gap-2 mb-1">
        <Puzzle size={20} className="text-violet-400" />
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">Chess Puzzles</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">Manage puzzles — manual, JSON import, or Lichess CSV</p>

      {/* ── Row 1: Stats + Create + JSON Import ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
        {/* Stats */}
        {stats && <StatsPanel stats={stats} onRefreshCron={load} />}

        {/* Create form */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-5">Create Puzzle</h2>

          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Classic Back-rank Mate"
            className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50" />

          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Difficulty</label>
          <div className="flex gap-2 mb-4">
            {(["mate1", "mate2"] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={["flex-1 py-1.5 rounded-lg text-xs font-display font-bold border transition-all", difficulty === d ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
                {DIFF_LABEL[d]}
              </button>
            ))}
          </div>

          <label className="block text-xs font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            FEN position
            {fen && <span className={`ml-2 text-[0.65rem] ${fenValid ? "text-green-400" : "text-red-400"}`}>{fenValid ? "✓ Valid" : "✗ Invalid"}</span>}
          </label>
          <input value={fen} onChange={e => setFen(e.target.value)} placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            className="w-full mb-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50" />

          {validation && (
            <div className={["mb-4 rounded-xl border p-3 text-sm", validation.loading ? "border-violet-500/30 bg-violet-500/10" : validation.valid ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"].join(" ")}>
              {validation.loading ? (
                <div className="flex items-center gap-2 text-violet-300"><Loader2 size={14} className="animate-spin" /> Analyzing...</div>
              ) : validation.valid ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-green-400 font-semibold"><CheckCircle2 size={14} /> Unique mate in {validation.mateIn}</div>
                  {validation.bestMove && <p className="text-[var(--text-secondary)]">Best move: <span className="font-mono text-violet-300">{validation.bestMove}</span></p>}
                  {validation.pv && <p className="text-[0.7rem] text-[var(--text-muted)] font-mono break-all">PV: {validation.pv.join(" ")}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400"><AlertCircle size={14} /> {validation.error}</div>
              )}
            </div>
          )}

          <p className="text-[0.7rem] text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 mb-4">
            ✓ No solution needed — the engine validates moves dynamically.
          </p>
          {createMsg && (
            <div className={`flex items-center gap-2 text-sm mb-4 ${createMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {createMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {createMsg.text}
            </div>
          )}
          <button onClick={handleCreate} disabled={creating || !title.trim() || !fenValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Puzzle
          </button>
        </div>

        {/* JSON import */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <FileJson size={16} className="text-violet-400" />
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Import from JSON</h2>
          </div>
          <p className="text-[0.65rem] text-[var(--text-muted)] mb-4">Paste a JSON array or upload a file.</p>

          <pre className="text-[0.6rem] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 mb-4 overflow-x-auto text-[var(--text-muted)] leading-relaxed">{`[
  {
    "title": "Back-rank Mate",
    "difficulty": "mate1",
    "rating": 950,
    "fen": "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"
  }
]`}</pre>

          <div className="flex gap-2 mb-3">
            <button onClick={copyPrompt}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-display font-semibold hover:bg-violet-500/25 transition-colors">
              {promptCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {promptCopied ? "Copied!" : "Copy AI prompt"}
            </button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
              <Upload size={12} /> Upload JSON
            </button>
          </div>

          <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Or paste JSON here..." rows={7}
            className="w-full flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 resize-none mb-4" />

          {importMsg && (
            <div className="mb-4 space-y-2">
              <div className={`flex items-center gap-2 text-sm ${importMsg.ok ? "text-green-400" : "text-red-400"}`}>
                {importMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {importMsg.text}
              </div>
              {importMsg.failures && importMsg.failures.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 max-h-40 overflow-y-auto">
                  <p className="text-[0.6rem] font-display font-bold text-red-400/70 uppercase tracking-wider mb-1.5">Failed puzzles</p>
                  <ul className="space-y-1">
                    {importMsg.failures.map(f => (
                      <li key={f.index} className="text-[0.65rem] flex gap-2">
                        <span className="text-[var(--text-muted)] shrink-0">#{f.index}</span>
                        <span className="text-[var(--text-secondary)] truncate">{f.title}</span>
                        <span className="text-red-400 ml-auto shrink-0">— {f.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button onClick={handleImport} disabled={importing || !jsonText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity self-start">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Import Puzzles
          </button>
        </div>
      </div>

      {/* ── Row 2: Lichess Import + Puzzle list ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Lichess CSV Import */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-violet-400" />
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Import from Lichess CSV</h2>
          </div>
          <p className="text-[0.65rem] text-[var(--text-muted)] mb-4">
            Download the free puzzle database from{" "}
            <span className="text-violet-400">database.lichess.org</span> and paste/upload it here.
            Supports all 50+ themes.
          </p>

          {/* Filters */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <label className="block text-[0.6rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Max puzzles</label>
              <input type="number" value={lichessMaxCount} onChange={e => setLichessMaxCount(e.target.value)} placeholder="200"
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="block text-[0.6rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Min rating</label>
              <input type="number" value={lichessMinRating} onChange={e => setLichessMinRating(e.target.value)} placeholder="800"
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="block text-[0.6rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Max rating</label>
              <input type="number" value={lichessMaxRating} onChange={e => setLichessMaxRating(e.target.value)} placeholder="2200"
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-violet-500/50" />
            </div>
          </div>

          {/* Theme filter */}
          <div className="mb-4">
            <label className="block text-[0.6rem] font-display font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Filter themes <span className="text-violet-400 normal-case">(leave empty = import all)</span>
            </label>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
              {LICHESS_THEMES.map(t => (
                <button key={t.id} onClick={() => toggleLichessTheme(t.id)}
                  className={["text-[0.6rem] px-2 py-0.5 rounded-full border transition-all", lichessThemes.includes(t.id) ? "bg-violet-500/25 border-violet-500/40 text-violet-300" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"].join(" ")}>
                  {t.label}
                </button>
              ))}
            </div>
            {lichessThemes.length > 0 && (
              <button onClick={() => setLichessThemes([])} className="mt-1.5 text-[0.6rem] text-violet-400 hover:underline">Clear selection</button>
            )}
          </div>

          {/* AI prompt + file upload */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <button onClick={copyCsvPrompt}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-display font-semibold hover:bg-violet-500/25 transition-colors">
              {csvPromptCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {csvPromptCopied ? "Copied!" : "Copy AI prompt (CSV)"}
            </button>
            <input ref={lichessFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleLichessFileUpload} />
            <button onClick={() => lichessFileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
              <Upload size={12} /> Upload .csv file
            </button>
          </div>

          <textarea value={lichessCsv} onChange={e => setLichessCsv(e.target.value)}
            placeholder={"PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl\n00sHx,r3r1k1/... w - - 2 19,c1d2 e5f3 g2f3 e7e4,1565,73,96,6940,advantage discoveredAttack,..."}
            rows={6}
            className="w-full flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 resize-none mb-4" />

          {lichessMsg && (
            <div className={`flex items-center gap-2 text-sm mb-4 ${lichessMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {lichessMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {lichessMsg.text}
            </div>
          )}

          <button onClick={handleLichessImport} disabled={lichessImporting || !lichessCsv.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity self-start">
            {lichessImporting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            {lichessImporting ? "Importing..." : "Import from Lichess CSV"}
          </button>
        </div>

        {/* Puzzle list */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2">
              <Puzzle size={15} className="text-violet-400" />
              <h2 className="font-display font-bold text-sm text-[var(--text-primary)]">
                All Puzzles <span className="ml-1.5 text-[0.65rem] font-normal text-[var(--text-muted)]">({puzzles.length})</span>
              </h2>
            </div>
            {puzzles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={toggleAll}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.65rem] font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
                {selected.size > 0 && (
                  <button onClick={handleDeleteSelected} disabled={deleting}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[0.65rem] font-display font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors">
                    {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete {selected.size}
                  </button>
                )}
                <button onClick={copyJson}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.65rem] font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
                  {exportCopied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  {exportCopied ? "Copied!" : "Copy JSON"}
                </button>
                <button onClick={exportJson}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.65rem] font-display font-semibold hover:text-[var(--text-primary)] transition-colors">
                  <Download size={11} /> Download
                </button>
              </div>
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-2">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-[var(--text-muted)]" /></div>
            ) : puzzles.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-10">No puzzles yet.</p>
            ) : puzzles.map(p => (
              <div key={p.id}
                className={`border rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors ${selected.has(p.id) ? "bg-violet-500/10 border-violet-500/30" : "bg-[var(--bg-elevated)] border-[var(--border-subtle)]"}`}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="shrink-0 w-3.5 h-3.5 accent-violet-500 cursor-pointer" />
                <div className="shrink-0 scale-[0.35] origin-left" style={{ width: 320, height: 320, marginRight: -208 }}>
                  <MiniBoard fen={p.fen} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-[var(--text-primary)] text-xs truncate">{p.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full border ${DIFF_COLOR[p.difficulty] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                      {DIFF_LABEL[p.difficulty] ?? p.difficulty}
                    </span>
                    <span className="text-[0.6rem] font-mono text-amber-400">★ {p.rating}</span>
                    <span className="text-[0.6rem] text-[var(--text-muted)]">{p.solveCount} solves</span>
                    {p.source === "lichess" && (
                      <span className="text-[0.6rem] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full">Lichess</span>
                    )}
                  </div>
                  {p.themes && p.themes.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {p.themes.slice(0, 3).map(t => (
                        <span key={t} className="text-[0.55rem] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                      {p.themes.length > 3 && <span className="text-[0.55rem] text-[var(--text-muted)]">+{p.themes.length - 3}</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => setEditPuzzle(p)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Edit"><Pencil size={13} /></button>
                  <button onClick={() => copyPuzzle(p)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-violet-400 hover:bg-violet-500/10 transition-colors" title="Copy">
                    {copiedId === p.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
