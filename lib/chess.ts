export type Color = 'w' | 'b';
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type Piece = { type: PieceType; color: Color };
export type Square = Piece | null;
export type Board = Square[][];

export interface GameState {
  board: Board;
  turn: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassant: [number, number] | null;
  halfMove: number;
  fullMove: number;
}

export interface Move {
  from: [number, number];
  to: [number, number];
  promotion?: PieceType;
  captured?: PieceType;
  isEnPassant?: boolean;
  isCastling?: 'K' | 'Q';
  san?: string;
}

const FILES = 'abcdefgh';
const INIT: string[][] = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR'],
];

export function initialBoard(): Board {
  return INIT.map(row =>
    row.map(s => s ? { type: s[1] as PieceType, color: s[0] as Color } : null)
  );
}

export function initialState(): GameState {
  return {
    board: initialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfMove: 0,
    fullMove: 1,
  };
}

function cloneBoard(b: Board): Board {
  return b.map(row => row.map(sq => sq ? { ...sq } : null));
}

export function cloneState(s: GameState): GameState {
  return { ...s, board: cloneBoard(s.board), enPassant: s.enPassant ? [s.enPassant[0], s.enPassant[1]] : null, castling: { ...s.castling } };
}

function inB(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
export function opp(color: Color): Color { return color === 'w' ? 'b' : 'w'; }

function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color) return [r, c];
  return null;
}

export function isAttacked(board: Board, r: number, c: number, byColor: Color): boolean {
  const pawnRow = byColor === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inB(pawnRow, c + dc)) {
      const sq = board[pawnRow][c + dc];
      if (sq?.type === 'P' && sq.color === byColor) return true;
    }
  }
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r + dr, nc = c + dc;
    if (inB(nr, nc) && board[nr][nc]?.type === 'N' && board[nr][nc]?.color === byColor) return true;
  }
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let nr = r + dr, nc = c + dc;
    while (inB(nr, nc)) {
      const sq = board[nr][nc];
      if (sq) { if (sq.color === byColor && (sq.type === 'B' || sq.type === 'Q')) return true; break; }
      nr += dr; nc += dc;
    }
  }
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let nr = r + dr, nc = c + dc;
    while (inB(nr, nc)) {
      const sq = board[nr][nc];
      if (sq) { if (sq.color === byColor && (sq.type === 'R' || sq.type === 'Q')) return true; break; }
      nr += dr; nc += dc;
    }
  }
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = r + dr, nc = c + dc;
    if (inB(nr, nc) && board[nr][nc]?.type === 'K' && board[nr][nc]?.color === byColor) return true;
  }
  return false;
}

