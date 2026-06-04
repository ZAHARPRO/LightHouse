// ──────────────────────────────────────────────────────────────────────────
// Durak (Russian card game) — pure game logic
// ──────────────────────────────────────────────────────────────────────────

export type Suit = "S" | "H" | "D" | "C"; // Spades Hearts Diamonds Clubs
export type Rank = "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "2" | "3" | "4" | "5";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface TableSlot {
  attack: Card;
  defense: Card | null;
}

export type Variant = "podkidnoy" | "perevodnoy";
export type ThrowRule = "all" | "neighbors";

export interface DurakState {
  deck: Card[];
  table: TableSlot[];
  discardCount: number;
  trumpCard: Card | null;
  trumpSuit: Suit;
  hands: Card[][];
  attackerIdx: number;
  defenderIdx: number;
  phase: "attack" | "defense" | "throwing" | "finished";
  outPlayers: Set<number>;
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];

// Rank ordering for the 36-card deck (6..A) and the 52-card deck (2..A)
const ORDER_36: Rank[] = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const ORDER_52: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const RANK_VALUE: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_IS_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false };

/** Numeric rank value used for comparisons. */
export function rankValue(rank: Rank): number {
  return RANK_VALUE[rank];
}

/** Compact string key for a card, e.g. "S-A". */
export function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Create and Fisher–Yates shuffle a deck of the given size. */
export function createDeck(deckSize: 36 | 52): Card[] {
  const ranks = deckSize === 52 ? ORDER_52 : ORDER_36;
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ranks) deck.push({ suit, rank });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Deal 6 cards to each player. The remaining deck's last card is the trump. */
export function dealCards(deck: Card[], playerCount: number): { hands: Card[][]; remaining: Card[] } {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  const remaining = [...deck];
  for (let c = 0; c < 6; c++) {
    for (let p = 0; p < playerCount; p++) {
      const card = remaining.shift();
      if (card) hands[p].push(card);
    }
  }
  return { hands, remaining };
}

/** Index of the player holding the lowest trump (becomes first attacker). */
export function findFirstAttacker(hands: Card[][], trumpSuit: Suit): number {
  let best = -1;
  let bestVal = Infinity;
  for (let p = 0; p < hands.length; p++) {
    for (const card of hands[p]) {
      if (card.suit === trumpSuit && rankValue(card.rank) < bestVal) {
        bestVal = rankValue(card.rank);
        best = p;
      }
    }
  }
  // No one has a trump → first seat attacks.
  return best === -1 ? 0 : best;
}

/** Ranks already present on the table (attack or defense). */
export function getThrowableRanks(table: TableSlot[]): Set<Rank> {
  const ranks = new Set<Rank>();
  for (const slot of table) {
    ranks.add(slot.attack.rank);
    if (slot.defense) ranks.add(slot.defense.rank);
  }
  return ranks;
}

/**
 * Can this card be played as an attack?
 * First attack: any card. Subsequent attacks/throws: rank must match a card on the table.
 */
export function canAttack(card: Card, table: TableSlot[]): boolean {
  if (table.length === 0) return true;
  return getThrowableRanks(table).has(card.rank);
}

/** Can `defense` beat `attack`? Higher of the same suit, or any trump over a non-trump. */
export function canDefend(attack: Card, defense: Card, trumpSuit: Suit): boolean {
  if (attack.suit === defense.suit) {
    return rankValue(defense.rank) > rankValue(attack.rank);
  }
  return defense.suit === trumpSuit && attack.suit !== trumpSuit;
}

/**
 * Переводной: can the defender transfer the attack to the next player?
 * Requires: variant is perevodnoy, every table slot is still undefended, the
 * transfer card's rank matches the attack rank already on the table, and the
 * next defender has enough cards to absorb the (now larger) attack.
 */
export function canTransfer(
  card: Card,
  table: TableSlot[],
  variant: Variant,
  nextDefenderHandSize: number,
): boolean {
  if (variant !== "perevodnoy") return false;
  if (table.length === 0) return false;
  // All cards on the table must be undefended attacks of the same rank.
  if (table.some((s) => s.defense !== null)) return false;
  const attackRank = table[0].attack.rank;
  if (card.rank !== attackRank) return false;
  // The next defender must be able to defend the resulting pile.
  return nextDefenderHandSize >= table.length + 1;
}

