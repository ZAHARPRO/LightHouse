import { Chess } from "chess.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type LichessPuzzleRow = {
  lichessId: string;
  fen: string;
  solution: string[];   // UCI moves (first = opponent setup, rest = player+bot)
  rating: number;
  themes: string[];
  gameUrl: string;
};

// ── Difficulty mapping ────────────────────────────────────────────────────────
export function difficultyFromThemes(themes: string[]): string {
  if (themes.includes("mateIn1")) return "mate1";
  if (themes.includes("mateIn2")) return "mate2";
  if (themes.includes("endgame") || themes.includes("pawnEndgame") ||
      themes.includes("rookEndgame") || themes.includes("queenEndgame") ||
      themes.includes("knightEndgame") || themes.includes("bishopEndgame")) return "endgame";
  if (themes.includes("opening")) return "opening";
  return "tactical";
}

// Apply a UCI move string to a FEN and return the new FEN
function applyUciToFen(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to   = uci.slice(2, 4);
    const prom = uci[4] as ("q" | "r" | "b" | "n") | undefined;
    const result = chess.move({ from, to, promotion: prom });
    if (!result) return null;
    return chess.fen();
  } catch {
    return null;
  }
}

// ── CSV line parser ───────────────────────────────────────────────────────────
// Lichess CSV format:
// PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
export function parseLichessCsvLine(line: string): LichessPuzzleRow | null {
  const cols = line.split(",");
  if (cols.length < 9) return null;

  const lichessId = cols[0].trim();
  const rawFen    = cols[1].trim();
  const movesStr  = cols[2].trim();
  const rating    = parseInt(cols[3]);
  const themes    = cols[7].trim().split(" ").filter(Boolean);
  const gameUrl   = cols[8].trim();

  if (!lichessId || !rawFen || !movesStr || isNaN(rating)) return null;

  const allMoves = movesStr.split(" ").filter(Boolean);
  if (allMoves.length < 2) return null;

  // allMoves[0] is the opponent's last move (creates the puzzle position)
  // allMoves[1:] is the solution the player must find
  const startFen = applyUciToFen(rawFen, allMoves[0]);
  if (!startFen) return null;

  return {
    lichessId,
    fen: startFen,
    solution: allMoves.slice(1),
    rating,
    themes,
    gameUrl,
  };
}

// ── Parse full CSV text (skips header row) ────────────────────────────────────
export function parseLichessCsv(
  csv: string,
  opts: {
    maxCount?: number;
    minRating?: number;
    maxRating?: number;
    themes?: string[];       // only include puzzles with ANY of these themes
  } = {}
): LichessPuzzleRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const results: LichessPuzzleRow[] = [];

  for (const line of lines) {
    // Skip header row
    if (line.startsWith("PuzzleId")) continue;
    if (opts.maxCount && results.length >= opts.maxCount) break;

    const row = parseLichessCsvLine(line);
    if (!row) continue;

    if (opts.minRating && row.rating < opts.minRating) continue;
    if (opts.maxRating && row.rating > opts.maxRating) continue;
    if (opts.themes && opts.themes.length > 0) {
      const hasTheme = opts.themes.some(t => row.themes.includes(t));
      if (!hasTheme) continue;
    }

    results.push(row);
  }

  return results;
}

// ── Fetch today's Lichess daily puzzle ───────────────────────────────────────
type LichessDailyPuzzle = {
  game: { pgn: string };
  puzzle: {
    id: string;
    initialPly: number;
    rating: number;
    solution: string[];
    themes: string[];
  };
};

export async function fetchLichessDailyPuzzle(): Promise<LichessPuzzleRow | null> {
  try {
    const res = await fetch("https://lichess.org/api/puzzle/daily", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data: LichessDailyPuzzle = await res.json();

    const { game, puzzle } = data;
    if (!puzzle?.id || !puzzle.solution?.length || !game?.pgn) return null;

    // Replay PGN to initialPly — that position IS the puzzle start (player to move)
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });

    const replay = new Chess();
    for (let i = 0; i < puzzle.initialPly && i < history.length; i++) {
      replay.move(history[i]);
    }

    // solution[0] is the player's first correct move (not a setup move)
    return {
      lichessId: puzzle.id,
      fen: replay.fen(),
      solution: puzzle.solution,
      rating: puzzle.rating,
      themes: puzzle.themes ?? [],
      gameUrl: `https://lichess.org/training/${puzzle.id}`,
    };
  } catch {
    return null;
  }
}

// ── Fetch one puzzle by theme angle (public, no auth needed) ─────────────────
// GET /api/puzzle/next?angle={theme}  — returns a different puzzle per theme
async function fetchPuzzleByAngle(
  angle: string,
  apiKey?: string,
): Promise<LichessPuzzleRow | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await fetch(
      `https://lichess.org/api/puzzle/next?angle=${encodeURIComponent(angle)}`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data: LichessDailyPuzzle = await res.json();
    const { game, puzzle } = data;
    if (!puzzle?.id || !puzzle.solution?.length || !game?.pgn) return null;

    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    const replay = new Chess();
    for (let i = 0; i < puzzle.initialPly && i < history.length; i++) {
      replay.move(history[i]);
    }
    return {
      lichessId: puzzle.id,
      fen: replay.fen(),
      solution: puzzle.solution,
      rating: puzzle.rating,
      themes: puzzle.themes ?? [],
      gameUrl: `https://lichess.org/training/${puzzle.id}`,
    };
  } catch {
    return null;
  }
}