function pseudoLegal(state: GameState, fr: number, fc: number): Move[] {
  const sq = state.board[fr][fc];
  if (!sq || sq.color !== state.turn) return [];
  const { type, color } = sq;
  const enemy = opp(color);
  const board = state.board;
  const moves: Move[] = [];

  const tryPush = (tr: number, tc: number, extra: Partial<Move> = {}) => {
    if (!inB(tr, tc)) return false;
    const t = board[tr][tc];
    if (t?.color === color) return false;
    moves.push({ from: [fr, fc], to: [tr, tc], captured: t?.type, ...extra });
    return !t;
  };

  const slide = (dr: number, dc: number) => {
    let r = fr + dr, c = fc + dc;
    while (inB(r, c)) { if (!tryPush(r, c)) break; r += dr; c += dc; }
  };

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1;
      const start = color === 'w' ? 6 : 1;
      const prom = color === 'w' ? 0 : 7;
      if (inB(fr + dir, fc) && !board[fr + dir][fc]) {
        if (fr + dir === prom) {
          for (const p of ['Q','R','B','N'] as PieceType[])
            moves.push({ from: [fr, fc], to: [fr + dir, fc], promotion: p });
        } else {
          moves.push({ from: [fr, fc], to: [fr + dir, fc] });
          if (fr === start && !board[fr + 2 * dir][fc])
            moves.push({ from: [fr, fc], to: [fr + 2 * dir, fc] });
        }
      }
      for (const dc of [-1, 1]) {
        const tr = fr + dir, tc = fc + dc;
        if (!inB(tr, tc)) continue;
        const t = board[tr][tc];
        if (t?.color === enemy) {
          if (tr === prom) {
            for (const p of ['Q','R','B','N'] as PieceType[])
              moves.push({ from: [fr, fc], to: [tr, tc], promotion: p, captured: t.type });
          } else {
            moves.push({ from: [fr, fc], to: [tr, tc], captured: t.type });
          }
        }
        if (state.enPassant?.[0] === tr && state.enPassant?.[1] === tc)
          moves.push({ from: [fr, fc], to: [tr, tc], isEnPassant: true, captured: 'P' });
      }
      break;
    }
    case 'N':
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
        tryPush(fr + dr, fc + dc);
      break;
    case 'B':
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
      break;
    case 'R':
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
      break;
    case 'Q':
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
      break;
    case 'K':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
        tryPush(fr + dr, fc + dc);
      const rank = color === 'w' ? 7 : 0;
      if (fr === rank && fc === 4) {
        const ck = color === 'w' ? state.castling.wK : state.castling.bK;
        const cq = color === 'w' ? state.castling.wQ : state.castling.bQ;
        if (ck && !board[rank][5] && !board[rank][6])
          moves.push({ from: [fr, fc], to: [rank, 6], isCastling: 'K' });
        if (cq && !board[rank][3] && !board[rank][2] && !board[rank][1])
          moves.push({ from: [fr, fc], to: [rank, 2], isCastling: 'Q' });
      }
      break;
  }
  return moves;
}

export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  const board = next.board;
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = board[fr][fc]!;

  board[tr][tc] = move.promotion ? { type: move.promotion, color: piece.color } : { ...piece };
  board[fr][fc] = null;

  if (move.isEnPassant) board[piece.color === 'w' ? tr + 1 : tr - 1][tc] = null;

  if (move.isCastling) {
    const rank = piece.color === 'w' ? 7 : 0;
    if (move.isCastling === 'K') { board[rank][5] = board[rank][7]; board[rank][7] = null; }
    else { board[rank][3] = board[rank][0]; board[rank][0] = null; }
  }

  if (piece.type === 'K') {
    if (piece.color === 'w') { next.castling.wK = false; next.castling.wQ = false; }
    else { next.castling.bK = false; next.castling.bQ = false; }
  }
  if (piece.type === 'R' || board[tr][tc]?.type === 'R') {
    if (fr === 7 && fc === 0) next.castling.wQ = false;
    if (fr === 7 && fc === 7) next.castling.wK = false;
    if (fr === 0 && fc === 0) next.castling.bQ = false;
    if (fr === 0 && fc === 7) next.castling.bK = false;
  }
  if (tr === 7 && tc === 0) next.castling.wQ = false;
  if (tr === 7 && tc === 7) next.castling.wK = false;
  if (tr === 0 && tc === 0) next.castling.bQ = false;
  if (tr === 0 && tc === 7) next.castling.bK = false;

  next.enPassant = (piece.type === 'P' && Math.abs(tr - fr) === 2) ? [(fr + tr) / 2, fc] : null;
  next.halfMove = (piece.type === 'P' || move.captured) ? 0 : next.halfMove + 1;
  if (piece.color === 'b') next.fullMove++;
  next.turn = opp(state.turn);
  return next;
}

export function getLegalMoves(state: GameState, fr: number, fc: number): Move[] {
  return pseudoLegal(state, fr, fc).filter(move => {
    if (move.isCastling) {
      const color = state.board[fr][fc]!.color;
      const rank = color === 'w' ? 7 : 0;
      const enemy = opp(color);
      if (isAttacked(state.board, rank, 4, enemy)) return false;
      if (isAttacked(state.board, rank, move.isCastling === 'K' ? 5 : 3, enemy)) return false;
    }
    const next = applyMove(state, move);
    const king = findKing(next.board, state.turn);
    return king ? !isAttacked(next.board, king[0], king[1], opp(state.turn)) : false;
  });
}

