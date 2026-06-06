// Stateful Durak engine: loads a room, applies a move, resolves bouts/timeouts,
// persists, and finalizes ELO. Kept separate from pure logic in lib/durak.ts.

import { prisma } from "@/lib/prisma";
import {
  type Card,
  type TableSlot,
  type Variant,
  type Suit,
  type ThrowRule,
  canAttack,
  canDefend,
  canTransfer,
  canThrowIn,
  isFullyDefended,
  maxAttackCards,
  replenishHands,
  checkWinCondition,
  nextActive,
  cardsEqual,
} from "@/lib/durak";
import { finalizeRatedDurak, roomInclude } from "@/lib/durak-room";
import { awardBadge } from "@/lib/awardBadge";
import { getBotAction, type BotDifficulty, type ClientBotState } from "@/lib/durak-bot";
import { broadcast } from "@/lib/durak-sse";

const BOT_TURN_DELAY_MS = 750; // ms between consecutive bot turns

type SlotRow = {
  id: string;
  userId: string;
  seatIdx: number;
  handJson: string;
  timeMs: number | null;
  isOut: boolean;
  finishPosition: number | null;
};

export type BotSlotData = {
  seatIdx: number;
  difficulty: BotDifficulty;
  handJson: string;
  isOut: boolean;
};

type RoomRow = {
  id: string;
  status: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  timeControl: string;
  throwRule: string;
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
  finishCount: number;
  botsJson: string;
  movesJson: string;
  players: SlotRow[];
};

function parseBots(botsJson: string): BotSlotData[] {
  try { return JSON.parse(botsJson) as BotSlotData[]; } catch { return []; }
}

function isBotSeat(room: RoomRow, seatIdx: number): boolean {
  return parseBots(room.botsJson).some((b) => b.seatIdx === seatIdx);
}

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
  // Real player slots
  for (const slot of room.players) {
    hands[slot.seatIdx] = parse<Card[]>(slot.handJson, []);
    if (slot.isOut) outPlayers.add(slot.seatIdx);
  }
  // Bot slots
  for (const bot of parseBots(room.botsJson)) {
    hands[bot.seatIdx] = parse<Card[]>(bot.handJson, []);
    if (bot.isOut) outPlayers.add(bot.seatIdx);
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
 * Returns the seat indices of players who are eligible to throw cards in
 * the throwing phase — i.e. everyone except the defender, the main attacker
 * who already passed, and players who are already out.
 */
function getEligibleThrowerSeats(room: RoomRow, state: Mutable): number[] {
  const allSeats = [
    ...room.players.map((p) => p.seatIdx),
    ...parseBots(room.botsJson).map((b) => b.seatIdx),
  ];
  return allSeats.filter(
    (s) =>
      s !== state.defenderIdx &&
      s !== state.attackerIdx && // main attacker already passed
      !state.outPlayers.has(s),
    // No hand-size check — throwing phase starts for all eligible seats regardless
    // of whether they have throwable cards, to avoid leaking hand info to opponents.
  );
}

/** Returns true if no bout has resolved yet (first defense round of the game). */
function isFirstBout(movesJson: string): boolean {
  try {
    const moves = JSON.parse(movesJson) as Array<{ action: string }>;
    return !moves.some((m) => m.action === "pass" || m.action === "take");
  } catch {
    return true;
  }
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
    const occupiedSeats = new Set([
      ...room.players.map((s) => s.seatIdx),
      ...parseBots(room.botsJson).map((b) => b.seatIdx),
    ]);
    for (let p = 0; p < playerCount; p++) {
      if (!state.outPlayers.has(p) && state.hands[p].length === 0 && occupiedSeats.has(p)) {
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
  const botSeats = new Set(parseBots(room.botsJson).map((b) => b.seatIdx));
  const occupied = new Set([...room.players.map((p) => p.seatIdx), ...botSeats]);
  const out = new Set(state.outPlayers);
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!occupied.has(i)) out.add(i);
  }
  return out;
}

/** Persist the mutated state back to the room + slots. */
async function persist(room: RoomRow, state: Mutable, winnerUserId: string | null, move?: MoveRecord): Promise<void> {
  const ops: Array<Promise<unknown>> = [];
  // Track finish positions for players who newly went out this turn
  let finishCount = room.finishCount;
  for (const slot of room.players) {
    const wasOut = slot.isOut;
    const isNowOut = state.outPlayers.has(slot.seatIdx);
    const newlyOut = !wasOut && isNowOut;
    if (newlyOut) finishCount++;
    ops.push(
      prisma.durakPlayerSlot.update({
        where: { id: slot.id },
        data: {
          handJson: JSON.stringify(state.hands[slot.seatIdx] ?? []),
          isOut: isNowOut,
          ...(newlyOut && slot.finishPosition == null ? { finishPosition: finishCount } : {}),
        },
      }),
    );
  }
  // Bot slots — write back updated hands/isOut into botsJson
  const updatedBots = parseBots(room.botsJson).map((b) => ({
    ...b,
    handJson: JSON.stringify(state.hands[b.seatIdx] ?? []),
    isOut: state.outPlayers.has(b.seatIdx),
  }));

  const finished = state.phase === "finished";

  let newMovesJson = room.movesJson ?? "[]";
  if (move) {
    try {
      const arr = JSON.parse(newMovesJson) as MoveRecord[];
      arr.push(move);
      newMovesJson = JSON.stringify(arr);
    } catch { newMovesJson = JSON.stringify([move]); }
  }

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
        finishCount,
        botsJson: JSON.stringify(updatedBots),
        movesJson: newMovesJson,
        ...(finished ? { status: "FINISHED", winner: winnerUserId, endedAt: new Date(), pendingCheatJson: null } : {}),
      },
    }),
  );
  await Promise.all(ops);

  if (finished && winnerUserId) {
    const durakIsBot = isBotSeat(room, room.players.find((p) => p.userId === winnerUserId)?.seatIdx ?? -1);

    // Award online-win badge to all real-player winners (non-durak, non-bot)
    const winners = room.players.filter((p) => p.userId !== winnerUserId);
    for (const w of winners) {
      await awardBadge(prisma, w.userId, "DURAK_ONLINE_WIN");
    }

    if (!durakIsBot) {
      if (room.rated) {
        // Rated: full ELO + badge finalization (includes ELO rank badges)
        const durakSeat = room.players.find((p) => p.userId === winnerUserId)?.seatIdx;
        if (durakSeat != null) await finalizeRatedDurak(room.id, durakSeat);
      }
    }
  }
}