// ── Fetch N puzzles by cycling through themes ─────────────────────────────────
// Uses GET /api/puzzle/next?angle={theme} — public endpoint, no batch needed.
// Each theme returns a different puzzle, so we can get up to 50 unique puzzles.
const FETCH_ANGLES = [
  "mix", "fork", "pin", "skewer", "discoveredAttack", "doubleCheck",
  "mateIn1", "mateIn2", "backRankMate", "smotheredMate", "sacrifice",
  "deflection", "attraction", "interference", "hangingPiece", "trapped",
  "capturingDefender", "promotion", "underPromotion", "enPassant",
  "endgame", "rookEndgame", "queenEndgame", "pawnEndgame", "knightEndgame",
  "opening", "middlegame", "long", "veryLong", "short",
  "kingsideAttack", "queensideAttack", "exposedKing", "xRayAttack",
  "zugzwang", "quietMove", "defensiveMove", "equality", "advantage",
  "crushing", "coercion", "intermezzo", "castling",
  "bodenMate", "hookMate", "doubleBishopMate", "arabian",
] as const;

export async function fetchLichessPuzzleBatch(
  count: number,
  apiKey?: string,
): Promise<{ puzzles: LichessPuzzleRow[]; error?: string }> {
  const n = Math.max(1, Math.min(FETCH_ANGLES.length, count));
  const angles = FETCH_ANGLES.slice(0, n);

  // Fetch in parallel (max 6 at a time to avoid rate-limiting)
  const results: LichessPuzzleRow[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < angles.length; i += 6) {
    const batch = angles.slice(i, i + 6);
    const settled = await Promise.allSettled(
      batch.map(angle => fetchPuzzleByAngle(angle, apiKey))
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value && !seen.has(r.value.lichessId)) {
        seen.add(r.value.lichessId);
        results.push(r.value);
      } else if (r.status === "rejected") {
        errors.push(String(r.reason));
      }
    }
  }

  if (results.length === 0) {
    return { puzzles: [], error: errors[0] ?? "All angle fetches returned null" };
  }
  return { puzzles: results, error: errors.length ? errors[0] : undefined };
}

// ── All 50+ Lichess puzzle themes ─────────────────────────────────────────────
export const LICHESS_THEMES: { id: string; label: string }[] = [
  { id: "advantage",          label: "Advantage" },
  { id: "anaconaDefense",     label: "Anacona Defense" },
  { id: "attraction",         label: "Attraction" },
  { id: "backRankMate",       label: "Back Rank Mate" },
  { id: "bishopEndgame",      label: "Bishop Endgame" },
  { id: "bodenMate",          label: "Boden's Mate" },
  { id: "capturingDefender",  label: "Capturing Defender" },
  { id: "castling",           label: "Castling" },
  { id: "coercion",           label: "Coercion" },
  { id: "crushing",           label: "Crushing" },
  { id: "defensiveMove",      label: "Defensive Move" },
  { id: "deflection",         label: "Deflection" },
  { id: "discoveredAttack",   label: "Discovered Attack" },
  { id: "doubleBishopMate",   label: "Double Bishop Mate" },
  { id: "doubleCheck",        label: "Double Check" },
  { id: "endgame",            label: "Endgame" },
  { id: "enPassant",          label: "En Passant" },
  { id: "equality",           label: "Equality" },
  { id: "exposedKing",        label: "Exposed King" },
  { id: "fork",               label: "Fork" },
  { id: "hangingPiece",       label: "Hanging Piece" },
  { id: "hookMate",           label: "Hook Mate" },
  { id: "interference",       label: "Interference" },
  { id: "intermezzo",         label: "Intermezzo" },
  { id: "kingsideAttack",     label: "Kingside Attack" },
  { id: "knightEndgame",      label: "Knight Endgame" },
  { id: "long",               label: "Long" },
  { id: "master",             label: "Master Game" },
  { id: "masterVsMaster",     label: "Master vs Master" },
  { id: "mateIn1",            label: "Mate in 1" },
  { id: "mateIn2",            label: "Mate in 2" },
  { id: "mateIn3",            label: "Mate in 3" },
  { id: "mateIn4",            label: "Mate in 4" },
  { id: "mateIn5",            label: "Mate in 5+" },
  { id: "middlegame",         label: "Middlegame" },
  { id: "opening",            label: "Opening" },
  { id: "pawnEndgame",        label: "Pawn Endgame" },
  { id: "pin",                label: "Pin" },
  { id: "promotion",          label: "Promotion" },
  { id: "queenEndgame",       label: "Queen Endgame" },
  { id: "queenRookEndgame",   label: "Queen & Rook Endgame" },
  { id: "queensideAttack",    label: "Queenside Attack" },
  { id: "quietMove",          label: "Quiet Move" },
  { id: "rookEndgame",        label: "Rook Endgame" },
  { id: "sacrifice",          label: "Sacrifice" },
  { id: "short",              label: "Short" },
  { id: "skewer",             label: "Skewer" },
  { id: "smotheredMate",      label: "Smothered Mate" },
  { id: "superGM",            label: "Super GM" },
  { id: "trappedPiece",       label: "Trapped Piece" },
  { id: "underPromotion",     label: "Underpromotion" },
  { id: "veryLong",           label: "Very Long" },
  { id: "xRayAttack",         label: "X-Ray Attack" },
  { id: "zugzwang",           label: "Zugzwang" },
];
