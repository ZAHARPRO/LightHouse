// Checkers (Russian rules) game logic
// Board: 8x8, pieces on dark squares where (row + col) % 2 === 1
// White starts rows 0-2 (moves downward, row+)
// Black starts rows 5-7 (moves upward, row-)
// Kings (W/B) can move in all 4 diagonal directions
// Mandatory capture rule; multi-jump enforced via mustJumpFrom

export type Cell   = "w" | "W" | "b" | "B" | null;
export type Board  = Cell[][];
export type Color  = "w" | "b";
export type Move   = { from: [number, number]; to: [number, number]; captured: [number, number] | null };

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function opp(color: Color): Color { return color === "w" ? "b" : "w"; }
function colorOf(cell: Cell): Color | null {
  if (cell === "w" || cell === "W") return "w";
  if (cell === "b" || cell === "B") return "b";
  return null;
}
function isKing(cell: Cell) { return cell === "W" || cell === "B"; }
function dirs(color: Color, king: boolean): [number, number][] {
  if (king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return color === "w" ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
}

export function initialBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null) as Cell[]);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) {
        if (r < 3) b[r][c] = "w";
        else if (r > 4) b[r][c] = "b";
      }
  return b;
}

const ALL_DIAGS: [number, number][] = [[-1,-1],[-1,1],[1,-1],[1,1]];

// All pieces (including regular) can capture in all 4 diagonal directions
function capturesForPiece(board: Board, r: number, c: number): Move[] {
  const piece = board[r][c];
  if (!piece) return [];
  const color = colorOf(piece)!;
  const moves: Move[] = [];
  for (const [dr, dc] of ALL_DIAGS) {
    const mr = r + dr, mc = c + dc, tr = r + 2*dr, tc = c + 2*dc;
    if (!inBounds(tr, tc)) continue;
    const mid = board[mr][mc];
    if (mid && colorOf(mid) === opp(color) && board[tr][tc] === null)
      moves.push({ from: [r,c], to: [tr,tc], captured: [mr,mc] });
  }
  return moves;
}

export function getLegalMoves(board: Board, color: Color, mustJumpFrom?: [number,number] | null): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (colorOf(board[r][c]) !== color) continue;
      // Mid-chain: only the jumping piece can move, and only captures
      if (mustJumpFrom) {
        if (mustJumpFrom[0] !== r || mustJumpFrom[1] !== c) continue;
        moves.push(...capturesForPiece(board, r, c));
      } else {
        moves.push(...capturesForPiece(board, r, c));
        const piece = board[r][c]!;
        for (const [dr, dc] of dirs(color, isKing(piece))) {
          const tr = r+dr, tc = c+dc;
          if (inBounds(tr, tc) && board[tr][tc] === null)
            moves.push({ from: [r,c], to: [tr,tc], captured: null });
        }
      }
    }
  }
  return moves;
}

export function applyMove(board: Board, move: Move): { board: Board; promoted: boolean } {
  const nb = board.map(row => [...row]) as Board;
  const [fr, fc] = move.from, [tr, tc] = move.to;
  const piece = nb[fr][fc]!;
  nb[fr][fc] = null;
  if (move.captured) nb[move.captured[0]][move.captured[1]] = null;
  let promoted = false;
  if (piece === "w" && tr === 7) { nb[tr][tc] = "W"; promoted = true; }
  else if (piece === "b" && tr === 0) { nb[tr][tc] = "B"; promoted = true; }
  else nb[tr][tc] = piece;
  return { board: nb, promoted };
}

export function canContinueJump(board: Board, r: number, c: number): boolean {
  return capturesForPiece(board, r, c).length > 0;
}

export function countPieces(board: Board, color: Color): number {
  let n = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (colorOf(board[r][c]) === color) n++;
  return n;
}

export function isGameOver(board: Board, nextTurn: Color): { over: boolean; winner: Color | null } {
  if (countPieces(board, nextTurn) === 0 || getLegalMoves(board, nextTurn).length === 0)
    return { over: true, winner: opp(nextTurn) };
  return { over: false, winner: null };
}

export function boardToJson(board: Board): string { return JSON.stringify(board); }
export function boardFromJson(s: string): Board  { return JSON.parse(s) as Board; }
