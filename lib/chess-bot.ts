import { GameState, Move, getAllLegalMoves, applyMove, isCheckmate, isStalemate, opp } from './chess';

const VALS: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

// Piece-square tables (white perspective, rows 0=rank8 .. 7=rank1)
const PST: Record<string, number[][]> = {
  P: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  N: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  B: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  R: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  Q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  K: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
};

function evaluate(state: GameState): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = state.board[r][c];
      if (!sq) continue;
      const base = VALS[sq.type] ?? 0;
      const pst = PST[sq.type];
      const pos = pst ? (sq.color === 'w' ? pst[r][c] : pst[7 - r][c]) : 0;
      score += sq.color === 'w' ? base + pos : -(base + pos);
    }
  }
  return score;
}

function minimax(state: GameState, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (isCheckmate(state)) return maximizing ? -100000 : 100000;
  if (isStalemate(state)) return 0;
  if (depth === 0) return evaluate(state);

  const moves = getAllLegalMoves(state);
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, minimax(applyMove(state, m), depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      best = Math.min(best, minimax(applyMove(state, m), depth - 1, alpha, beta, true));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getBotMove(state: GameState, difficulty: 'easy' | 'medium' | 'hard'): Move | null {
  const moves = getAllLegalMoves(state);
  if (moves.length === 0) return null;
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)];

  const depth = difficulty === 'medium' ? 2 : 3;
  const botIsWhite = state.turn === 'w';
  let bestMove = moves[0];
  let bestVal = botIsWhite ? -Infinity : Infinity;

  for (const m of moves) {
    const val = minimax(applyMove(state, m), depth - 1, -Infinity, Infinity, !botIsWhite);
    if (botIsWhite ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = m;
    }
  }
  return bestMove;
}