export type MoveRecord = {
  seq: number;
  action: string;
  seatIdx: number;
  name: string | null;
  card?: Card;
  slotIdx?: number;
  at: number;
};

export type MoveAction = "attack" | "defend" | "throw" | "transfer" | "take" | "pass" | "resign";

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
      // In throwing phase the main attacker has already passed — they cannot throw more.
      if (state.phase === "throwing" && mySeat === state.attackerIdx) {
        return { ok: false, error: "Attacker already passed" };
      }
      if (state.outPlayers.has(state.defenderIdx)) return { ok: false, error: "No defender" };
      const card = input.card;
      if (!card || !handHas(card)) return { ok: false, error: "No such card" };
      // The very first card of a bout may only be played by the main attacker.
      if (state.table.length === 0 && mySeat !== state.attackerIdx) {
        return { ok: false, error: "Wait for attacker" };
      }
      // Throw-in (not the opening attack): enforce throwRule
      if (state.table.length > 0 && mySeat !== state.attackerIdx) {
        const throwRule = (room.throwRule ?? "all") as ThrowRule;
        if (!canThrowIn(mySeat, state.attackerIdx, state.defenderIdx, room.maxPlayers, state.outPlayers, throwRule)) {
          return { ok: false, error: "Not allowed to throw" };
        }
      }
      if (!canAttack(card, state.table)) return { ok: false, error: "Illegal attack" };
      // First bout: max 5 cards. Subsequent bouts: max 6 (or defender hand size).
      const firstBout = isFirstBout(room.movesJson);
      const boutMax = firstBout ? 5 : 6;
      const defenderHand = state.hands[state.defenderIdx].length;
      const undefended = state.table.filter((s) => !s.defense).length;
      if (state.table.length >= boutMax || undefended >= maxAttackCards(defenderHand)) {
        return { ok: false, error: "Table full" };
      }
      removeFromHand(card);
      state.table.push({ attack: card, defense: null });
      // Stay in "throwing" phase if we're already there; otherwise enter "defense".
      state.phase = state.phase === "throwing" ? "throwing" : "defense";
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

      if (state.phase === "throwing") {
        // Already in throwing phase — any pass immediately resolves the bout.
        winnerUserId = resolveBout(room, state, false);
      } else if (mySeat === state.attackerIdx) {
        // Main attacker pressing pass: check if other players can still throw.
        const firstBout = isFirstBout(room.movesJson);
        const boutMax = firstBout ? 5 : 6;
        const defHand = state.hands[state.defenderIdx]?.length ?? 0;
        const hasRoom =
          state.table.length < boutMax &&
          state.table.length < maxAttackCards(defHand);
        const eligibleThrowers = getEligibleThrowerSeats(room, state);

        if (hasRoom && eligibleThrowers.length > 0) {
          // Enter throwing phase: other players get timer to throw additional cards.
          state.phase = "throwing";
        } else {
          winnerUserId = resolveBout(room, state, false);
        }
      } else {
        // Non-main-attacker pressing pass outside throwing phase → resolve.
        winnerUserId = resolveBout(room, state, false);
      }
      break;
    }

    case "resign": {
      // Player concedes — they become the Durak immediately.
      state.phase = "finished";
      winnerUserId = userId;
      break;
    }

    default:
      return { ok: false, error: "Unknown action" };
  }

  const existingMoves = (() => { try { return (JSON.parse(room.movesJson ?? "[]") as MoveRecord[]).length; } catch { return 0; } })();
  const moveRecord: MoveRecord = {
    seq: existingMoves + 1,
    action: input.action,
    seatIdx: mySeat,
    name: mySlot ? null : null, // name resolved client-side
    card: input.card,
    slotIdx: input.attackSlotIdx,
    at: Date.now(),
  };
  await persist(room, state, winnerUserId, moveRecord);
  return { ok: true };
}

