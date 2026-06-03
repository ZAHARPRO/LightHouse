// Stateful Durak engine: loads a room, applies a move, resolves bouts/timeouts,
// persists, and finalizes ELO. Kept separate from pure logic in lib/durak.ts.

import { prisma } from "@/lib/prisma";
import {
  type Card,
  type TableSlot,
  type Variant,
  type Suit,
  canAttack,
  canDefend,
  canTransfer,
  isFullyDefended,
  maxAttackCards,
  replenishHands,
  checkWinCondition,
  nextActive,
  cardsEqual,
} from "@/lib/durak";
import { finalizeRatedDurak, roomInclude } from "@/lib/durak-room";

type SlotRow = {
  id: string;
  userId: string;
  seatIdx: number;
  handJson: string;
  timeMs: number | null;
  isOut: boolean;
};

type RoomRow = {
  id: string;
  status: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  timeControl: string;
  rated: boolean;
  deckJson: string;
  tableJson: string;
  discardCount: number;
  trumpSuit: string | null;
  attackerIdx: number;
  defenderIdx: number;
  phase: string;
  lastMoveAt: Date | null;
  winner: string | null;
  players: SlotRow[];
};

type Mutable = {
  hands: Card[][];
  deck: Card[];
  table: TableSlot[];
  discardCount: number;
  attackerIdx: number;
  defenderIdx: number;
  phase: "attack" | "defense" | "throwing" | "finished";
  outPlayers: Set<number>;
};

function parse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Build the in-memory game state from a room row (seat-indexed hands). */
function loadState(room: RoomRow): Mutable {
  const playerCount = room.maxPlayers;
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  const outPlayers = new Set<number>();
  for (const slot of room.players) {
    hands[slot.seatIdx] = parse<Card[]>(slot.handJson, []);
    if (slot.isOut) outPlayers.add(slot.seatIdx);
  }
  return {
    hands,
    deck: parse<Card[]>(room.deckJson, []),
    table: parse<TableSlot[]>(room.tableJson, []),
    discardCount: room.discardCount,
    attackerIdx: room.attackerIdx,
    defenderIdx: room.defenderIdx,
    phase: room.phase as Mutable["phase"],
    outPlayers,
  };
}

/** Number of seats actually used (some may be empty if room not full). */
function seatCount(room: RoomRow): number {
  return room.maxPlayers;
}

/**
 * Resolve the bout when the defender has either taken cards or every attack is
 * beaten. Mutates `state`: clears table, replenishes hands, marks out players,
 * advances attacker/defender, and sets winner if the game is over.
 */
function resolveBout(room: RoomRow, state: Mutable, defenderTook: boolean): string | null {
  const playerCount = seatCount(room);

  if (defenderTook) {
    // Defender picks up every card on the table.
    const picked: Card[] = [];
    for (const slot of state.table) {
      picked.push(slot.attack);
      if (slot.defense) picked.push(slot.defense);
    }
    state.hands[state.defenderIdx].push(...picked);
  } else {
    // Successful defense: everything goes to the discard pile.
    for (const slot of state.table) {
      state.discardCount += slot.defense ? 2 : 1;
    }
  }
  state.table = [];

  // Replenish hands (attacker first, defender last) from the deck.
  const { hands, deck } = replenishHands(
    state.hands,
    state.deck,
    state.attackerIdx,
    state.defenderIdx,
    state.outPlayers,
  );
  state.hands = hands;
  state.deck = deck;

  // Mark players who ran out of cards (deck empty) as out.
  if (state.deck.length === 0) {
    for (let p = 0; p < playerCount; p++) {
      if (!state.outPlayers.has(p) && state.hands[p].length === 0 && room.players.some((s) => s.seatIdx === p)) {
        state.outPlayers.add(p);
      }
    }
  }

  const { durak, gameOver } = checkWinCondition(state.hands, state.deck, withEmptySeatsOut(room, state));
  if (gameOver) {
    state.phase = "finished";
    return durak != null ? room.players.find((p) => p.seatIdx === durak)?.userId ?? null : null;
  }

  // Next attacker: if the defender took the cards, the player after them attacks;
  // otherwise (successful defense) the defender becomes the new attacker.
  const newAttacker = defenderTook
    ? nextActive(state.defenderIdx, playerCount, state.outPlayers)
    : state.outPlayers.has(state.defenderIdx)
      ? nextActive(state.defenderIdx, playerCount, state.outPlayers)
      : state.defenderIdx;

  state.attackerIdx = newAttacker;
  state.defenderIdx = nextActive(newAttacker, playerCount, state.outPlayers);
  state.phase = "attack";
  return null;
}