/** Next attacker after a bout resolves, skipping players who are out. */
export function nextAttacker(
  attackerIdx: number,
  defenderIdx: number,
  playerCount: number,
  outPlayers: Set<number>,
): number {
  // After a successful defense, the defender becomes the next attacker.
  let idx = defenderIdx;
  for (let i = 0; i < playerCount; i++) {
    if (!outPlayers.has(idx)) return idx;
    idx = (idx + 1) % playerCount;
  }
  return defenderIdx;
}

/** Index of the next active player after `idx` (clockwise), skipping out players. */
export function nextActive(idx: number, playerCount: number, outPlayers: Set<number>): number {
  let next = (idx + 1) % playerCount;
  for (let i = 0; i < playerCount; i++) {
    if (!outPlayers.has(next)) return next;
    next = (next + 1) % playerCount;
  }
  return idx;
}

/**
 * Replenish hands up to 6 after a bout. Order: attacker first, then the other
 * players clockwise, then the defender last. Players who are `out` are skipped.
 */
export function replenishHands(
  hands: Card[][],
  deck: Card[],
  attackerIdx: number,
  defenderIdx: number,
  outPlayers: Set<number>,
): { hands: Card[][]; deck: Card[] } {
  const newHands = hands.map((h) => [...h]);
  const newDeck = [...deck];
  const playerCount = hands.length;

  const order: number[] = [];
  let idx = attackerIdx;
  for (let i = 0; i < playerCount; i++) {
    if (idx !== defenderIdx && !outPlayers.has(idx)) order.push(idx);
    idx = (idx + 1) % playerCount;
  }
  if (!outPlayers.has(defenderIdx)) order.push(defenderIdx);

  for (const p of order) {
    while (newHands[p].length < 6 && newDeck.length > 0) {
      const card = newDeck.shift();
      if (card) newHands[p].push(card);
    }
  }
  return { hands: newHands, deck: newDeck };
}

/**
 * After replenishment, players with no cards and an empty deck are out.
 * Returns the durak (last player still holding cards) when only one remains.
 */
export function checkWinCondition(
  hands: Card[][],
  deck: Card[],
  outPlayers: Set<number>,
): { durak: number | null; gameOver: boolean } {
  if (deck.length > 0) return { durak: null, gameOver: false };

  const withCards: number[] = [];
  for (let p = 0; p < hands.length; p++) {
    if (!outPlayers.has(p) && hands[p].length > 0) withCards.push(p);
  }

  const activeCount = hands.length - outPlayers.size;
  if (activeCount <= 1) {
    // Only one (or zero) active player remains.
    return { durak: withCards[0] ?? null, gameOver: true };
  }
  if (withCards.length <= 1) {
    return { durak: withCards[0] ?? null, gameOver: true };
  }
  return { durak: null, gameOver: false };
}

/**
 * Can this player throw in cards during a bout (not the opening attack)?
 * "all": any non-defender, non-out player may throw.
 * "neighbors": only the main attacker and the nearest non-out player on each
 * side of the defender may throw.
 */
export function canThrowIn(
  throwerIdx: number,
  attackerIdx: number,
  defenderIdx: number,
  playerCount: number,
  outPlayers: Set<number>,
  throwRule: ThrowRule,
): boolean {
  if (throwerIdx === defenderIdx || outPlayers.has(throwerIdx)) return false;
  if (throwRule === "all") return true;
  if (throwerIdx === attackerIdx) return true;
  // Find the nearest eligible neighbor on each side of the defender
  let left = (defenderIdx - 1 + playerCount) % playerCount;
  for (let i = 0; i < playerCount - 1; i++) {
    if (!outPlayers.has(left) && left !== defenderIdx) break;
    left = (left - 1 + playerCount) % playerCount;
  }
  let right = (defenderIdx + 1) % playerCount;
  for (let i = 0; i < playerCount - 1; i++) {
    if (!outPlayers.has(right) && right !== defenderIdx) break;
    right = (right + 1) % playerCount;
  }
  return throwerIdx === left || throwerIdx === right;
}

/** Whether the defender has successfully beaten every attack on the table. */
export function isFullyDefended(table: TableSlot[]): boolean {
  return table.length > 0 && table.every((s) => s.defense !== null);
}

/** Maximum attacks allowed on the table (6, or fewer if the defender is short). */
export function maxAttackCards(defenderHandSize: number): number {
  return Math.min(6, defenderHandSize);
}