export function getAllLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (state.board[r][c]?.color === state.turn)
        moves.push(...getLegalMoves(state, r, c));
  return moves;
}

export function isInCheck(state: GameState, color: Color): boolean {
  const k = findKing(state.board, color);
  return k ? isAttacked(state.board, k[0], k[1], opp(color)) : false;
}
export function isCheckmate(state: GameState): boolean {
  return isInCheck(state, state.turn) && getAllLegalMoves(state).length === 0;
}
export function isStalemate(state: GameState): boolean {
  return !isInCheck(state, state.turn) && getAllLegalMoves(state).length === 0;
}

export function toSAN(state: GameState, move: Move): string {
  if (move.isCastling === 'K') return 'O-O';
  if (move.isCastling === 'Q') return 'O-O-O';
  const piece = state.board[move.from[0]][move.from[1]]!;
  let san = piece.type === 'P' ? '' : piece.type;
  if (piece.type !== 'P') {
    const ambig = getAllLegalMoves(state).filter(m => {
      const p = state.board[m.from[0]][m.from[1]];
      return p?.type === piece.type && p.color === piece.color &&
        !(m.from[0] === move.from[0] && m.from[1] === move.from[1]) &&
        m.to[0] === move.to[0] && m.to[1] === move.to[1];
    });
    if (ambig.length > 0) {
      if (!ambig.some(m => m.from[1] === move.from[1])) san += FILES[move.from[1]];
      else if (!ambig.some(m => m.from[0] === move.from[0])) san += (8 - move.from[0]);
      else san += FILES[move.from[1]] + (8 - move.from[0]);
    }
  }
  if (move.captured || move.isEnPassant) {
    if (piece.type === 'P') san += FILES[move.from[1]];
    san += 'x';
  }
  san += FILES[move.to[1]] + (8 - move.to[0]);
  if (move.promotion) san += '=' + move.promotion;
  const next = applyMove(state, move);
  if (isCheckmate(next)) san += '#';
  else if (isInCheck(next, next.turn)) san += '+';
  return san;
}

export function toFEN(state: GameState): string {
  const pos = state.board.map(row => {
    let s = ''; let e = 0;
    for (const sq of row) {
      if (!sq) { e++; continue; }
      if (e) { s += e; e = 0; }
      s += sq.color === 'w' ? sq.type : sq.type.toLowerCase();
    }
    if (e) s += e;
    return s;
  }).join('/');
  const c = [
    state.castling.wK ? 'K' : '', state.castling.wQ ? 'Q' : '',
    state.castling.bK ? 'k' : '', state.castling.bQ ? 'q' : '',
  ].join('') || '-';
  const ep = state.enPassant
    ? FILES[state.enPassant[1]] + (8 - state.enPassant[0])
    : '-';
  return `${pos} ${state.turn} ${c} ${ep} ${state.halfMove} ${state.fullMove}`;
}

export function fromFEN(fen: string): GameState {
  const [pos, turn, castling, ep, hm, fm] = fen.split(' ');
  const board: Board = pos.split('/').map(row => {
    const squares: Square[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) squares.push(null); }
      else { squares.push({ type: ch.toUpperCase() as PieceType, color: ch === ch.toUpperCase() ? 'w' : 'b' }); }
    }
    return squares;
  });
  const state: GameState = {
    board, turn: turn as Color,
    castling: { wK: castling.includes('K'), wQ: castling.includes('Q'), bK: castling.includes('k'), bQ: castling.includes('q') },
    enPassant: null,
    halfMove: +(hm ?? 0), fullMove: +(fm ?? 1),
  };
  if (ep && ep !== '-') {
    state.enPassant = [8 - +ep[1], FILES.indexOf(ep[0])];
  }
  return state;
}