/** Treat empty (unoccupied) seats as "out" so win detection ignores them. */
function withEmptySeatsOut(room: RoomRow, state: Mutable): Set<number> {
  const occupied = new Set(room.players.map((p) => p.seatIdx));
  const out = new Set(state.outPlayers);
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!occupied.has(i)) out.add(i);
  }
  return out;
}

/** Persist the mutated state back to the room + slots. */
async function persist(room: RoomRow, state: Mutable, winnerUserId: string | null): Promise<void> {
  const ops: Array<Promise<unknown>> = [];
  for (const slot of room.players) {
    ops.push(
      prisma.durakPlayerSlot.update({
        where: { id: slot.id },
        data: {
          handJson: JSON.stringify(state.hands[slot.seatIdx] ?? []),
          isOut: state.outPlayers.has(slot.seatIdx),
        },
      }),
    );
  }

  const finished = state.phase === "finished";
  ops.push(
    prisma.durakRoom.update({
      where: { id: room.id },
      data: {
        deckJson: JSON.stringify(state.deck),
        tableJson: JSON.stringify(state.table),
        discardCount: state.discardCount,
        attackerIdx: state.attackerIdx,
        defenderIdx: state.defenderIdx,
        phase: state.phase,
        lastMoveAt: new Date(),
        ...(finished ? { status: "FINISHED", winner: winnerUserId, endedAt: new Date(), pendingCheatJson: null } : {}),
      },
    }),
  );
  await Promise.all(ops);

  if (finished && room.rated && winnerUserId) {
    const durakSeat = room.players.find((p) => p.userId === winnerUserId)?.seatIdx;
    if (durakSeat != null) await finalizeRatedDurak(room.id, durakSeat);
  }
}

export type MoveAction = "attack" | "defend" | "throw" | "transfer" | "take" | "pass";

export interface MoveInput {
  action: MoveAction;
  card?: Card;
  attackSlotIdx?: number;
}

export interface MoveResult {
  ok: boolean;
  error?: string;
}

