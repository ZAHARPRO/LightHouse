import { Board, Color, Move, getLegalMoves, applyMove, canContinueJump, isGameOver } from "./checkers";

export type Difficulty = "easy" | "normal" | "hard";

const PIECE_VAL = 100;
const KING_VAL  = 300;

function evaluate(board: Board, color: Color): number {
  let score = 0;
  let wCount = 0, bCount = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      const isWhite = cell === "w" || cell === "W";
      const isKing  = cell === "W" || cell === "B";
      if (isWhite) wCount++; else bCount++;

      let val = isKing ? KING_VAL : PIECE_VAL;

      if (!isKing) {
        // Advancement: white pieces advance toward row 0; black toward row 7
        const advance = isWhite ? (7 - r) : r;
        val += advance * 4;

        // Back-row defense: keep at least some pieces on home row to block promotion
        const homeRow = isWhite ? 7 : 0;
        if (r === homeRow) val += 12;
      } else {
        // Kings: prefer central positions
        const centerDist = Math.abs(3.5 - r) + Math.abs(3.5 - c);
        val += Math.max(0, 14 - centerDist * 2);
      }

      // Edge penalty: pieces on edge columns have fewer attack options
      if (c === 0 || c === 7) val -= 8;

      score += isWhite ? val : -val;
    }
  }

  // Trade incentive: the side with more pieces benefits from simplification
  const diff = wCount - bCount;
  if (diff !== 0) {
    const simplifyBonus = (16 - wCount - bCount) * 2;
    score += diff > 0 ? simplifyBonus : -simplifyBonus;
  }

  return color === "w" ? score : -score;
}

// rootMove tracks the first move of a chain so getBotMove applies it to the original board
function expandMoves(board: Board, moves: Move[], color: Color, rootMove?: Move): { board: Board; move: Move; chainLen: number }[] {
  const result: { board: Board; move: Move; chainLen: number }[] = [];
  for (const move of moves) {
    const root = rootMove ?? move;
    const { board: nb, promoted } = applyMove(board, move);
    if (move.captured && !promoted && canContinueJump(nb, move.to[0], move.to[1])) {
      const continuations = getLegalMoves(nb, color, move.to);
      for (const e of expandMoves(nb, continuations, color, root)) {
        result.push({ ...e, chainLen: e.chainLen + 1 });
      }
    } else {
      result.push({ board: nb, move: root, chainLen: move.captured ? 1 : 0 });
    }
  }
  return result;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  color: Color,
  turn: Color,
): number {
  const { over, winner } = isGameOver(board, turn);
  if (over) {
    if (!winner) return 0;
    return winner === color ? 100000 + depth : -100000 - depth;
  }
  if (depth === 0) return evaluate(board, color);

  const moves = getLegalMoves(board, turn);
  let expanded = expandMoves(board, moves, turn);
  if (expanded.length === 0) return maximizing ? -100000 : 100000;

  // Move ordering: longer capture chains first, then advances over retreats
  expanded = expanded.slice().sort((a, b) => b.chainLen - a.chainLen);

  const nextTurn: Color = turn === "w" ? "b" : "w";
  if (maximizing) {
    let best = -Infinity;
    for (const { board: nb } of expanded) {
      const v = minimax(nb, depth - 1, alpha, beta, false, color, nextTurn);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const { board: nb } of expanded) {
      const v = minimax(nb, depth - 1, alpha, beta, true, color, nextTurn);
      if (v < best) best = v;
      if (v < beta) beta = v;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function getBotMove(
  board: Board,
  botColor: Color,
  difficulty: Difficulty,
  mustJumpFrom?: [number, number] | null,
): Move | null {
  const moves = getLegalMoves(board, botColor, mustJumpFrom);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    // Easy: random, but always take a capture if one is available
    const captures = moves.filter(m => m.captured);
    const pool = captures.length > 0 ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Normal: depth 4. Hard: depth 6.
  const depth = difficulty === "normal" ? 4 : 6;
  const expanded = expandMoves(board, moves, botColor);
  if (expanded.length === 0) return null;

  // Sort root candidates: longer capture chains first
  const sorted = expanded.slice().sort((a, b) => b.chainLen - a.chainLen);

  const nextTurn: Color = botColor === "w" ? "b" : "w";
  let bestScore = -Infinity;
  let bestMove: Move = sorted[0].move;

  for (const { board: nb, move } of sorted) {
    const score = minimax(nb, depth - 1, -Infinity, Infinity, false, botColor, nextTurn);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
