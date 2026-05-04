import { Board, Color, Move, getLegalMoves, applyMove, canContinueJump, isGameOver } from "./checkers";

export type Difficulty = "easy" | "normal" | "hard";

// Material values
const PIECE_VAL  = 100;
const KING_VAL   = 300;
// Center-ish bonus: rows 3-4 / cols 2-5
function positionalBonus(r: number, c: number): number {
  const rowBonus = (r === 3 || r === 4) ? 10 : (r === 2 || r === 5) ? 5 : 0;
  const colBonus = (c >= 2 && c <= 5) ? 5 : 0;
  return rowBonus + colBonus;
}

function evaluate(board: Board, color: Color): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const isWhite = cell === "w" || cell === "W";
      const isKing  = cell === "W" || cell === "B";
      const val = (isKing ? KING_VAL : PIECE_VAL) + positionalBonus(r, c);
      score += isWhite ? val : -val;
    }
  }
  return color === "w" ? score : -score;
}

// rootMove tracks the first move of a chain so getBotMove applies it to the original board
function expandMoves(board: Board, moves: Move[], color: Color, rootMove?: Move): { board: Board; move: Move }[] {
  const result: { board: Board; move: Move }[] = [];
  for (const move of moves) {
    const root = rootMove ?? move;
    const { board: nb, promoted } = applyMove(board, move);
    if (move.captured && !promoted && canContinueJump(nb, move.to[0], move.to[1])) {
      const continuations = getLegalMoves(nb, color, move.to);
      for (const e of expandMoves(nb, continuations, color, root)) result.push(e);
    } else {
      result.push({ board: nb, move: root });
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
  color: Color,      // perspective color (the bot)
  turn: Color,       // whose turn it is right now
): number {
  const { over, winner } = isGameOver(board, turn);
  if (over) {
    if (!winner) return 0;
    return winner === color ? 100000 + depth : -100000 - depth;
  }
  if (depth === 0) return evaluate(board, color);

  const moves = getLegalMoves(board, turn);
  const expanded = expandMoves(board, moves, turn);
  if (expanded.length === 0) return maximizing ? -100000 : 100000;

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
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === "normal" ? 3 : 5;
  const expanded = expandMoves(board, moves, botColor);
  if (expanded.length === 0) return null;

  const nextTurn: Color = botColor === "w" ? "b" : "w";
  let bestScore = -Infinity;
  let bestMove: Move = expanded[0].move;

  for (const { board: nb, move } of expanded) {
    const score = minimax(nb, depth - 1, -Infinity, Infinity, false, botColor, nextTurn);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}
