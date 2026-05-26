import { GameState, Move, getAllLegalMoves, applyMove, isCheckmate, isStalemate } from './chess';

const VALS: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

// PSTs — white perspective, rows 0=rank8 .. 7=rank1
const PST: Record<string, number[][]> = {
  P: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  N: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  B: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  R: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  Q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  // King middlegame: stay safe behind pawns
  K_MID: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
  // King endgame: become active and central
  K_END: [[-50,-40,-30,-20,-20,-30,-40,-50],[-30,-20,-10,0,0,-10,-20,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-30,0,0,0,0,-30,-30],[-50,-30,-30,-30,-30,-30,-30,-50]],
};

function isEndgame(state: GameState): boolean {
  let material = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const sq = state.board[r][c];
      if (sq && sq.type !== 'K') material += VALS[sq.type] ?? 0;
    }
  return material < 1500;
}

function evaluate(state: GameState): number {
  const endgame = isEndgame(state);
  let score = 0;
  let wBishops = 0, bBishops = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = state.board[r][c];
      if (!sq) continue;
      const base = VALS[sq.type] ?? 0;
      const pstKey = sq.type === 'K' ? (endgame ? 'K_END' : 'K_MID') : sq.type;
      const pst = PST[pstKey];
      const pos = pst ? (sq.color === 'w' ? pst[r][c] : pst[7 - r][c]) : 0;
      score += sq.color === 'w' ? base + pos : -(base + pos);
      if (sq.type === 'B') sq.color === 'w' ? wBishops++ : bBishops++;
    }
  }

  // Bishop pair: both bishops is a long-term positional advantage
  if (wBishops >= 2) score += 30;
  if (bBishops >= 2) score -= 30;

  // Doubled pawn penalty
  for (let c = 0; c < 8; c++) {
    let wp = 0, bp = 0;
    for (let r = 0; r < 8; r++) {
      const sq = state.board[r][c];
      if (sq?.type === 'P') sq.color === 'w' ? wp++ : bp++;
    }
    if (wp > 1) score -= (wp - 1) * 20;
    if (bp > 1) score += (bp - 1) * 20;
  }

  return score;
}

// MVV-LVA: sort captures by (victim value * 10 - attacker value) descending
function mvvLva(state: GameState, move: Move): number {
  if (!move.captured) return 0;
  const attacker = state.board[move.from[0]][move.from[1]];
  return (VALS[move.captured] ?? 0) * 10 - (VALS[attacker?.type ?? 'P'] ?? 0);
}

function orderMoves(state: GameState, moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => mvvLva(state, b) - mvvLva(state, a));
}

// Quiescence search: extend only for captures to avoid horizon effect
function quiescence(
  state: GameState,
  alpha: number,
  beta: number,
  maximizing: boolean,
  qdepth: number,
): number {
  const standPat = evaluate(state);

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  if (qdepth <= 0) return standPat;

  const captures = orderMoves(state, getAllLegalMoves(state).filter(m => !!m.captured));
  if (captures.length === 0) return standPat;

  if (maximizing) {
    let best = standPat;
    for (const m of captures) {
      const v = quiescence(applyMove(state, m), alpha, beta, false, qdepth - 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = standPat;
    for (const m of captures) {
      const v = quiescence(applyMove(state, m), alpha, beta, true, qdepth - 1);
      if (v < best) best = v;
      if (v < beta) beta = v;
      if (beta <= alpha) break;
    }
    return best;
  }
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  useQSearch: boolean,
): number {
  if (isCheckmate(state)) return maximizing ? -100000 : 100000;
  if (isStalemate(state)) return 0;
  if (depth === 0) {
    return useQSearch
      ? quiescence(state, alpha, beta, maximizing, 2)
      : evaluate(state);
  }

  const moves = orderMoves(state, getAllLegalMoves(state));

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, minimax(applyMove(state, m), depth - 1, alpha, beta, false, useQSearch));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      best = Math.min(best, minimax(applyMove(state, m), depth - 1, alpha, beta, true, useQSearch));
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

  // Medium: depth 3, no quiescence. Hard: depth 5 + quiescence search.
  const depth = difficulty === 'medium' ? 3 : 5;
  const useQSearch = difficulty === 'hard';
  const botIsWhite = state.turn === 'w';

  const ordered = orderMoves(state, moves);
  let bestMove = ordered[0];
  let bestVal = botIsWhite ? -Infinity : Infinity;

  for (const m of ordered) {
    const val = minimax(applyMove(state, m), depth - 1, -Infinity, Infinity, !botIsWhite, useQSearch);
    if (botIsWhite ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = m;
    }
  }
  return bestMove;
}
