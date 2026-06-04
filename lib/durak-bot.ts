// ──────────────────────────────────────────────────────────────────────────
// Durak Bot AI — single-player vs bot support
// ──────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Suit,
  type TableSlot,
  rankValue,
  canAttack,
  canDefend,
  canTransfer,
  getThrowableRanks,
} from "@/lib/durak";

export type BotDifficulty = "easy" | "medium" | "hard";

export interface ClientBotState {
  hand: Card[];
  tableSlots: TableSlot[];
  deckCount: number;
  trumpSuit: Suit;
  opponentCardCounts: number[];
  phase: "attack" | "defense" | "throwing" | "finished";
  attackerIdx: number;
  defenderIdx: number;
  myIdx: number;
  variant: "podkidnoy" | "perevodnoy";
}

export type BotAction =
  | { action: "attack"; card: Card }
  | { action: "defend"; card: Card; slotIdx: number }
  | { action: "throw"; card: Card }
  | { action: "transfer"; card: Card }
  | { action: "take" }
  | { action: "pass" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTrump(card: Card, trumpSuit: Suit): boolean {
  return card.suit === trumpSuit;
}

function cardScore(card: Card, trumpSuit: Suit): number {
  // Lower = weaker/cheaper. Trumps are offset by +100 so they're always "more expensive".
  return isTrump(card, trumpSuit)
    ? rankValue(card.rank) + 100
    : rankValue(card.rank);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Attack logic ─────────────────────────────────────────────────────────────

function botAttack(
  state: ClientBotState,
  difficulty: BotDifficulty,
): BotAction {
  const { hand, tableSlots, trumpSuit } = state;
  const defenderHandSize = state.opponentCardCounts[0] ?? 6;

  // If table is fully defended, pass to end the bout
  const allDefended =
    tableSlots.length > 0 && tableSlots.every((s) => s.defense !== null);
  if (allDefended) return { action: "pass" };

  // Can't put more than 6 cards, and can't exceed what the defender can handle
  const undefended = tableSlots.filter((s) => !s.defense).length;
  const tableIsFull =
    tableSlots.length >= 6 || undefended >= Math.min(6, defenderHandSize);
  if (tableIsFull) return { action: "pass" };

  const validCards = hand.filter((c) => canAttack(c, tableSlots));
  if (validCards.length === 0) return { action: "pass" };

  if (difficulty === "easy") {
    return { action: "attack", card: pickRandom(validCards) };
  }

  if (difficulty === "medium") {
    // Prefer non-trump low cards; save trumps
    const nonTrumps = validCards.filter((c) => !isTrump(c, trumpSuit));
    const pool = nonTrumps.length > 0 ? nonTrumps : validCards;
    const sorted = [...pool].sort(
      (a, b) => rankValue(a.rank) - rankValue(b.rank),
    );
    return { action: "attack", card: sorted[0] };
  }

  // Hard: attack with the cheapest valid card; if we have pairs on table, push matching ranks
  {
    const throwableRanks = getThrowableRanks(tableSlots);
    let candidates = validCards;

    // If there's already something on the table, prefer matching ranks to press advantage
    if (tableSlots.length > 0) {
      const matching = validCards.filter((c) => throwableRanks.has(c.rank));
      if (matching.length > 0) candidates = matching;
    }

    const nonTrumps = candidates.filter((c) => !isTrump(c, trumpSuit));
    const pool = nonTrumps.length > 0 ? nonTrumps : candidates;
    const sorted = [...pool].sort(
      (a, b) => rankValue(a.rank) - rankValue(b.rank),
    );
    return { action: "attack", card: sorted[0] };
  }
}

// ── Defense logic ─────────────────────────────────────────────────────────────

function botDefend(
  state: ClientBotState,
  difficulty: BotDifficulty,
): BotAction {
  const { hand, tableSlots, trumpSuit, deckCount } = state;

  // Find all undefended slots
  const undefendedSlots = tableSlots
    .map((slot, idx) => ({ slot, idx }))
    .filter(({ slot }) => slot.defense === null);

  if (undefendedSlots.length === 0) return { action: "pass" };

  // When deck is empty, defending is always preferred: successfully defending
  // could empty your hand and win the game; taking guarantees more cards.
  const deckEmpty = deckCount === 0;

  // Check if ALL undefended slots can be covered
  const canCoverAll = undefendedSlots.every(({ slot }) =>
    hand.some((c) => canDefend(slot.attack, c, trumpSuit)),
  );

  // Helper: find cheapest defense for a slot
  const cheapestDefense = (slot: TableSlot, slotIdx: number): BotAction | null => {
    const options = hand.filter((c) => canDefend(slot.attack, c, trumpSuit));
    if (options.length === 0) return null;
    if (difficulty === "easy") return { action: "defend", card: pickRandom(options), slotIdx };
    const sorted = [...options].sort((a, b) => cardScore(a, trumpSuit) - cardScore(b, trumpSuit));
    return { action: "defend", card: sorted[0], slotIdx };
  };

  if (difficulty === "easy") {
    // If deck is empty, always try to defend the first slot you can
    const { slot, idx } = undefendedSlots[0];
    const def = cheapestDefense(slot, idx);
    if (deckEmpty && def) return def;
    if (def) return def;
    return { action: "take" };
  }

  if (difficulty === "medium") {
    // If deck is empty, always defend what we can (even one slot at a time)
    if (deckEmpty) {
      const { slot, idx } = undefendedSlots[0];
      const def = cheapestDefense(slot, idx);
      if (def) return def;
      return { action: "take" };
    }
    // Deck has cards: only defend if we can cover ALL slots
    if (!canCoverAll) return { action: "take" };
    const { slot, idx } = undefendedSlots[0];
    return cheapestDefense(slot, idx) ?? { action: "take" };
  }

  // Hard: smart evaluation
  {
    // When deck is empty — always defend if possible (winning opportunity)
    if (deckEmpty && canCoverAll) {
      const sorted = [...undefendedSlots].sort(
        (a, b) => cardScore(b.slot.attack, trumpSuit) - cardScore(a.slot.attack, trumpSuit),
      );
      return cheapestDefense(sorted[0].slot, sorted[0].idx) ?? { action: "take" };
    }

    if (!canCoverAll) {
      // Can't cover all — decide whether taking is worth it
      const totalTableCards = tableSlots.reduce((n, s) => n + 1 + (s.defense ? 1 : 0), 0);
      // With empty/low deck, taking is costly; take only if pile is big
      if (deckEmpty) return { action: "take" };
      if (deckCount <= 4 && totalTableCards <= 2) return { action: "take" };
      return { action: "take" };
    }

    // Can cover all — defend the highest-value attack with cheapest valid card
    const sorted = [...undefendedSlots].sort(
      (a, b) => cardScore(b.slot.attack, trumpSuit) - cardScore(a.slot.attack, trumpSuit),
    );
    return cheapestDefense(sorted[0].slot, sorted[0].idx) ?? { action: "take" };
  }
}

// ── Throwing / подкидной logic ───────────────────────────────────────────────

function botThrow(
  state: ClientBotState,
  difficulty: BotDifficulty,
): BotAction {
  const { hand, tableSlots, trumpSuit } = state;
  const defenderHandSize = state.opponentCardCounts[0] ?? 6;

  const undefended = tableSlots.filter((s) => !s.defense).length;
  const tableIsFull =
    tableSlots.length >= 6 || undefended >= Math.min(6, defenderHandSize);
  if (tableIsFull) return { action: "pass" };

  const throwableRanks = getThrowableRanks(tableSlots);
  const validCards = hand.filter((c) => throwableRanks.has(c.rank));

  if (validCards.length === 0) return { action: "pass" };

  if (difficulty === "easy") {
    // 50% chance to throw if able
    if (Math.random() < 0.5) return { action: "pass" };
    return { action: "throw", card: pickRandom(validCards) };
  }

  if (difficulty === "medium") {
    // Throw non-trump matching cards to maximise defender burden
    const nonTrumps = validCards.filter((c) => !isTrump(c, trumpSuit));
    if (nonTrumps.length > 0) {
      return {
        action: "throw",
        card: pickRandom(nonTrumps),
      };
    }
    return { action: "pass" };
  }

  // Hard: throw everything non-trump that matches
  {
    const nonTrumps = validCards.filter((c) => !isTrump(c, trumpSuit));
    if (nonTrumps.length > 0) {
      const sorted = [...nonTrumps].sort(
        (a, b) => rankValue(b.rank) - rankValue(a.rank),
      );
      return { action: "throw", card: sorted[0] };
    }
    return { action: "pass" };
  }
}

// ── Transfer / переводной logic ──────────────────────────────────────────────

function botTransfer(
  state: ClientBotState,
  difficulty: BotDifficulty,
): BotAction {
  const { hand, tableSlots, trumpSuit, variant, opponentCardCounts } = state;

  if (variant !== "perevodnoy") return botDefend(state, difficulty);

  const nextDefenderHandSize =
    opponentCardCounts.length > 1 ? opponentCardCounts[1] : 6;

  // Find cards that could transfer
  const transferCards = hand.filter((c) =>
    canTransfer(c, tableSlots, variant, nextDefenderHandSize),
  );

  if (transferCards.length === 0) return botDefend(state, difficulty);

  if (difficulty === "easy") {
    if (Math.random() < 0.4) return botDefend(state, difficulty);
    return { action: "transfer", card: pickRandom(transferCards) };
  }

  if (difficulty === "medium") {
    // Transfer if we have trumps and would need to use them
    const wouldNeedTrump = tableSlots.some(
      (s) =>
        s.defense === null &&
        !hand.some(
          (c) =>
            !isTrump(c, trumpSuit) && canDefend(s.attack, c, trumpSuit),
        ),
    );
    if (wouldNeedTrump && transferCards.length > 0) {
      const nonTrumps = transferCards.filter((c) => !isTrump(c, trumpSuit));
      if (nonTrumps.length > 0)
        return { action: "transfer", card: pickRandom(nonTrumps) };
    }
    return botDefend(state, difficulty);
  }

  // Hard: transfer with cheapest matching card to push burden
  {
    const sorted = [...transferCards].sort(
      (a, b) => cardScore(a, trumpSuit) - cardScore(b, trumpSuit),
    );
    return { action: "transfer", card: sorted[0] };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function getBotAction(
  state: ClientBotState,
  difficulty: BotDifficulty,
): BotAction {
  const { phase, myIdx, attackerIdx, defenderIdx, variant } = state;

  if (phase === "finished") return { action: "pass" };

  const isDefender = myIdx === defenderIdx;
  const isAttacker = myIdx === attackerIdx;

  if (phase === "defense") {
    if (isDefender) {
      if (variant === "perevodnoy") return botTransfer(state, difficulty);
      return botDefend(state, difficulty);
    }
    // Not defender in defense phase — can throw (подкидной)
    return botThrow(state, difficulty);
  }

  if (phase === "throwing") {
    if (!isDefender) return botThrow(state, difficulty);
    return { action: "pass" };
  }

  if (phase === "attack") {
    if (isAttacker) return botAttack(state, difficulty);
    // Other players in attack phase can also throw
    return botThrow(state, difficulty);
  }

  return { action: "pass" };
}

/** How many milliseconds the bot should "think" before acting. */
export function getBotDelay(difficulty: BotDifficulty): number {
  if (difficulty === "easy") return 800;
  if (difficulty === "medium") return 1200;
  // Hard: 1500-2000ms with some randomness
  return 1500 + Math.floor(Math.random() * 500);
}