/**
 * Process all consecutive bot turns after a human (or previous bot) move.
 * Called after applyMove / start so bots act immediately without a separate poll.
 */
export async function processBotTurns(roomId: string): Promise<void> {
  const MAX_BOT_TURNS = 30; // safety cap to prevent infinite loops
  for (let i = 0; i < MAX_BOT_TURNS; i++) {
    const room = await prisma.durakRoom.findUnique({
      where: { id: roomId },
      include: roomInclude,
    }) as RoomRow | null;
    if (!room || room.status !== "PLAYING") return;

    const bots = parseBots(room.botsJson);
    if (bots.length === 0) return;

    const state = loadState(room);
    if (state.phase === "finished") return;

    // Which seat needs to act?
    const needsDefense = state.table.some((s) => !s.defense);
    let actingSeat: number;

    if (state.phase === "throwing") {
      if (needsDefense) {
        // A thrower placed a card — defender must beat it.
        actingSeat = state.defenderIdx;
      } else {
        // All defended in throwing phase — find the first eligible bot thrower.
        const eligible = getEligibleThrowerSeats(room, state);
        const throwerBot = bots.find((b) => eligible.includes(b.seatIdx));
        if (!throwerBot) return; // Only humans can throw; timer will resolve.
        // Bot passes in throwing phase → resolve the bout immediately.
        const existingLen2 = (() => {
          try { return (JSON.parse(room.movesJson ?? "[]") as MoveRecord[]).length; } catch { return 0; }
        })();
        const passRecord: MoveRecord = {
          seq: existingLen2 + 1,
          action: "pass",
          seatIdx: throwerBot.seatIdx,
          name: null,
          at: Date.now(),
        };
        const win2 = resolveBout(room, state, false);
        await persist(room, state, win2, passRecord);
        broadcast(roomId, { type: "update" });
        return; // Bout resolved.
      }
    } else {
      // Normal attack/defense phases.
      // When in defense phase but all cards are already beaten, the ATTACKER
      // needs to act next (pass or throw more) — not the defender.
      actingSeat = needsDefense ? state.defenderIdx : state.attackerIdx;
    }

    const actingBot = bots.find((b) => b.seatIdx === actingSeat);
    if (!actingBot) return; // human's turn

    const trumpSuit = (room.trumpSuit ?? "S") as Suit;
    const variant = room.variant as Variant;

    // Build ClientBotState for the bot
    const allSeats = [...room.players.map((p) => p.seatIdx), ...bots.map((b) => b.seatIdx)];
    const opponentCardCounts = allSeats
      .filter((s) => s !== actingSeat)
      .map((s) => state.hands[s]?.length ?? 0);

    // Map the real phase to what the bot decision function expects.
    // - undefended cards exist → "defense" (defender must beat them)
    // - all cards defended (any phase) → "attack" (attacker/thrower decides to throw more or pass)
    const allDefendedNow = state.table.length > 0 && !needsDefense;
    const effectivePhase: ClientBotState["phase"] = needsDefense
      ? "defense"
      : allDefendedNow || state.phase === "throwing"
        ? "attack"
        : state.phase as ClientBotState["phase"];

    const botState: ClientBotState = {
      hand: state.hands[actingSeat] ?? [],
      tableSlots: state.table,
      deckCount: state.deck.length,
      trumpSuit,
      opponentCardCounts,
      phase: effectivePhase,
      attackerIdx: state.attackerIdx,
      defenderIdx: state.defenderIdx,
      myIdx: actingSeat,
      variant,
    };

    const action = getBotAction(botState, actingBot.difficulty as BotDifficulty);
    let winnerUserId: string | null = null;

    switch (action.action) {
      case "attack":
      case "throw": {
        if (!action.card) break;
        if (!canAttack(action.card, state.table)) break;
        const botFirstBout = isFirstBout(room.movesJson);
        const botBoutMax = botFirstBout ? 5 : 6;
        const defHand = state.hands[state.defenderIdx]?.length ?? 0;
        const undefended = state.table.filter((s) => !s.defense).length;
        if (state.table.length >= botBoutMax || undefended >= maxAttackCards(defHand)) break;
        if (state.table.length === 0 && actingSeat !== state.attackerIdx) break; // must be main attacker
        // Throw-in: enforce throwRule
        if (state.table.length > 0 && actingSeat !== state.attackerIdx) {
          const throwRule = (room.throwRule ?? "all") as ThrowRule;
          if (!canThrowIn(actingSeat, state.attackerIdx, state.defenderIdx, room.maxPlayers, state.outPlayers, throwRule)) break;
        }
        const idx = (state.hands[actingSeat] ?? []).findIndex((c) => cardsEqual(c, action.card!));
        if (idx < 0) break;
        state.hands[actingSeat].splice(idx, 1);
        state.table.push({ attack: action.card, defense: null });
        // Stay in "throwing" phase if we're already there (same as applyMove).
        state.phase = state.phase === "throwing" ? "throwing" : "defense";
        break;
      }
      case "defend": {
        const slot = state.table[action.slotIdx ?? 0];
        if (!slot || slot.defense || !action.card) break;
        if (!canDefend(slot.attack, action.card, trumpSuit)) break;
        const idx = (state.hands[actingSeat] ?? []).findIndex((c) => cardsEqual(c, action.card!));
        if (idx < 0) break;
        state.hands[actingSeat].splice(idx, 1);
        state.table[action.slotIdx ?? 0] = { ...slot, defense: action.card };
        break;
      }
      case "transfer": {
        if (!action.card) break;
        const nextDef = nextActive(state.defenderIdx, room.maxPlayers, state.outPlayers);
        if (!canTransfer(action.card, state.table, variant, state.hands[nextDef]?.length ?? 0)) break;
        const idx = (state.hands[actingSeat] ?? []).findIndex((c) => cardsEqual(c, action.card!));
        if (idx < 0) break;
        state.hands[actingSeat].splice(idx, 1);
        state.table.push({ attack: action.card, defense: null });
        state.attackerIdx = state.defenderIdx;
        state.defenderIdx = nextDef;
        state.phase = "defense";
        break;
      }
      case "take": {
        winnerUserId = resolveBout(room, state, true);
        break;
      }
      case "pass": {
        if (state.table.length === 0) { state.phase = "attack"; break; }
        if (!isFullyDefended(state.table)) { state.phase = "attack"; break; }

        if (state.phase === "throwing") {
          // Already in throwing phase — bot pass resolves the bout.
          winnerUserId = resolveBout(room, state, false);
        } else if (actingSeat === state.attackerIdx) {
          // Main attacker passing — enter throwing phase if eligible throwers exist.
          const botFirstBout2 = isFirstBout(room.movesJson);
          const botBoutMax2 = botFirstBout2 ? 5 : 6;
          const defHand2 = state.hands[state.defenderIdx]?.length ?? 0;
          const hasRoom2 =
            state.table.length < botBoutMax2 &&
            state.table.length < maxAttackCards(defHand2);
          const eligible2 = getEligibleThrowerSeats(room, state);
          if (hasRoom2 && eligible2.length > 0) {
            state.phase = "throwing";
          } else {
            winnerUserId = resolveBout(room, state, false);
          }
        } else {
          winnerUserId = resolveBout(room, state, false);
        }
        break;
      }
    }

    const existingLen = (() => { try { return (JSON.parse(room.movesJson ?? "[]") as MoveRecord[]).length; } catch { return 0; } })();
    const botMoveRecord: MoveRecord = {
      seq: existingLen + 1,
      action: action.action,
      seatIdx: actingSeat,
      name: null,
      card: "card" in action ? action.card : undefined,
      slotIdx: "slotIdx" in action ? action.slotIdx : undefined,
      at: Date.now(),
    };
    await persist(room, state, winnerUserId, botMoveRecord);
    broadcast(roomId, { type: "update" }); // push update after each bot move
    if ((state.phase as string) === "finished") return;
    await new Promise<void>((r) => setTimeout(r, BOT_TURN_DELAY_MS));
  }
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

  if (state.phase === "throwing") {
    const needsDefense = state.table.some((s) => !s.defense);
    if (needsDefense) {
      // A card was thrown but defender ran out of time → defender takes all.
      winnerUserId = resolveBout(room, state, true);
    } else {
      // Throwing phase expired with all cards defended → resolve successfully.
      winnerUserId = resolveBout(room, state, false);
    }
  } else if (state.phase === "defense" && !isFullyDefended(state.table)) {
    // Defender ran out of time → takes the cards.
    winnerUserId = resolveBout(room, state, true);
  } else if (state.table.length > 0 && isFullyDefended(state.table)) {
    // Attacker ran out of time after a full defense.
    // If it's a human player, they lose (become Durak). Bots just pass automatically.
    if (!isBotSeat(room, state.attackerIdx)) {
      const attackerSlot = room.players.find((p) => p.seatIdx === state.attackerIdx);
      state.phase = "finished";
      winnerUserId = attackerSlot?.userId ?? null;
      // Ensure remaining active non-durak players get finishPosition in persist
      for (const slot of room.players) {
        if (slot.seatIdx !== state.attackerIdx && !state.outPlayers.has(slot.seatIdx))
          state.outPlayers.add(slot.seatIdx);
      }
    } else {
      winnerUserId = resolveBout(room, state, false);
    }
  } else {
    // Attack phase, nothing on table — attacker failed to play.
    // Human attacker loses; bot attacker just skips turn.
    if (!isBotSeat(room, state.attackerIdx)) {
      const attackerSlot = room.players.find((p) => p.seatIdx === state.attackerIdx);
      state.phase = "finished";
      winnerUserId = attackerSlot?.userId ?? null;
      // Ensure remaining active non-durak players get finishPosition in persist
      for (const slot of room.players) {
        if (slot.seatIdx !== state.attackerIdx && !state.outPlayers.has(slot.seatIdx))
          state.outPlayers.add(slot.seatIdx);
      }
    } else {
      state.attackerIdx = nextActive(state.attackerIdx, seatCount(room), state.outPlayers);
      state.defenderIdx = nextActive(state.attackerIdx, seatCount(room), state.outPlayers);
    }
  }

  await persist(room, state, winnerUserId);
  return true;
}