/** Apply a player's move. Returns an error string if the move is illegal. */
export async function applyMove(roomId: string, userId: string, input: MoveInput): Promise<MoveResult> {
  const room = (await prisma.durakRoom.findUnique({ where: { id: roomId }, include: roomInclude })) as RoomRow | null;
  if (!room) return { ok: false, error: "Not found" };
  if (room.status !== "PLAYING") return { ok: false, error: "Not playing" };

  const mySlot = room.players.find((p) => p.userId === userId);
  if (!mySlot) return { ok: false, error: "Not a player" };
  const mySeat = mySlot.seatIdx;

  const state = loadState(room);
  const trumpSuit = (room.trumpSuit ?? "S") as Suit;
  const variant = room.variant as Variant;
  let winnerUserId: string | null = null;

  const isAttackerSide = mySeat !== state.defenderIdx && !state.outPlayers.has(mySeat);
  const handHas = (c: Card) => state.hands[mySeat].some((x) => cardsEqual(x, c));
  const removeFromHand = (c: Card) => {
    const i = state.hands[mySeat].findIndex((x) => cardsEqual(x, c));
    if (i >= 0) state.hands[mySeat].splice(i, 1);
  };

  switch (input.action) {
    case "attack":
    case "throw": {
      if (!isAttackerSide) return { ok: false, error: "Not attacking" };
      if (state.outPlayers.has(state.defenderIdx)) return { ok: false, error: "No defender" };
      const card = input.card;
      if (!card || !handHas(card)) return { ok: false, error: "No such card" };
      // The very first card of a bout may only be played by the main attacker.
      if (state.table.length === 0 && mySeat !== state.attackerIdx) {
        return { ok: false, error: "Wait for attacker" };
      }
      if (!canAttack(card, state.table)) return { ok: false, error: "Illegal attack" };
      // Cap total attacks at 6, and never exceed what the defender can still beat:
      // the number of undefended attacks must not surpass the defender's hand size.
      const defenderHand = state.hands[state.defenderIdx].length;
      const undefended = state.table.filter((s) => !s.defense).length;
      if (state.table.length >= 6 || undefended >= maxAttackCards(defenderHand)) {
        return { ok: false, error: "Table full" };
      }
      removeFromHand(card);
      state.table.push({ attack: card, defense: null });
      state.phase = "defense";
      break;
    }

    case "transfer": {
      if (mySeat !== state.defenderIdx) return { ok: false, error: "Not defender" };
      const card = input.card;
      if (!card || !handHas(card)) return { ok: false, error: "No such card" };
      const nextDef = nextActive(state.defenderIdx, seatCount(room), state.outPlayers);
      if (!canTransfer(card, state.table, variant, state.hands[nextDef].length)) {
        return { ok: false, error: "Cannot transfer" };
      }
      removeFromHand(card);
      state.table.push({ attack: card, defense: null });
      // The attack now passes to the next player; current defender becomes attacker.
      state.attackerIdx = state.defenderIdx;
      state.defenderIdx = nextDef;
      state.phase = "defense";
      break;
    }

    case "defend": {
      if (mySeat !== state.defenderIdx) return { ok: false, error: "Not defender" };
      const card = input.card;
      const slotIdx = input.attackSlotIdx;
      if (!card || !handHas(card)) return { ok: false, error: "No such card" };
      if (slotIdx == null || !state.table[slotIdx] || state.table[slotIdx].defense) {
        return { ok: false, error: "Bad slot" };
      }
      if (!canDefend(state.table[slotIdx].attack, card, trumpSuit)) {
        return { ok: false, error: "Cannot beat" };
      }
      removeFromHand(card);
      state.table[slotIdx].defense = card;
      break;
    }

    case "take": {
      if (mySeat !== state.defenderIdx) return { ok: false, error: "Not defender" };
      if (state.table.length === 0) return { ok: false, error: "Nothing to take" };
      winnerUserId = resolveBout(room, state, true);
      break;
    }

    case "pass": {
      // An attacker signals "done". Resolve only when the table is fully beaten.
      if (!isAttackerSide) return { ok: false, error: "Not attacking" };
      if (state.table.length === 0) return { ok: false, error: "Nothing to pass" };
      if (!isFullyDefended(state.table)) return { ok: false, error: "Defender still defending" };
      winnerUserId = resolveBout(room, state, false);
      break;
    }

    default:
      return { ok: false, error: "Unknown action" };
  }

  await persist(room, state, winnerUserId);
  return { ok: true };
}

/**
 * Apply move-time expiry. If the current player's timer is exhausted, force a
 * "take" (defender) or "pass"-equivalent resolution (attacker). Returns true if
 * anything changed. Timers are tracked coarsely via lastMoveAt vs timeControl.
 */
export async function resolveTimeouts(room: RoomRow): Promise<boolean> {
  if (room.status !== "PLAYING" || room.timeControl === "none" || !room.lastMoveAt) return false;
  const perMove = parseInt(room.timeControl, 10) * 1000;
  const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
  if (elapsed < perMove) return false;

  const state = loadState(room);
  let winnerUserId: string | null = null;

  if (state.phase === "defense" && !isFullyDefended(state.table)) {
    // Defender ran out of time → takes the cards.
    winnerUserId = resolveBout(room, state, true);
  } else if (state.table.length > 0 && isFullyDefended(state.table)) {
    // Attackers ran out of time after a full defense → bout ends, discard.
    winnerUserId = resolveBout(room, state, false);
  } else {
    // Idle attack phase with nothing on the table — just advance the turn.
    state.attackerIdx = nextActive(state.attackerIdx, seatCount(room), state.outPlayers);
    state.defenderIdx = nextActive(state.attackerIdx, seatCount(room), state.outPlayers);
  }

  await persist(room, state, winnerUserId);
  return true;
}
