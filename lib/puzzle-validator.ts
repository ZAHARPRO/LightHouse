import { Chess } from "chess.js";

// ── chess.js helpers ──────────────────────────────────────────────────────────

function toUCI(move: { from: string; to: string; promotion?: string }) {
  return move.from + move.to + (move.promotion ?? "");
}

function mateIn1(fen: string): string | null {
  const chess = new Chess(fen);
  for (const move of chess.moves({ verbose: true })) {
    chess.move(move);
    if (chess.isCheckmate()) {
      chess.undo();
      return toUCI(move);
    }
    chess.undo();
  }
  return null;
}

function findMate2Line(fen: string): string[] | null {
  const chess = new Chess(fen);

  for (const wMove of chess.moves({ verbose: true })) {
    chess.move(wMove);
    if (chess.isCheckmate()) { chess.undo(); continue; }

    const blackMoves = chess.moves({ verbose: true });
    if (blackMoves.length === 0) { chess.undo(); continue; }

    let allMated = true;
    let pv: string[] | null = null;

    for (const bMove of blackMoves) {
      chess.move(bMove);
      const reply = mateIn1(chess.fen());
      if (!reply) { allMated = false; chess.undo(); break; }
      if (!pv) pv = [toUCI(wMove), toUCI(bMove), reply];
      chess.undo();
    }

    chess.undo();
    if (allMated && pv) return pv;
  }

  return null;
}

// ── Lichess cloud eval ────────────────────────────────────────────────────────

async function lichessEval(
  fen: string
): Promise<{ mate?: number; moves?: string } | null> {
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pv = data.pvs?.[0];
    if (!pv) return null;
    return {
      mate: typeof pv.mate === "number" ? pv.mate : undefined,
      moves: pv.moves,
    };
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function validatePuzzle(
  fen: string,
  difficulty: "mate1" | "mate2"
) {
  try {
    new Chess(fen);
  } catch {
    return { valid: false, error: "Invalid FEN" };
  }

  if (fen.split(" ")[1] !== "w") {
    return { valid: false, error: "White to move required" };
  }

  const expected = difficulty === "mate1" ? 1 : 2;

  // Primary: Lichess cloud eval (has millions of cached positions)
  const lichess = await lichessEval(fen);
  if (lichess) {
    if (lichess.mate === undefined) {
      return { valid: false, error: "No forced mate found" };
    }
    if (lichess.mate !== expected) {
      return {
        valid: false,
        error: `Not mate in ${expected} (found mate in ${lichess.mate})`,
      };
    }
    const moves = lichess.moves?.split(" ") ?? [];
    return { valid: true, bestMove: moves[0], pv: moves, mateIn: lichess.mate };
  }

  // Fallback: chess.js brute force (works for any position, no external deps)
  if (difficulty === "mate1") {
    const best = mateIn1(fen);
    if (!best) return { valid: false, error: "No forced mate in 1 found" };
    return { valid: true, bestMove: best, pv: [best], mateIn: 1 };
  } else {
    const pv = findMate2Line(fen);
    if (!pv) return { valid: false, error: "No forced mate in 2 found" };
    return { valid: true, bestMove: pv[0], pv, mateIn: 2 };
  }
}
